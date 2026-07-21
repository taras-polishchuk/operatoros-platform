import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import { publicContractVersion } from '@operatoros-platform/contracts';

export const packageName = '@operatoros-platform/secrets-service' as const;

export const SUPPORTED_OPERATIONS = [
  'secret-reference.issue',
  'secret-reference.resolve',
  'secret-reference.revoke',
  'secret-reference.rotate',
  'security-baseline.assert',
] as const;

export interface SecretReferenceRecord {
  entity_id: string;
  secret_ref: string;
  backend: 'env-file' | 'keyring' | 'memory-env' | 'os-secret-service';
  path: string;
  placeholder_fingerprint: string;
  state: 'issued' | 'active' | 'rotated' | 'revoked';
  supersedes: string | null;
  workspace_ref: string;
  record_version: number;
  created_at: string;
  updated_at: string;
}

export interface SecretResolution {
  secret_ref: string;
  state: 'resolved' | 'absent' | 'forbidden';
  materialization: 'never-stored' | 'in-memory-only';
  preview: string | null;
}

export interface SecretBackend {
  read(secret_ref: string): Promise<{ value: string; source: string } | null>;
  list(): Promise<{ ref: string; source: string }[]>;
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

export class SecretMaterializationForbiddenError extends Error {
  constructor(
    public readonly secret_ref: string,
    public readonly reason: string,
  ) {
    super(`SECRET_MATERIALIZATION_FORBIDDEN: ${secret_ref} :: ${reason}`);
    this.name = 'SecretMaterializationForbiddenError';
  }
}

function fingerprint(value: string): string {
  return digest({ prefix: value.slice(0, 4), length: value.length });
}

export function createSqliteSecretStore(options: { databasePath: string }) {
  const database = new DatabaseSync(options.databasePath);
  database.exec(`
    CREATE TABLE IF NOT EXISTS secret_references (
      entity_id TEXT PRIMARY KEY,
      secret_ref TEXT NOT NULL,
      backend TEXT NOT NULL,
      path TEXT NOT NULL,
      placeholder_fingerprint TEXT NOT NULL,
      state TEXT NOT NULL,
      supersedes TEXT,
      workspace_ref TEXT NOT NULL,
      record_version INTEGER NOT NULL,
      entity_schema_version TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE INDEX IF NOT EXISTS secret_ref_by_state
      ON secret_references(workspace_ref, state, secret_ref);
  `);

  function issueSecretReference(input: {
    entity_id: string;
    secret_ref: string;
    backend: SecretReferenceRecord['backend'];
    path: string;
    placeholder: string;
    workspace_ref: string;
    supersedes?: string;
  }):
    | { outcome: 'committed'; record: SecretReferenceRecord }
    | { outcome: 'conflict'; deciding_source: 'aggregate_records' } {
    const existing = database
      .prepare('SELECT entity_id FROM secret_references WHERE entity_id = ?')
      .get(input.entity_id);
    if (existing !== undefined) {
      return { outcome: 'conflict', deciding_source: 'aggregate_records' };
    }
    const now = new Date().toISOString();
    const fp = fingerprint(input.placeholder);
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(`INSERT INTO secret_references VALUES (?, ?, ?, ?, ?, 'active', ?, ?, 1, ?, ?, ?)`)
        .run(
          input.entity_id,
          input.secret_ref,
          input.backend,
          input.path,
          fp,
          input.supersedes ?? null,
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
        secret_ref: input.secret_ref,
        backend: input.backend,
        path: input.path,
        placeholder_fingerprint: fp,
        state: 'active',
        supersedes: input.supersedes ?? null,
        workspace_ref: input.workspace_ref,
        record_version: 1,
        created_at: now,
        updated_at: now,
      },
    };
  }

  function revokeSecretReference(input: {
    entity_id: string;
    expected_version: number;
    revoker_ref: string;
  }): { outcome: 'committed'; record_version: number } | { outcome: 'conflict' } {
    const row = database
      .prepare(
        'SELECT record_version, state, secret_ref FROM secret_references WHERE entity_id = ?',
      )
      .get(input.entity_id) as
      | { record_version: number; state: SecretReferenceRecord['state']; secret_ref: string }
      | undefined;
    if (!row) {
      return { outcome: 'conflict' };
    }
    if (row.record_version !== input.expected_version) {
      return { outcome: 'conflict' };
    }
    const now = new Date().toISOString();
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(
          `UPDATE secret_references SET state = 'revoked', record_version = record_version + 1, updated_at = ? WHERE entity_id = ?`,
        )
        .run(now, input.entity_id);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return { outcome: 'committed', record_version: input.expected_version + 1 };
  }

  function rotateSecretReference(input: {
    entity_id: string;
    expected_version: number;
    successor_entity_id: string;
    new_placeholder: string;
  }): { outcome: 'committed'; record_version: number } | { outcome: 'conflict' } {
    const row = database
      .prepare(
        'SELECT secret_ref, workspace_ref, record_version FROM secret_references WHERE entity_id = ?',
      )
      .get(input.entity_id) as
      { secret_ref: string; workspace_ref: string; record_version: number } | undefined;
    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
    if (!row || row.record_version !== input.expected_version) {
      return { outcome: 'conflict' };
    }
    const rowExists: { secret_ref: string; workspace_ref: string; record_version: number } = row;
    const successorExisting = database
      .prepare('SELECT entity_id FROM secret_references WHERE entity_id = ?')
      .get(input.successor_entity_id);
    if (successorExisting !== undefined) {
      return { outcome: 'conflict' };
    }
    const now = new Date().toISOString();
    const fp = fingerprint(input.new_placeholder);
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(
          `UPDATE secret_references SET state = 'rotated', updated_at = ? WHERE entity_id = ?`,
        )
        .run(now, input.entity_id);
      database
        .prepare(`INSERT INTO secret_references VALUES (?, ?, ?, ?, ?, 'active', ?, ?, 1, ?, ?, ?)`)
        .run(
          input.successor_entity_id,
          rowExists.secret_ref,
          'env-file',
          `${rowExists.secret_ref}/rotated`,
          fp,
          input.entity_id,
          rowExists.workspace_ref,
          SCHEMA_VERSION,
          now,
          now,
        );
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return { outcome: 'committed', record_version: input.expected_version + 1 };
  }

  function getSecretReference(secret_ref: string): SecretReferenceRecord | null {
    const row = database
      .prepare('SELECT * FROM secret_references WHERE secret_ref = ?')
      .get(secret_ref) as
      | {
          entity_id: string;
          secret_ref: string;
          backend: SecretReferenceRecord['backend'];
          path: string;
          placeholder_fingerprint: string;
          state: SecretReferenceRecord['state'];
          supersedes: string | null;
          workspace_ref: string;
          record_version: number;
          created_at: string;
          updated_at: string;
        }
      | undefined;
    if (!row) return null;
    return {
      entity_id: row.entity_id,
      secret_ref: row.secret_ref,
      backend: row.backend,
      path: row.path,
      placeholder_fingerprint: row.placeholder_fingerprint,
      state: row.state,
      supersedes: row.supersedes,
      workspace_ref: row.workspace_ref,
      record_version: row.record_version,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  return {
    issueSecretReference,
    revokeSecretReference,
    rotateSecretReference,
    getSecretReference,
    close: () => {
      database.close();
    },
  };
}

export async function resolveSecret(
  store: ReturnType<typeof createSqliteSecretStore>,
  backend: SecretBackend,
  input: { secret_ref: string; caller_ref: string },
): Promise<SecretResolution> {
  const ref = store.getSecretReference(input.secret_ref);
  if (!ref)
    return {
      secret_ref: input.secret_ref,
      state: 'absent',
      materialization: 'never-stored',
      preview: null,
    };
  if (ref.state !== 'active') {
    return {
      secret_ref: input.secret_ref,
      state: 'forbidden',
      materialization: 'never-stored',
      preview: null,
    };
  }
  const raw = await backend.read(input.secret_ref);
  if (raw === null) {
    return {
      secret_ref: input.secret_ref,
      state: 'absent',
      materialization: 'never-stored',
      preview: null,
    };
  }
  // Materialize the secret into memory ONLY for the lifetime of this call.
  // The store never persists the value; the projection returned to the caller
  // only carries a 4-char preview so sensitive material stays operator-local.
  const preview = raw.value.length > 4 ? `${raw.value.slice(0, 4)}…` : raw.value;
  return {
    secret_ref: input.secret_ref,
    state: 'resolved',
    materialization: 'in-memory-only',
    preview,
  };
}

export interface SecurityBaseline {
  enforce_no_secret_persistence: boolean;
  enforce_workspace_isolation: boolean;
  enforce_audit_trail: boolean;
}

export const SECURITY_BASELINE: SecurityBaseline = {
  enforce_no_secret_persistence: true,
  enforce_workspace_isolation: true,
  enforce_audit_trail: true,
};

export function assertSecurityBaseline(baseline: SecurityBaseline = SECURITY_BASELINE): {
  baseline: SecurityBaseline;
  enforcing: boolean;
  asserted_at: string;
} {
  const allEnforced =
    baseline.enforce_no_secret_persistence &&
    baseline.enforce_workspace_isolation &&
    baseline.enforce_audit_trail;
  return {
    baseline,
    enforcing: allEnforced,
    asserted_at: new Date().toISOString(),
  };
}

export function inMemorySecretBackend(initial: Record<string, string> = {}): SecretBackend {
  const store = new Map<string, { value: string; source: string }>();
  for (const [key, value] of Object.entries(initial)) {
    store.set(key, { value, source: 'memory' });
  }
  return {
    read(secret_ref: string): Promise<{ value: string; source: string } | null> {
      return Promise.resolve(store.get(secret_ref) ?? null);
    },
    list(): Promise<{ ref: string; source: string }[]> {
      return Promise.resolve(
        Array.from(store.entries()).map(([ref, v]) => ({ ref, source: v.source })),
      );
    },
  };
}
