import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import { publicContractVersion } from '@operatoros-platform/contracts';

export const packageName = '@operatoros-platform/extension-runtime' as const;

export const SUPPORTED_OPERATIONS = [
  'extension.stage',
  'extension.validate',
  'extension.activate',
  'extension.suspend',
  'extension.retire',
  'extension.uninstall',
  'extension.boundary.check',
] as const;

export type ExtensionState = 'staged' | 'validated' | 'active' | 'suspended' | 'retired';

export interface ExtensionInstallation {
  entity_id: string;
  extension_id: string;
  extension_kind: 'plugin' | 'integration' | 'dashboard' | 'telemetry-exporter' | 'adapter';
  manifest_ref: string;
  content_digest: string;
  host_compatibility: string;
  capability_definitions: string[];
  requested_capabilities: string[];
  security_boundary_ref: string;
  state: ExtensionState;
  workspace_ref: string;
  record_version: number;
  successor: string | null;
  created_at: string;
  updated_at: string;
}

export interface BoundaryCheck {
  extension_ref: string;
  capability_requested: string;
  allowed: boolean;
  reason: string;
}

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

const SCHEMA_VERSION = publicContractVersion;

export function createSqliteExtensionRuntime(options: { databasePath: string }) {
  const database = new DatabaseSync(options.databasePath);
  database.exec(`
    CREATE TABLE IF NOT EXISTS extension_installations (
      entity_id TEXT PRIMARY KEY,
      extension_id TEXT NOT NULL,
      extension_kind TEXT NOT NULL,
      manifest_ref TEXT NOT NULL,
      content_digest TEXT NOT NULL,
      host_compatibility TEXT NOT NULL,
      capability_definitions TEXT NOT NULL,
      requested_capabilities TEXT NOT NULL,
      security_boundary_ref TEXT NOT NULL,
      state TEXT NOT NULL,
      workspace_ref TEXT NOT NULL,
      record_version INTEGER NOT NULL,
      successor TEXT,
      entity_schema_version TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE INDEX IF NOT EXISTS extension_by_state
      ON extension_installations(workspace_ref, state, extension_id);
  `);

  function stage(input: {
    entity_id: string;
    extension_id: string;
    extension_kind: ExtensionInstallation['extension_kind'];
    manifest_ref: string;
    content: string;
    host_compatibility: string;
    capability_definitions: string[];
    requested_capabilities: string[];
    security_boundary_ref: string;
    workspace_ref: string;
  }):
    | { outcome: 'committed'; record: ExtensionInstallation }
    | { outcome: 'conflict'; reason: string } {
    const existing = database
      .prepare('SELECT entity_id FROM extension_installations WHERE entity_id = ?')
      .get(input.entity_id);
    if (existing !== undefined) {
      return { outcome: 'conflict', reason: 'EXTENSION_ENTITY_ID_EXISTS' };
    }
    const now = new Date().toISOString();
    const contentDigest = digest(input.content);
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(
          `INSERT INTO extension_installations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'staged', ?, 1, NULL, ?, ?, ?)`,
        )
        .run(
          input.entity_id,
          input.extension_id,
          input.extension_kind,
          input.manifest_ref,
          contentDigest,
          input.host_compatibility,
          JSON.stringify(input.capability_definitions.slice().sort()),
          JSON.stringify(input.requested_capabilities.slice().sort()),
          input.security_boundary_ref,
          input.workspace_ref,
          SCHEMA_VERSION,
          now,
          now,
        );
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return {
      outcome: 'committed',
      record: {
        entity_id: input.entity_id,
        extension_id: input.extension_id,
        extension_kind: input.extension_kind,
        manifest_ref: input.manifest_ref,
        content_digest: contentDigest,
        host_compatibility: input.host_compatibility,
        capability_definitions: input.capability_definitions,
        requested_capabilities: input.requested_capabilities,
        security_boundary_ref: input.security_boundary_ref,
        state: 'staged',
        workspace_ref: input.workspace_ref,
        record_version: 1,
        successor: null,
        created_at: now,
        updated_at: now,
      },
    };
  }

  function validate(input: { entity_id: string; expected_version: number }): {
    outcome: 'committed' | 'rejected';
    reason?: string;
    record_version?: number;
  } {
    const row = database
      .prepare('SELECT record_version, state FROM extension_installations WHERE entity_id = ?')
      .get(input.entity_id) as { record_version: number; state: ExtensionState } | undefined;
    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
    if (!row || row.record_version !== input.expected_version) {
      return { outcome: 'rejected', reason: 'EXTENSION_VERSION_MISMATCH' };
    }
    if (row.state !== 'staged') {
      return { outcome: 'rejected', reason: 'EXTENSION_NOT_STAGED' };
    }
    const now = new Date().toISOString();
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(
          `UPDATE extension_installations SET state = 'validated', record_version = record_version + 1, updated_at = ? WHERE entity_id = ?`,
        )
        .run(now, input.entity_id);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return { outcome: 'committed', record_version: input.expected_version + 1 };
  }

  function activate(input: {
    entity_id: string;
    expected_version: number;
    governanceStore: {
      listActiveGrantsFor(input: {
        subject_ref: string;
      }): { capability_definition_ref: string; state: string }[];
    };
    subject_ref: string;
  }): { outcome: 'committed' | 'rejected' | 'conflict'; reason?: string; record_version?: number } {
    const row = database
      .prepare(
        'SELECT record_version, state, requested_capabilities, content_digest FROM extension_installations WHERE entity_id = ?',
      )
      .get(input.entity_id) as
      | {
          record_version: number;
          state: ExtensionState;
          requested_capabilities: string;
          content_digest: string;
        }
      | undefined;
    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
    if (!row || row.record_version !== input.expected_version) {
      return { outcome: 'conflict', reason: 'EXTENSION_VERSION_MISMATCH' };
    }
    if (row.state !== 'validated') {
      return { outcome: 'rejected', reason: 'EXTENSION_NOT_VALIDATED' };
    }
    const requested: string[] = JSON.parse(row.requested_capabilities) as string[];
    const grants = input.governanceStore.listActiveGrantsFor({ subject_ref: input.subject_ref });
    const granted = new Set(
      grants.filter((g) => g.state === 'active').map((g) => g.capability_definition_ref),
    );
    for (const cap of requested) {
      if (!granted.has(cap)) {
        return { outcome: 'rejected', reason: `CAPABILITY_GRANT_MISSING:${cap}` };
      }
    }
    const now = new Date().toISOString();
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(
          `UPDATE extension_installations SET state = 'active', record_version = record_version + 1, updated_at = ? WHERE entity_id = ?`,
        )
        .run(now, input.entity_id);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return { outcome: 'committed', record_version: input.expected_version + 1 };
  }

  function suspend(input: { entity_id: string; expected_version: number }): {
    outcome: 'committed' | 'rejected';
    reason?: string;
    record_version?: number;
  } {
    const row = database
      .prepare('SELECT record_version, state FROM extension_installations WHERE entity_id = ?')
      .get(input.entity_id) as { record_version: number; state: ExtensionState } | undefined;
    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
    if (!row || row.record_version !== input.expected_version) {
      return { outcome: 'rejected', reason: 'EXTENSION_VERSION_MISMATCH' };
    }
    if (row.state !== 'active') {
      return { outcome: 'rejected', reason: 'EXTENSION_NOT_ACTIVE' };
    }
    const now = new Date().toISOString();
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(
          `UPDATE extension_installations SET state = 'suspended', record_version = record_version + 1, updated_at = ? WHERE entity_id = ?`,
        )
        .run(now, input.entity_id);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return { outcome: 'committed', record_version: input.expected_version + 1 };
  }

  function retire(input: {
    entity_id: string;
    expected_version: number;
    successor_entity_id?: string;
  }): { outcome: 'committed' | 'rejected'; reason?: string; record_version?: number } {
    const row = database
      .prepare('SELECT record_version, state FROM extension_installations WHERE entity_id = ?')
      .get(input.entity_id) as { record_version: number; state: ExtensionState } | undefined;
    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
    if (!row || row.record_version !== input.expected_version) {
      return { outcome: 'rejected', reason: 'EXTENSION_VERSION_MISMATCH' };
    }
    if (row.state === 'retired') {
      return { outcome: 'rejected', reason: 'EXTENSION_ALREADY_RETIRED' };
    }
    if (input.successor_entity_id !== undefined) {
      const successor = database
        .prepare('SELECT entity_id FROM extension_installations WHERE entity_id = ?')
        .get(input.successor_entity_id);
      if (successor === undefined) {
        return { outcome: 'rejected', reason: 'SUCCESSOR_NOT_FOUND' };
      }
    }
    const now = new Date().toISOString();
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(
          `UPDATE extension_installations SET state = 'retired', record_version = record_version + 1, updated_at = ?, successor = ? WHERE entity_id = ?`,
        )
        .run(now, input.successor_entity_id ?? null, input.entity_id);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return { outcome: 'committed', record_version: input.expected_version + 1 };
  }

  function uninstall(input: { entity_id: string }): {
    outcome: 'committed' | 'rejected';
    reason?: string;
  } {
    const row = database
      .prepare('SELECT state FROM extension_installations WHERE entity_id = ?')
      .get(input.entity_id) as { state: ExtensionState } | undefined;
    if (!row) {
      return { outcome: 'rejected', reason: 'EXTENSION_NOT_FOUND' };
    }
    if (row.state !== 'retired') {
      return { outcome: 'rejected', reason: 'EXTENSION_NOT_RETIRED' };
    }
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare('DELETE FROM extension_installations WHERE entity_id = ?')
        .run(input.entity_id);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return { outcome: 'committed' };
  }

  function checkBoundary(input: {
    extension_id: string;
    capability_requested: string;
  }): BoundaryCheck {
    const row = database
      .prepare(
        'SELECT state, requested_capabilities, capability_definitions FROM extension_installations WHERE extension_id = ?',
      )
      .get(input.extension_id) as
      | { state: ExtensionState; requested_capabilities: string; capability_definitions: string }
      | undefined;
    if (!row) {
      return {
        extension_ref: input.extension_id,
        capability_requested: input.capability_requested,
        allowed: false,
        reason: 'EXTENSION_NOT_INSTALLED',
      };
    }
    if (row.state !== 'active') {
      return {
        extension_ref: input.extension_id,
        capability_requested: input.capability_requested,
        allowed: false,
        reason: 'EXTENSION_NOT_ACTIVE',
      };
    }
    const declared: string[] = JSON.parse(row.capability_definitions) as string[];
    if (!declared.includes(input.capability_requested)) {
      return {
        extension_ref: input.extension_id,
        capability_requested: input.capability_requested,
        allowed: false,
        reason: 'CAPABILITY_NOT_DECLARED',
      };
    }
    return {
      extension_ref: input.extension_id,
      capability_requested: input.capability_requested,
      allowed: true,
      reason: 'WITHIN_BOUNDARY',
    };
  }

  function getExtension(entity_id: string): ExtensionInstallation | null {
    const row = database
      .prepare('SELECT * FROM extension_installations WHERE entity_id = ?')
      .get(entity_id) as
      | {
          entity_id: string;
          extension_id: string;
          extension_kind: ExtensionInstallation['extension_kind'];
          manifest_ref: string;
          content_digest: string;
          host_compatibility: string;
          capability_definitions: string;
          requested_capabilities: string;
          security_boundary_ref: string;
          state: ExtensionState;
          workspace_ref: string;
          record_version: number;
          successor: string | null;
          created_at: string;
          updated_at: string;
        }
      | undefined;
    if (!row) return null;
    return {
      entity_id: row.entity_id,
      extension_id: row.extension_id,
      extension_kind: row.extension_kind,
      manifest_ref: row.manifest_ref,
      content_digest: row.content_digest,
      host_compatibility: row.host_compatibility,
      capability_definitions: JSON.parse(row.capability_definitions) as string[],
      requested_capabilities: JSON.parse(row.requested_capabilities) as string[],
      security_boundary_ref: row.security_boundary_ref,
      state: row.state,
      workspace_ref: row.workspace_ref,
      record_version: row.record_version,
      successor: row.successor,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  return {
    stage,
    validate,
    activate,
    suspend,
    retire,
    uninstall,
    checkBoundary,
    getExtension,
    close: () => {
      database.close();
    },
  };
}
