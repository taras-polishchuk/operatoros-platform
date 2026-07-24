import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import { publicContractVersion } from '@operatoros-platform/contracts';

export const packageName = '@operatoros-platform/governance-service' as const;

export const SUPPORTED_OPERATIONS = [
  'operator-profile.activate',
  'operator-profile.suspend',
  'capability-grant.issue',
  'capability-grant.revoke',
  'configuration-revision.publish',
  'configuration-revision.retire',
  'effective-configuration.compute',
] as const;

export interface OperatorProfileRecord {
  entity_id: string;
  identity_ref: string;
  state: 'draft' | 'active' | 'suspended' | 'archived';
  workspace_ref: string;
  record_version: number;
  updated_at: string;
  entity_schema_version: string;
  superseded_by: string | null;
}

export interface CapabilityGrantRecord {
  grant_id: string;
  entity_id: string;
  subject_ref: string;
  capability_definition_ref: string;
  scope: string;
  state: 'draft' | 'active' | 'suspended' | 'revoked';
  granted_at: string;
  expires_at: string | null;
  revoker_ref: string | null;
  workspace_ref: string;
  record_version: number;
  updated_at: string;
}

export interface ConfigurationRevisionRecord {
  config_ref: string;
  entity_id: string;
  scope: 'deployment-profile' | 'workspace' | 'mission' | 'run';
  precedence: number;
  payload: Record<string, unknown>;
  digest: string;
  state: 'draft' | 'validated' | 'active' | 'superseded' | 'retired';
  workspace_ref: string;
  record_version: number;
  updated_at: string;
  superseded_by: string | null;
}

export type GovernanceResult<T = string> =
  | { outcome: 'committed'; record: T; record_version: number }
  | { outcome: 'conflict'; deciding_source: 'aggregate_records'; current_version: number }
  | { outcome: 'rejected'; reason: string }
  | { outcome: 'computed'; effective: EffectiveConfiguration };

export interface EffectiveConfiguration {
  workspace_ref: string;
  resolved_precedence: { config_ref: string; precedence: number; scope: string }[];
  payload: Record<string, unknown>;
  digest: string;
  computed_at: string;
  approver_refs: string[];
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

const CONFIG_SCOPE_RANK: Record<ConfigurationRevisionRecord['scope'], number> = {
  'deployment-profile': 0,
  workspace: 1,
  mission: 2,
  run: 3,
};

export function createSqliteGovernanceStore(options: { databasePath: string }) {
  const database = new DatabaseSync(options.databasePath);
  database.exec(`
  CREATE TABLE IF NOT EXISTS operator_profiles (
    entity_id TEXT PRIMARY KEY,
    identity_ref TEXT NOT NULL,
    state TEXT NOT NULL,
    workspace_ref TEXT NOT NULL,
    record_version INTEGER NOT NULL,
    entity_schema_version TEXT NOT NULL,
    superseded_by TEXT,
    updated_at TEXT NOT NULL
  ) STRICT;
  CREATE TABLE IF NOT EXISTS capability_grants (
    grant_id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    subject_ref TEXT NOT NULL,
    capability_definition_ref TEXT NOT NULL,
    scope TEXT NOT NULL,
    state TEXT NOT NULL,
    granted_at TEXT NOT NULL,
    expires_at TEXT,
    revoker_ref TEXT,
    workspace_ref TEXT NOT NULL,
    record_version INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;
  CREATE INDEX IF NOT EXISTS grants_by_subject ON capability_grants(subject_ref, state);
  CREATE TABLE IF NOT EXISTS configuration_revisions (
    config_ref TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    scope TEXT NOT NULL,
    precedence INTEGER NOT NULL,
    payload TEXT NOT NULL,
    digest TEXT NOT NULL,
    state TEXT NOT NULL,
    workspace_ref TEXT NOT NULL,
    record_version INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    superseded_by TEXT
  ) STRICT;
  CREATE INDEX IF NOT EXISTS config_by_scope ON configuration_revisions(workspace_ref, scope, precedence DESC);
`);

  function activateOperator(input: {
    entity_id: string;
    identity_ref: string;
    workspace_ref: string;
    subject_identity_ref: string;
  }): GovernanceResult<OperatorProfileRecord> {
    const now = new Date().toISOString();
    const existing = database
      .prepare('SELECT state, record_version FROM operator_profiles WHERE entity_id = ?')
      .get(input.entity_id);
    if (existing !== undefined) {
      const row = existing as { record_version: number };
      return {
        outcome: 'conflict',
        deciding_source: 'aggregate_records',
        current_version: row.record_version,
      };
    }
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(`INSERT INTO operator_profiles VALUES (?, ?, 'active', ?, 1, ?, NULL, ?)`)
        .run(input.entity_id, input.identity_ref, input.workspace_ref, SCHEMA_VERSION, now);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return {
      outcome: 'committed',
      record_version: 1,
      record: {
        entity_id: input.entity_id,
        identity_ref: input.identity_ref,
        state: 'active',
        workspace_ref: input.workspace_ref,
        record_version: 1,
        updated_at: now,
        entity_schema_version: SCHEMA_VERSION,
        superseded_by: null,
      },
    };
  }

  function suspendOperator(input: {
    entity_id: string;
    expected_version: number;
    subject_identity_ref: string;
  }): GovernanceResult<OperatorProfileRecord> {
    const row = database
      .prepare('SELECT * FROM operator_profiles WHERE entity_id = ?')
      .get(input.entity_id) as { record_version: number; state: string } | undefined;
    const rowRecordVersion: number | undefined = row?.record_version;
    if (!row || rowRecordVersion !== input.expected_version) {
      return {
        outcome: 'conflict',
        deciding_source: 'aggregate_records',
        current_version: rowRecordVersion ?? 0,
      };
    }
    const now = new Date().toISOString();
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(
          'UPDATE operator_profiles SET state = ?, record_version = record_version + 1, updated_at = ? WHERE entity_id = ?',
        )
        .run('suspended', now, input.entity_id);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    const updated = database
      .prepare(
        'SELECT identity_ref, workspace_ref, entity_schema_version, superseded_by FROM operator_profiles WHERE entity_id = ?',
      )
      .get(input.entity_id) as
      | {
          identity_ref: string;
          workspace_ref: string;
          entity_schema_version: string;
          superseded_by: string | null;
        }
      | undefined;
    return {
      outcome: 'committed',
      record_version: input.expected_version + 1,
      record: {
        entity_id: input.entity_id,
        identity_ref: updated?.identity_ref ?? '',
        state: 'suspended',
        workspace_ref: updated?.workspace_ref ?? '',
        record_version: input.expected_version + 1,
        updated_at: now,
        entity_schema_version: updated?.entity_schema_version ?? SCHEMA_VERSION,
        superseded_by: updated?.superseded_by ?? null,
      },
    };
  }

  function issueGrant(input: {
    grant_id: string;
    entity_id: string;
    subject_ref: string;
    capability_definition_ref: string;
    scope: string;
    workspace_ref: string;
    granted_at?: string;
    expires_at?: string;
  }): GovernanceResult<CapabilityGrantRecord> {
    const existing = database
      .prepare('SELECT record_version FROM capability_grants WHERE grant_id = ?')
      .get(input.grant_id);
    if (existing !== undefined) {
      const row = existing as { record_version: number };
      return {
        outcome: 'conflict',
        deciding_source: 'aggregate_records',
        current_version: row.record_version,
      };
    }
    const grantedAt = input.granted_at ?? new Date().toISOString();
    const expiresAt = input.expires_at ?? null;
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(`INSERT INTO capability_grants VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, 1, ?)`)
        .run(
          input.grant_id,
          input.entity_id,
          input.subject_ref,
          input.capability_definition_ref,
          input.scope,
          grantedAt,
          expiresAt,
          null,
          input.workspace_ref,
          grantedAt,
        );
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return {
      outcome: 'committed',
      record_version: 1,
      record: {
        grant_id: input.grant_id,
        entity_id: input.entity_id,
        subject_ref: input.subject_ref,
        capability_definition_ref: input.capability_definition_ref,
        scope: input.scope,
        state: 'active',
        granted_at: grantedAt,
        expires_at: expiresAt,
        revoker_ref: null,
        workspace_ref: input.workspace_ref,
        record_version: 1,
        updated_at: grantedAt,
      },
    };
  }

  function revokeGrant(input: {
    grant_id: string;
    expected_version: number;
    revoker_ref: string;
  }): GovernanceResult<CapabilityGrantRecord> {
    const row = database
      .prepare('SELECT record_version FROM capability_grants WHERE grant_id = ?')
      .get(input.grant_id) as { record_version: number } | undefined;
    const rowRecordVersion: number | undefined = row?.record_version;
    if (!row || rowRecordVersion !== input.expected_version) {
      return {
        outcome: 'conflict',
        deciding_source: 'aggregate_records',
        current_version: rowRecordVersion ?? 0,
      };
    }
    const now = new Date().toISOString();
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(
          `UPDATE capability_grants SET state = 'revoked', revoker_ref = ?, record_version = record_version + 1, updated_at = ? WHERE grant_id = ?`,
        )
        .run(input.revoker_ref, now, input.grant_id);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    const updated = database
      .prepare(
        'SELECT entity_id, subject_ref, capability_definition_ref, scope, granted_at, expires_at, workspace_ref FROM capability_grants WHERE grant_id = ?',
      )
      .get(input.grant_id) as
      | {
          entity_id: string;
          subject_ref: string;
          capability_definition_ref: string;
          scope: string;
          granted_at: string;
          expires_at: string | null;
          workspace_ref: string;
        }
      | undefined;
    return {
      outcome: 'committed',
      record_version: input.expected_version + 1,
      record: {
        grant_id: input.grant_id,
        entity_id: updated?.entity_id ?? '',
        subject_ref: updated?.subject_ref ?? '',
        capability_definition_ref: updated?.capability_definition_ref ?? '',
        scope: updated?.scope ?? '',
        state: 'revoked',
        granted_at: updated?.granted_at ?? '',
        expires_at: updated?.expires_at ?? null,
        revoker_ref: input.revoker_ref,
        workspace_ref: updated?.workspace_ref ?? '',
        record_version: input.expected_version + 1,
        updated_at: now,
      },
    };
  }

  function publishRevision(input: {
    config_ref: string;
    entity_id: string;
    scope: ConfigurationRevisionRecord['scope'];
    precedence: number;
    payload: Record<string, unknown>;
    workspace_ref: string;
  }): GovernanceResult<ConfigurationRevisionRecord> {
    if (input.precedence < 0 || !Number.isInteger(input.precedence)) {
      return { outcome: 'rejected', reason: 'PRECEDENCE_NOT_INTEGER_NONNEGATIVE' };
    }
    const existing = database
      .prepare('SELECT record_version FROM configuration_revisions WHERE config_ref = ?')
      .get(input.config_ref);
    if (existing !== undefined) {
      const row = existing as { record_version: number };
      return {
        outcome: 'conflict',
        deciding_source: 'aggregate_records',
        current_version: row.record_version,
      };
    }
    const newDigest = digest(input.payload);
    const now = new Date().toISOString();
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(
          `INSERT INTO configuration_revisions VALUES (?, ?, ?, ?, ?, ?, 'active', ?, 1, ?, NULL)`,
        )
        .run(
          input.config_ref,
          input.entity_id,
          input.scope,
          input.precedence,
          JSON.stringify(input.payload),
          newDigest,
          input.workspace_ref,
          now,
        );
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return {
      outcome: 'committed',
      record_version: 1,
      record: {
        config_ref: input.config_ref,
        entity_id: input.entity_id,
        scope: input.scope,
        precedence: input.precedence,
        payload: input.payload,
        digest: newDigest,
        state: 'active',
        workspace_ref: input.workspace_ref,
        record_version: 1,
        updated_at: now,
        superseded_by: null,
      },
    };
  }

  function retireRevision(input: {
    config_ref: string;
    expected_version: number;
  }): GovernanceResult<ConfigurationRevisionRecord> {
    const row = database
      .prepare('SELECT * FROM configuration_revisions WHERE config_ref = ?')
      .get(input.config_ref) as { record_version: number } | undefined;
    const rowRecordVersion: number | undefined = row?.record_version;
    if (!row || rowRecordVersion !== input.expected_version) {
      return {
        outcome: 'conflict',
        deciding_source: 'aggregate_records',
        current_version: rowRecordVersion ?? 0,
      };
    }
    const now = new Date().toISOString();
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(
          `UPDATE configuration_revisions SET state = 'retired', record_version = record_version + 1, updated_at = ? WHERE config_ref = ?`,
        )
        .run(now, input.config_ref);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    const updated = database
      .prepare(
        'SELECT entity_id, scope, precedence, payload, digest, workspace_ref, superseded_by FROM configuration_revisions WHERE config_ref = ?',
      )
      .get(input.config_ref) as
      | {
          entity_id: string;
          scope: ConfigurationRevisionRecord['scope'];
          precedence: number;
          payload: string;
          digest: string;
          workspace_ref: string;
          superseded_by: string | null;
        }
      | undefined;
    const parsedPayload = updated?.payload
      ? (JSON.parse(updated.payload) as Record<string, unknown>)
      : {};
    return {
      outcome: 'committed',
      record_version: input.expected_version + 1,
      record: {
        config_ref: input.config_ref,
        entity_id: updated?.entity_id ?? '',
        scope: updated?.scope ?? 'workspace',
        precedence: updated?.precedence ?? 0,
        payload: parsedPayload,
        digest: updated?.digest ?? '',
        state: 'retired',
        workspace_ref: updated?.workspace_ref ?? '',
        record_version: input.expected_version + 1,
        updated_at: now,
        superseded_by: updated?.superseded_by ?? null,
      },
    };
  }

  function computeEffectiveConfiguration(input: {
    workspace_ref: string;
    approver_refs: string[];
  }): GovernanceResult {
    const rows = (
      database
        .prepare(
          `SELECT config_ref, scope, precedence, payload, digest FROM configuration_revisions WHERE workspace_ref = ? AND state = 'active'`,
        )
        .all(input.workspace_ref) as {
        config_ref: string;
        scope: ConfigurationRevisionRecord['scope'];
        precedence: number;
        payload: string;
        digest: string;
      }[]
    ).sort(
      (left, right) =>
        CONFIG_SCOPE_RANK[left.scope] - CONFIG_SCOPE_RANK[right.scope] ||
        left.precedence - right.precedence ||
        left.config_ref.localeCompare(right.config_ref),
    );
    for (let index = 1; index < rows.length; index += 1) {
      const previousRow = rows[index - 1];
      const currentRow = rows[index];
      if (previousRow && currentRow) {
        if (
          previousRow.scope === currentRow.scope &&
          previousRow.precedence === currentRow.precedence
        ) {
          return {
            outcome: 'rejected',
            reason: `EQUAL_PRECEDENCE_CONFLICT:${String(currentRow.scope)}:${String(currentRow.precedence)}`,
          };
        }
      }
    }
    const precedence = [...rows]
      .reverse()
      .map((row) => ({ config_ref: row.config_ref, precedence: row.precedence, scope: row.scope }));
    let merged: Record<string, unknown> = {};
    for (const row of rows) {
      const parsed = JSON.parse(row.payload) as Record<string, unknown>;
      merged = { ...merged, ...parsed };
    }
    const dig = digest({ merged, precedence, workspace_ref: input.workspace_ref });
    return {
      outcome: 'computed',
      effective: {
        workspace_ref: input.workspace_ref,
        resolved_precedence: precedence,
        payload: merged,
        digest: dig,
        computed_at: new Date().toISOString(),
        approver_refs: input.approver_refs,
      },
    };
  }

  function listActiveGrantsFor(input: {
    subject_ref: string;
    // If true, grants whose `expires_at` is strictly in the past are filtered out.
    // Active grants whose `expires_at` is null are never expired.
    // Defaults to true so callers never see time-expired grants by accident.
    exclude_expired?: boolean;
  }): CapabilityGrantRecord[] {
    const nowIso = new Date().toISOString();
    const excludeExpired = input.exclude_expired ?? true;
    const sql = excludeExpired
      ? `SELECT * FROM capability_grants
           WHERE subject_ref = ?
             AND state = 'active'
             AND (expires_at IS NULL OR expires_at > ?)`
      : `SELECT * FROM capability_grants WHERE subject_ref = ? AND state = 'active'`;
    const rows = (excludeExpired
      ? database.prepare(sql).all(input.subject_ref, nowIso)
      : database.prepare(sql).all(input.subject_ref)) as unknown as {
      grant_id: string;
      entity_id: string;
      subject_ref: string;
      capability_definition_ref: string;
      scope: string;
      state: CapabilityGrantRecord['state'];
      granted_at: string;
      expires_at: string | null;
      revoker_ref: string | null;
      workspace_ref: string;
      record_version: number;
      updated_at: string;
    }[];
    return rows.map((row) => ({
      grant_id: row.grant_id,
      entity_id: row.entity_id,
      subject_ref: row.subject_ref,
      capability_definition_ref: row.capability_definition_ref,
      scope: row.scope,
      state: row.state,
      granted_at: row.granted_at,
      expires_at: row.expires_at,
      revoker_ref: row.revoker_ref,
      workspace_ref: row.workspace_ref,
      record_version: row.record_version,
      updated_at: row.updated_at,
    }));
  }

  return {
    activateOperator,
    suspendOperator,
    issueGrant,
    revokeGrant,
    publishRevision,
    retireRevision,
    computeEffectiveConfiguration,
    listActiveGrantsFor,
    close: () => {
      database.close();
    },
  };
}

export function createGovernanceService(options: { databasePath: string }) {
  return createSqliteGovernanceStore({ databasePath: options.databasePath });
}

export type GovernanceStore = ReturnType<typeof createSqliteGovernanceStore>;
