import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import { publicContractVersion } from '@operatoros-platform/contracts';

export const packageName = '@operatoros-platform/recovery-service' as const;

export const SUPPORTED_OPERATIONS = [
  'recovery.checkpoint.create',
  'recovery.lease.acquire',
  'recovery.lease.release',
  'recovery.lease.renew',
  'recovery.snapshot.restore',
  'recovery.contender.resolve',
] as const;

export type LeaseHolder =
  | { kind: 'process'; process_ref: string }
  | { kind: 'operator'; operator_ref: string }
  | { kind: 'agent'; agent_ref: string };

export interface RecoveryLease {
  workspace_ref: string;
  lease_id: string;
  holder: LeaseHolder;
  acquired_at: string;
  expires_at: string;
  state: 'active' | 'released' | 'expired' | 'preempted';
  // heartbeat/fencing-token for distributed coordination (used in M4)
  fencing_token: number;
  // sequence number used to detect stale contenders
  contender_seq: number;
}

export interface CheckpointRecord {
  checkpoint_ref: string;
  run_ref: string;
  workspace_ref: string;
  state_at: string;
  cursor: number;
  evidence_anchor: string;
  payload_digest: string;
  record_version: number;
  entity_schema_version: string;
  created_at: string;
}

export interface DualContenderVerdict {
  workspace_ref: string;
  winning_lease_id: string;
  winning_holder: LeaseHolder;
  losing_lease_id: string;
  losing_holder: LeaseHolder;
  decided_by: 'fencing_token' | 'contender_seq' | 'acquired_at';
  decided_at: string;
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

export function createSqliteRecoveryStore(options: { databasePath: string }) {
  const database = new DatabaseSync(options.databasePath);
  database.exec(`
    CREATE TABLE IF NOT EXISTS recovery_leases (
      lease_id TEXT PRIMARY KEY,
      workspace_ref TEXT NOT NULL,
      holder_kind TEXT NOT NULL,
      holder_ref TEXT NOT NULL,
      acquired_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      state TEXT NOT NULL,
      fencing_token INTEGER NOT NULL,
      contender_seq INTEGER NOT NULL,
      record_version INTEGER NOT NULL,
      created_at TEXT NOT NULL
    ) STRICT;

    CREATE INDEX IF NOT EXISTS lease_by_workspace
      ON recovery_leases(workspace_ref, state, expires_at);

    CREATE TABLE IF NOT EXISTS checkpoints (
      checkpoint_ref TEXT PRIMARY KEY,
      run_ref TEXT NOT NULL,
      workspace_ref TEXT NOT NULL,
      state_at TEXT NOT NULL,
      cursor INTEGER NOT NULL,
      evidence_anchor TEXT NOT NULL,
      payload_digest TEXT NOT NULL,
      record_version INTEGER NOT NULL,
      entity_schema_version TEXT NOT NULL,
      created_at TEXT NOT NULL
    ) STRICT;

    CREATE INDEX IF NOT EXISTS checkpoint_by_run
      ON checkpoints(run_ref, workspace_ref, cursor);
  `);

  let fencingSequence = 0;
  let contenderSequence = 0;

  function nextFencing(): number {
    fencingSequence += 1;
    return fencingSequence;
  }

  function nextContenderSeq(): number {
    contenderSequence += 1;
    return contenderSequence;
  }

  function createCheckpoint(input: {
    checkpoint_ref: string;
    run_ref: string;
    workspace_ref: string;
    state_at: string;
    cursor: number;
    evidence_anchor: string;
    payload: unknown;
  }):
    | { outcome: 'committed'; record: CheckpointRecord }
    | { outcome: 'conflict'; deciding_source: 'aggregate_records' } {
    const existing = database
      .prepare('SELECT checkpoint_ref FROM checkpoints WHERE checkpoint_ref = ?')
      .get(input.checkpoint_ref);
    if (existing !== undefined) {
      return { outcome: 'conflict', deciding_source: 'aggregate_records' };
    }
    const now = new Date().toISOString();
    const payloadDigest = digest(input.payload);
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(`INSERT INTO checkpoints VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`)
        .run(
          input.checkpoint_ref,
          input.run_ref,
          input.workspace_ref,
          input.state_at,
          input.cursor,
          input.evidence_anchor,
          payloadDigest,
          SCHEMA_VERSION,
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
        checkpoint_ref: input.checkpoint_ref,
        run_ref: input.run_ref,
        workspace_ref: input.workspace_ref,
        state_at: input.state_at,
        cursor: input.cursor,
        evidence_anchor: input.evidence_anchor,
        payload_digest: payloadDigest,
        record_version: 1,
        entity_schema_version: SCHEMA_VERSION,
        created_at: now,
      },
    };
  }

  function getLatestCheckpoint(run_ref: string): CheckpointRecord | null {
    const row = database
      .prepare('SELECT * FROM checkpoints WHERE run_ref = ? ORDER BY cursor DESC LIMIT 1')
      .get(run_ref) as
      | {
          checkpoint_ref: string;
          run_ref: string;
          workspace_ref: string;
          state_at: string;
          cursor: number;
          evidence_anchor: string;
          payload_digest: string;
          record_version: number;
          entity_schema_version: string;
          created_at: string;
        }
      | undefined;
    if (!row) return null;
    return row;
  }

  function acquireLease(input: {
    workspace_ref: string;
    holder: LeaseHolder;
    ttl_ms: number;
  }):
    | { outcome: 'committed'; lease: RecoveryLease }
    | { outcome: 'rejected'; reason: string; incumbent?: RecoveryLease } {
    const now = Date.now();
    const expiresAt = new Date(now + input.ttl_ms).toISOString();
    const active = database
      .prepare(
        "SELECT * FROM recovery_leases WHERE workspace_ref = ? AND state = 'active' AND expires_at > ?",
      )
      .get(input.workspace_ref, new Date(now).toISOString()) as
      | {
          lease_id: string;
          workspace_ref: string;
          holder_kind: LeaseHolder['kind'];
          holder_ref: string;
          acquired_at: string;
          expires_at: string;
          state: RecoveryLease['state'];
          fencing_token: number;
          contender_seq: number;
          record_version: number;
          created_at: string;
        }
      | undefined;
    if (active) {
      return {
        outcome: 'rejected',
        reason: 'LEASE_ALREADY_ACTIVE',
        incumbent: {
          workspace_ref: active.workspace_ref,
          lease_id: active.lease_id,
          holder:
            active.holder_kind === 'process'
              ? { kind: 'process' as const, process_ref: active.holder_ref }
              : active.holder_kind === 'operator'
                ? { kind: 'operator' as const, operator_ref: active.holder_ref }
                : { kind: 'agent' as const, agent_ref: active.holder_ref },
          acquired_at: active.acquired_at,
          expires_at: active.expires_at,
          state: active.state,
          fencing_token: active.fencing_token,
          contender_seq: active.contender_seq,
        },
      };
    }
    // Pre-empt any expired leases by transitioning them to 'expired'.
    database
      .prepare(
        "UPDATE recovery_leases SET state = 'expired' WHERE workspace_ref = ? AND state = 'active'",
      )
      .run(input.workspace_ref);
    const nowIso = new Date(now).toISOString();
    const lease_id = `lease_${digest({ workspace_ref: input.workspace_ref, holder: input.holder, now: nowIso }).slice(0, 16)}`;
    const fencing = nextFencing();
    const seq = nextContenderSeq();
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(`INSERT INTO recovery_leases VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, 1, ?)`)
        .run(
          lease_id,
          input.workspace_ref,
          input.holder.kind,
          input.holder.kind === 'process'
            ? input.holder.process_ref
            : input.holder.kind === 'operator'
              ? input.holder.operator_ref
              : input.holder.agent_ref,
          nowIso,
          expiresAt,
          fencing,
          seq,
          nowIso,
        );
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return {
      outcome: 'committed',
      lease: {
        workspace_ref: input.workspace_ref,
        lease_id,
        holder: input.holder,
        acquired_at: nowIso,
        expires_at: expiresAt,
        state: 'active',
        fencing_token: fencing,
        contender_seq: seq,
      },
    };
  }

  function releaseLease(input: { lease_id: string; expected_version: number }): {
    outcome: 'committed' | 'rejected';
    reason?: string;
  } {
    const row = database
      .prepare('SELECT record_version, state FROM recovery_leases WHERE lease_id = ?')
      .get(input.lease_id) as { record_version: number; state: RecoveryLease['state'] } | undefined;
    if (!row) return { outcome: 'rejected', reason: 'LEASE_NOT_FOUND' };
    if (row.record_version !== input.expected_version) {
      return { outcome: 'rejected', reason: 'LEASE_VERSION_MISMATCH' };
    }
    if (row.state !== 'active') {
      return { outcome: 'rejected', reason: 'LEASE_NOT_ACTIVE' };
    }
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(
          `UPDATE recovery_leases SET state = 'released', record_version = record_version + 1 WHERE lease_id = ?`,
        )
        .run(input.lease_id);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return { outcome: 'committed' };
  }

  function renewLease(input: {
    lease_id: string;
    expected_version: number;
    ttl_ms: number;
    expected_fencing_token: number;
  }): { outcome: 'committed'; lease: RecoveryLease } | { outcome: 'rejected'; reason: string } {
    const row = database
      .prepare('SELECT * FROM recovery_leases WHERE lease_id = ?')
      .get(input.lease_id) as
      | {
          workspace_ref: string;
          holder_kind: LeaseHolder['kind'];
          holder_ref: string;
          acquired_at: string;
          expires_at: string;
          state: RecoveryLease['state'];
          fencing_token: number;
          contender_seq: number;
          record_version: number;
          created_at: string;
        }
      | undefined;
    if (!row) return { outcome: 'rejected', reason: 'LEASE_NOT_FOUND' };
    if (row.state !== 'active') {
      return { outcome: 'rejected', reason: 'LEASE_NOT_ACTIVE' };
    }
    if (row.fencing_token !== input.expected_fencing_token) {
      return { outcome: 'rejected', reason: 'FENCING_TOKEN_PREEMPTED' };
    }
    if (row.record_version !== input.expected_version) {
      return { outcome: 'rejected', reason: 'LEASE_VERSION_MISMATCH' };
    }
    const expiresAt = new Date(Date.now() + input.ttl_ms).toISOString();
    const holder: LeaseHolder =
      row.holder_kind === 'process'
        ? { kind: 'process', process_ref: row.holder_ref }
        : row.holder_kind === 'operator'
          ? { kind: 'operator', operator_ref: row.holder_ref }
          : { kind: 'agent', agent_ref: row.holder_ref };
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(
          `UPDATE recovery_leases SET expires_at = ?, record_version = record_version + 1 WHERE lease_id = ?`,
        )
        .run(expiresAt, input.lease_id);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return {
      outcome: 'committed',
      lease: {
        workspace_ref: row.workspace_ref,
        lease_id: input.lease_id,
        holder,
        acquired_at: row.acquired_at,
        expires_at: expiresAt,
        state: 'active',
        fencing_token: row.fencing_token,
        contender_seq: row.contender_seq,
      },
    };
  }

  function getActiveLease(workspace_ref: string): RecoveryLease | null {
    const row = database
      .prepare(
        "SELECT * FROM recovery_leases WHERE workspace_ref = ? AND state = 'active' ORDER BY fencing_token DESC LIMIT 1",
      )
      .get(workspace_ref) as
      | {
          lease_id: string;
          workspace_ref: string;
          holder_kind: LeaseHolder['kind'];
          holder_ref: string;
          acquired_at: string;
          expires_at: string;
          state: RecoveryLease['state'];
          fencing_token: number;
          contender_seq: number;
          record_version: number;
          created_at: string;
        }
      | undefined;
    if (!row) return null;
    return {
      workspace_ref: row.workspace_ref,
      lease_id: row.lease_id,
      holder:
        row.holder_kind === 'process'
          ? { kind: 'process' as const, process_ref: row.holder_ref }
          : row.holder_kind === 'operator'
            ? { kind: 'operator' as const, operator_ref: row.holder_ref }
            : { kind: 'agent' as const, agent_ref: row.holder_ref },
      acquired_at: row.acquired_at,
      expires_at: row.expires_at,
      state: row.state,
      fencing_token: row.fencing_token,
      contender_seq: row.contender_seq,
    };
  }

  function resolveDualContender(input: {
    workspace_ref: string;
    contender_a: { lease_id: string; holder: LeaseHolder };
    contender_b: { lease_id: string; holder: LeaseHolder };
  }):
    | { outcome: 'resolved'; verdict: DualContenderVerdict }
    | { outcome: 'rejected'; reason: string } {
    const rowA = database
      .prepare('SELECT * FROM recovery_leases WHERE lease_id = ?')
      .get(input.contender_a.lease_id) as
      | {
          lease_id: string;
          workspace_ref: string;
          holder_kind: LeaseHolder['kind'];
          holder_ref: string;
          acquired_at: string;
          fencing_token: number;
          contender_seq: number;
        }
      | undefined;
    const rowB = database
      .prepare('SELECT * FROM recovery_leases WHERE lease_id = ?')
      .get(input.contender_b.lease_id) as
      | {
          lease_id: string;
          workspace_ref: string;
          holder_kind: LeaseHolder['kind'];
          holder_ref: string;
          acquired_at: string;
          fencing_token: number;
          contender_seq: number;
        }
      | undefined;
    if (!rowA || !rowB) {
      return { outcome: 'rejected', reason: 'LEASE_NOT_FOUND' };
    }
    if (rowA.workspace_ref !== input.workspace_ref || rowB.workspace_ref !== input.workspace_ref) {
      return { outcome: 'rejected', reason: 'WORKSPACE_REF_MISMATCH' };
    }
    let winning: typeof rowA;
    let losing: typeof rowA;
    let decided_by: DualContenderVerdict['decided_by'];
    if (rowA.fencing_token !== rowB.fencing_token) {
      if (rowA.fencing_token > rowB.fencing_token) {
        winning = rowA;
        losing = rowB;
      } else {
        winning = rowB;
        losing = rowA;
      }
      decided_by = 'fencing_token';
    } else if (rowA.contender_seq !== rowB.contender_seq) {
      if (rowA.contender_seq > rowB.contender_seq) {
        winning = rowA;
        losing = rowB;
      } else {
        winning = rowB;
        losing = rowA;
      }
      decided_by = 'contender_seq';
    } else {
      // Deterministic tie-breaker: lexicographic comparison of acquired_at.
      if (rowA.acquired_at >= rowB.acquired_at) {
        winning = rowA;
        losing = rowB;
      } else {
        winning = rowB;
        losing = rowA;
      }
      decided_by = 'acquired_at';
    }
    const toHolder = (r: typeof rowA): LeaseHolder =>
      r.holder_kind === 'process'
        ? { kind: 'process' as const, process_ref: r.holder_ref }
        : r.holder_kind === 'operator'
          ? { kind: 'operator' as const, operator_ref: r.holder_ref }
          : { kind: 'agent' as const, agent_ref: r.holder_ref };
    // Transition the loser to 'preempted' so any further operation fails.
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(
          "UPDATE recovery_leases SET state = 'preempted', record_version = record_version + 1 WHERE lease_id = ?",
        )
        .run(losing.lease_id);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return {
      outcome: 'resolved',
      verdict: {
        workspace_ref: input.workspace_ref,
        winning_lease_id: winning.lease_id,
        winning_holder: toHolder(winning),
        losing_lease_id: losing.lease_id,
        losing_holder: toHolder(losing),
        decided_by,
        decided_at: new Date().toISOString(),
      },
    };
  }

  return {
    createCheckpoint,
    getLatestCheckpoint,
    acquireLease,
    releaseLease,
    renewLease,
    getActiveLease,
    resolveDualContender,
    close: () => {
      database.close();
    },
  };
}
