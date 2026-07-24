import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { publicContractVersion } from '@operatoros-platform/contracts';

export const packageName = '@operatoros-platform/workspace-service' as const;

export const SUPPORTED_OPERATIONS = [
  'workspace.initialize',
  'workspace.activate',
  'artifact.create',
  'artifact.list',
  'artifact.get',
  'catalog.rebuild',
  'catalog.delete_and_rebuild',
  'snapshot.export',
  'snapshot.import',
] as const;

export interface ArtifactRecord {
  workspace_ref: string;
  artifact_id: string;
  record_version: number;
  artifact_kind: string;
  content_ref: string;
  content_digest: string;
  state: 'draft' | 'validated' | 'active' | 'superseded' | 'archived';
  superseded_by: string | null;
  supersedes: string | null;
  created_at: string;
  updated_at: string;
  entity: Record<string, unknown>;
}

export interface WorkspaceRecord {
  workspace_ref: string;
  root_path: string;
  state: 'initialized' | 'active' | 'archived' | 'superseded';
  record_version: number;
  created_at: string;
  updated_at: string;
  schema_version: string;
}

export type WorkspaceResult =
  | {
      outcome: 'committed';
      workspace_ref: string;
      record_version: number;
      entity_id: string;
      kind: 'workspace' | 'artifact';
      content_digest?: string;
    }
  | {
      outcome: 'conflict';
      workspace_ref: string;
      current_version: number;
      deciding_source: 'aggregate_records';
    }
  | {
      outcome: 'projection_built';
      workspace_ref: string;
      rebuilt_entities: number;
    }
  | {
      outcome: 'snapshot_imported';
      workspace_ref: string;
      source: string;
      entities_imported: number;
    }
  | {
      outcome: 'snapshot_built';
      workspace_ref: string;
      path: string;
      artifact_count: number;
    };

const AUTHORITATIVE_TABLES = `
  CREATE TABLE IF NOT EXISTS workspaces (
    workspace_ref TEXT PRIMARY KEY,
    root_path TEXT NOT NULL,
    state TEXT NOT NULL,
    record_version INTEGER NOT NULL,
    schema_version TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;
  CREATE TABLE IF NOT EXISTS artifact_records (
    workspace_ref TEXT NOT NULL,
    artifact_id TEXT NOT NULL,
    record_version INTEGER NOT NULL,
    artifact_kind TEXT NOT NULL,
    content_ref TEXT NOT NULL,
    content_digest TEXT NOT NULL,
    state TEXT NOT NULL,
    superseded_by TEXT,
    supersedes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    entity_json TEXT NOT NULL,
    PRIMARY KEY(workspace_ref, artifact_id),
    FOREIGN KEY(workspace_ref) REFERENCES workspaces(workspace_ref)
  ) STRICT;
  CREATE INDEX IF NOT EXISTS artifacts_by_workspace
    ON artifact_records(workspace_ref, record_version, artifact_id);
  CREATE TABLE IF NOT EXISTS catalog_projection (
    workspace_ref TEXT NOT NULL,
    kind TEXT NOT NULL,
    source_artifact_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    built_at TEXT NOT NULL,
    PRIMARY KEY(workspace_ref, kind, source_artifact_id)
  ) STRICT;
`;

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

const IDENTIFIER_COLUMN = /^[a-z][a-z0-9_]*$/i;

function toFilterClause(filter: Record<string, unknown>): { sql: string; values: unknown[] } {
  const parts: string[] = [];
  const values: unknown[] = [];
  for (const [key, val] of Object.entries(filter)) {
    if (typeof key === 'string' && IDENTIFIER_COLUMN.test(key)) {
      parts.push(` AND ${key} = ?`);
      values.push(val);
    }
  }
  return { sql: parts.join(''), values };
}

interface WorkspaceServiceOptions {
  databasePath: string;
  snapshotsDirectory: string;
}

export function createSqliteWorkspaceStore(options: { databasePath: string }) {
  const database = new DatabaseSync(options.databasePath);
  database.exec(AUTHORITATIVE_TABLES);

  function initializeWorkspace(input: {
    workspace_ref: string;
    root_path: string;
    subject_identity_ref: string;
  }): WorkspaceResult {
    const now = new Date().toISOString();
    const exists = database
      .prepare('SELECT workspace_ref FROM workspaces WHERE workspace_ref = ?')
      .get(input.workspace_ref);
    if (exists !== undefined) {
      return {
        outcome: 'conflict',
        workspace_ref: input.workspace_ref,
        current_version: 1,
        deciding_source: 'aggregate_records',
      };
    }
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(`INSERT INTO workspaces VALUES (?, ?, 'initialized', 1, ?, ?, ?)`)
        .run(input.workspace_ref, input.root_path, publicContractVersion, now, now);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    void mkdir(input.root_path, { recursive: true }).then(() =>
      writeFile(
        join(input.root_path, '.workspace.json'),
        `${JSON.stringify(
          {
            workspace_ref: input.workspace_ref,
            root_path: input.root_path,
            state: 'initialized',
            subject_identity_ref: input.subject_identity_ref,
            created_at: now,
            schema_version: publicContractVersion,
          },
          null,
          2,
        )}\n`,
      ),
    );
    return {
      outcome: 'committed',
      workspace_ref: input.workspace_ref,
      record_version: 1,
      entity_id: input.workspace_ref,
      kind: 'workspace',
    };
  }

  function activateWorkspace(input: {
    workspace_ref: string;
    subject_identity_ref: string;
    expected_version: number;
  }): WorkspaceResult {
    const row = database
      .prepare('SELECT record_version FROM workspaces WHERE workspace_ref = ?')
      .get(input.workspace_ref) as { record_version: number } | undefined;
    const currentVersion = row?.record_version ?? 0;
    if (row === undefined || currentVersion !== input.expected_version) {
      return {
        outcome: 'conflict',
        workspace_ref: input.workspace_ref,
        current_version: currentVersion,
        deciding_source: 'aggregate_records',
      };
    }
    const now = new Date().toISOString();
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(
          `UPDATE workspaces SET state = 'active', record_version = record_version + 1, updated_at = ? WHERE workspace_ref = ?`,
        )
        .run(now, input.workspace_ref);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return {
      outcome: 'committed',
      workspace_ref: input.workspace_ref,
      record_version: input.expected_version + 1,
      entity_id: input.workspace_ref,
      kind: 'workspace',
    };
  }

  function createArtifact(input: {
    workspace_ref: string;
    artifact_id: string;
    artifact_kind: string;
    content_ref: string;
    content: Buffer;
    supersedes?: string;
    subject_identity_ref: string;
  }): WorkspaceResult {
    const now = new Date().toISOString();
    const contentDigest = digest(input.content);
    const existing = database
      .prepare(
        'SELECT artifact_id, record_version FROM artifact_records WHERE workspace_ref = ? AND artifact_id = ?',
      )
      .get(input.workspace_ref, input.artifact_id) as { record_version: number } | undefined;
    if (existing !== undefined) {
      return {
        outcome: 'conflict',
        workspace_ref: input.workspace_ref,
        current_version: existing.record_version,
        deciding_source: 'aggregate_records',
      };
    }
    const next = 1;
    const entity = {
      kind: 'artifact',
      entity_id: input.artifact_id,
      entity_schema_version: publicContractVersion,
      workspace_ref: input.workspace_ref,
      record_version: next,
      created_at: now,
      updated_at: now,
      artifact_kind: input.artifact_kind,
      content_ref: input.content_ref,
      state: 'active',
      superseded_by: null,
      supersedes: input.supersedes ?? null,
      content_digest: contentDigest,
      subject_identity_ref: input.subject_identity_ref,
    } as const;
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(
          `INSERT INTO artifact_records VALUES (?, ?, ?, ?, ?, ?, 'active', NULL, ?, ?, ?, ?)`,
        )
        .run(
          input.workspace_ref,
          input.artifact_id,
          next,
          input.artifact_kind,
          input.content_ref,
          contentDigest,
          input.supersedes ?? null,
          now,
          now,
          JSON.stringify(entity),
        );
      database
        .prepare(`UPDATE workspaces SET updated_at = ? WHERE workspace_ref = ?`)
        .run(now, input.workspace_ref);
      if (input.supersedes !== undefined) {
        database
          .prepare(
            `UPDATE artifact_records SET state = 'superseded', superseded_by = ?, updated_at = ? WHERE workspace_ref = ? AND artifact_id = ?`,
          )
          .run(input.artifact_id, now, input.workspace_ref, input.supersedes);
      }
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return {
      outcome: 'committed',
      workspace_ref: input.workspace_ref,
      record_version: next,
      entity_id: input.artifact_id,
      kind: 'artifact',
      content_digest: contentDigest,
    };
  }

  function getArtifact(input: {
    workspace_ref: string;
    artifact_id: string;
  }): ArtifactRecord | null {
    const row = database
      .prepare('SELECT * FROM artifact_records WHERE workspace_ref = ? AND artifact_id = ?')
      .get(input.workspace_ref, input.artifact_id) as
      | {
          workspace_ref: string;
          artifact_id: string;
          record_version: number;
          artifact_kind: string;
          content_ref: string;
          content_digest: string;
          state: ArtifactRecord['state'];
          superseded_by: string | null;
          supersedes: string | null;
          created_at: string;
          updated_at: string;
          entity_json: string;
        }
      | undefined;
    if (row === undefined) return null;
    return {
      workspace_ref: row.workspace_ref,
      artifact_id: row.artifact_id,
      record_version: row.record_version,
      artifact_kind: row.artifact_kind,
      content_ref: row.content_ref,
      content_digest: row.content_digest,
      state: row.state,
      superseded_by: row.superseded_by,
      supersedes: row.supersedes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      entity: JSON.parse(row.entity_json) as Record<string, unknown>,
    };
  }

  function rebuildCatalog(input: { workspace_ref: string }): WorkspaceResult {
    database.exec('BEGIN IMMEDIATE');
    try {
      const artifacts = database
        .prepare(
          'SELECT artifact_id, artifact_kind, entity_json FROM artifact_records WHERE workspace_ref = ?',
        )
        .all(input.workspace_ref) as {
        artifact_id: string;
        artifact_kind: string;
        entity_json: string;
      }[];
      database
        .prepare('DELETE FROM catalog_projection WHERE workspace_ref = ?')
        .run(input.workspace_ref);
      const insertProjection = database.prepare(
        'INSERT INTO catalog_projection VALUES (?, ?, ?, ?, ?)',
      );
      let rebuilt = 0;
      const now = new Date().toISOString();
      for (const a of artifacts) {
        const entity = JSON.parse(a.entity_json) as Record<string, unknown>;
        insertProjection.run(
          input.workspace_ref,
          'artifact',
          a.artifact_id,
          JSON.stringify(entity),
          now,
        );
        rebuilt += 1;
      }
      database.exec('COMMIT');
      return {
        outcome: 'projection_built',
        workspace_ref: input.workspace_ref,
        rebuilt_entities: rebuilt,
      };
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  function listArtifacts(input: {
    workspace_ref: string;
    filter?: Record<string, unknown>;
  }): ArtifactRecord[] {
    const { sql, values } = toFilterClause(input.filter ?? {});
    const rows = database
      .prepare(`SELECT * FROM artifact_records WHERE workspace_ref = ?${sql} ORDER BY artifact_id`)
      .all(input.workspace_ref, ...(values as string[])) as {
      workspace_ref: string;
      artifact_id: string;
      record_version: number;
      artifact_kind: string;
      content_ref: string;
      content_digest: string;
      state: ArtifactRecord['state'];
      superseded_by: string | null;
      supersedes: string | null;
      created_at: string;
      updated_at: string;
      entity_json: string;
    }[];
    return rows.map((row) => ({
      workspace_ref: row.workspace_ref,
      artifact_id: row.artifact_id,
      record_version: row.record_version,
      artifact_kind: row.artifact_kind,
      content_ref: row.content_ref,
      content_digest: row.content_digest,
      state: row.state,
      superseded_by: row.superseded_by,
      supersedes: row.supersedes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      entity: JSON.parse(row.entity_json) as Record<string, unknown>,
    }));
  }

  async function exportSnapshot(input: {
    workspace_ref: string;
    target_path: string;
  }): Promise<WorkspaceResult> {
    const artifacts = listArtifacts({ workspace_ref: input.workspace_ref });
    const workspaceRow = database
      .prepare('SELECT * FROM workspaces WHERE workspace_ref = ?')
      .get(input.workspace_ref);
    const snapshotArtifacts = await Promise.all(
      artifacts.map(async (artifact) => {
        const content = await readFile(artifact.content_ref);
        return {
          artifact_id: artifact.artifact_id,
          record_version: artifact.record_version,
          artifact_kind: artifact.artifact_kind,
          content_digest: artifact.content_digest,
          content_sha256: createHash('sha256').update(content).digest('hex'),
          content_base64: content.toString('base64'),
          state: artifact.state,
          entity: artifact.entity,
        };
      }),
    );
    await mkdir(dirname(input.target_path), { recursive: true });
    await writeFile(
      input.target_path,
      JSON.stringify(
        {
          schema_version: publicContractVersion,
          snapshot_at: new Date().toISOString(),
          workspace_ref: input.workspace_ref,
          workspace: workspaceRow,
          artifacts: snapshotArtifacts,
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );
    return {
      outcome: 'snapshot_built',
      workspace_ref: input.workspace_ref,
      path: input.target_path,
      artifact_count: artifacts.length,
    };
  }

  async function importSnapshot(input: {
    workspace_ref: string;
    root_path: string;
    source_path: string;
  }): Promise<WorkspaceResult> {
    const raw = await readFile(input.source_path, 'utf8');
    const snapshot = JSON.parse(raw) as {
      schema_version: string;
      workspace_ref: string;
      artifacts: {
        artifact_id: string;
        artifact_kind: string;
        content_digest: string;
        content_sha256: string;
        content_base64: string;
        state: ArtifactRecord['state'];
        entity: Record<string, unknown>;
      }[];
    };
    if (snapshot.schema_version !== publicContractVersion) {
      throw new Error(`SNAPSHOT_SCHEMA_VERSION_UNSUPPORTED:${snapshot.schema_version}`);
    }
    if (snapshot.workspace_ref !== input.workspace_ref) {
      throw new Error(
        `WORKSPACE_REF_MISMATCH: source=${snapshot.workspace_ref} target=${input.workspace_ref}`,
      );
    }
    let imported = 0;
    await mkdir(resolve(input.root_path), { recursive: true });
    database.exec('BEGIN IMMEDIATE');
    try {
      for (const a of snapshot.artifacts) {
        const content = Buffer.from(a.content_base64, 'base64');
        const contentSha256 = createHash('sha256').update(content).digest('hex');
        if (contentSha256 !== a.content_sha256) {
          throw new Error(`SNAPSHOT_CONTENT_INTEGRITY_FAILED:${a.artifact_id}`);
        }
        const canonicalContentDigest = digest(content);
        if (canonicalContentDigest !== a.content_digest) {
          throw new Error(`SNAPSHOT_CONTENT_DIGEST_MISMATCH:${a.artifact_id}`);
        }
        const exists = database
          .prepare(
            'SELECT artifact_id FROM artifact_records WHERE workspace_ref = ? AND artifact_id = ?',
          )
          .get(input.workspace_ref, a.artifact_id);
        if (exists !== undefined) continue;
        const restoredContentPath = artifactContentPath(input.root_path, a.artifact_id);
        await mkdir(dirname(restoredContentPath), { recursive: true });
        await writeFile(restoredContentPath, content);
        const entity = { ...a.entity, content_ref: restoredContentPath };
        database
          .prepare(`INSERT INTO artifact_records VALUES (?, ?, 1, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`)
          .run(
            input.workspace_ref,
            a.artifact_id,
            a.artifact_kind,
            restoredContentPath,
            a.content_digest,
            a.state,
            (a.entity.supersedes ?? null) as string | null,
            new Date().toISOString(),
            new Date().toISOString(),
            JSON.stringify(entity),
          );
        imported += 1;
      }
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return {
      outcome: 'snapshot_imported',
      workspace_ref: input.workspace_ref,
      source: input.source_path,
      entities_imported: imported,
    };
  }

  function getWorkspaceRecord(workspace_ref: string): WorkspaceRecord | null {
    const row = database
      .prepare('SELECT * FROM workspaces WHERE workspace_ref = ?')
      .get(workspace_ref) as
      | {
          workspace_ref: string;
          root_path: string;
          state: WorkspaceRecord['state'];
          record_version: number;
          schema_version: string;
          created_at: string;
          updated_at: string;
        }
      | undefined;
    if (row === undefined) return null;
    return {
      workspace_ref: row.workspace_ref,
      root_path: row.root_path,
      state: row.state,
      record_version: row.record_version,
      schema_version: row.schema_version,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  function getProjection(input: { workspace_ref: string }): {
    kind: string;
    source_artifact_id: string;
    payload: Record<string, unknown>;
    built_at: string;
  }[] {
    return (
      database
        .prepare(
          'SELECT kind, source_artifact_id, payload, built_at FROM catalog_projection WHERE workspace_ref = ?',
        )
        .all(input.workspace_ref) as {
        kind: string;
        source_artifact_id: string;
        payload: string;
        built_at: string;
      }[]
    ).map((row) => ({
      kind: row.kind,
      source_artifact_id: row.source_artifact_id,
      payload: JSON.parse(row.payload) as Record<string, unknown>,
      built_at: row.built_at,
    }));
  }

  return {
    initializeWorkspace,
    activateWorkspace,
    createArtifact,
    getArtifact,
    listArtifacts,
    rebuildCatalog,
    deleteAndRebuildCatalog: rebuildCatalog,
    exportSnapshot,
    importSnapshot,
    getWorkspaceRecord,
    getProjection,
    close: () => {
      database.close();
    },
  };
}

export function createWorkspaceService(options: WorkspaceServiceOptions) {
  const store = createSqliteWorkspaceStore({ databasePath: options.databasePath });
  void mkdir(options.snapshotsDirectory, { recursive: true });
  return {
    ...store,
    snapshotsDirectory: options.snapshotsDirectory,
  };
}

export async function deleteSnapshotIfExists(snapshotPath: string): Promise<void> {
  await rm(snapshotPath, { force: true });
}

export function artifactContentPath(rootPath: string, artifactId: string): string {
  return join(rootPath, `${artifactId}.content`);
}

export async function exportWorkspaceToPath(
  store: ReturnType<typeof createSqliteWorkspaceStore>,
  input: { workspace_ref: string; snapshot_path: string },
): Promise<WorkspaceResult> {
  return store.exportSnapshot({
    workspace_ref: input.workspace_ref,
    target_path: input.snapshot_path,
  });
}

export {
  parseContract as parseWorkspaceContract,
  publicContractVersion,
} from '@operatoros-platform/contracts';

export type Workspace = WorkspaceRecord;
