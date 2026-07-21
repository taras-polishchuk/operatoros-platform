import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import { publicContractVersion } from '@operatoros-platform/contracts';

export const packageName = '@operatoros-platform/execution-service' as const;

// Local structural types for the evidence-service surface used by this package.
// Kept inline (not imported) so the execution-service can be type-checked
// against an explicit contract before the evidence-service dist has been
// emitted. The actual runtime surface in @operatoros-platform/evidence-service
// is a superset of these methods.
export interface EvidenceService {
  openMissionRecord(input: {
    mission_record_ref: string;
    run_ref: string;
    created_event_id: string;
  }): unknown;
  commitMutation(request: {
    mutation_id: string;
    command_id: string;
    request_key: string;
    intent_digest: string;
    coordinator_component: 'workspace-service' | 'execution-service';
    aggregate_ref: string;
    expected_version: number;
    intended_record_version: number;
    record: Record<string, unknown>;
    events: {
      kind: 'event-record';
      state: 'recorded' | 'archived';
      entity_id: string;
      entity_schema_version: typeof publicContractVersion;
      workspace_ref: string;
      record_version: number;
      created_at: string;
      updated_at: string;
      event_id: string;
      event_type: string;
      schema_version: string;
      recorded_at: string;
      subject_identity_ref: string;
      aggregate_ref: string;
      aggregate_version: number;
      correlation_id: string;
      causation_id?: string;
      run_ref?: string;
      command_id?: string;
      payload: Record<string, unknown>;
      payload_digest: string;
      sensitivity_class:
        | 'public'
        | 'workspace-internal'
        | 'sensitive'
        | 'secret-reference'
        | 'prohibited-secret-value';
    }[];
    result: Record<string, unknown>;
    prepared_at: string;
  }):
    | {
        outcome: 'committed';
        aggregate_ref: string;
        record_version: number;
        evidence_refs: string[];
        result: Record<string, unknown>;
      }
    | {
        outcome: 'conflict';
        aggregate_ref: string;
        current_version: number;
        deciding_source: 'aggregate_records' | 'idempotency_results';
      };
  attachMissionRecordEvent(mission_record_ref: string, event_id: string): unknown;
  sealMissionRecord(input: {
    mission_record_ref: string;
    terminal_event_id: string;
    terminal_outcome: 'succeeded' | 'failed' | 'cancelled';
    referenced_artifact_refs: string[];
    pinned_policy_refs: string[];
    approver_refs: string[];
    predecessor_ref: string | null;
    sealed_by: string;
    result_digest: string;
    verification_summary: string;
  }): unknown;
}

export const SUPPORTED_OPERATIONS = [
  'mission.activate',
  'run.start',
  'run.transition',
  'run.cancel',
  'run.record-event',
  'mission-record.seal',
  'mission-record.correct',
] as const;

export const RUN_STATES = [
  'queued',
  'running',
  'paused',
  'interrupted',
  'recovering',
  'succeeded',
  'failed',
  'cancelled',
  'expired',
] as const;

export type RunState = (typeof RUN_STATES)[number];

export interface RunRecord {
  entity_id: string;
  run_ref: string;
  mission_ref: string;
  specification_ref: string;
  mission_record_ref: string;
  owning_operator_ref: string;
  owning_agent_ref: string;
  state: RunState;
  record_version: number;
  workspace_ref: string;
  updated_at: string;
  checkpoint_ref: string | null;
}

export type ExecutionResult<T = RunRecord> =
  | { outcome: 'committed'; record: T; record_version: number }
  | { outcome: 'rejected'; reason: string }
  | { outcome: 'conflict'; deciding_source: 'aggregate_records'; current_version: number };

const VALID_TRANSITIONS: Record<RunState, RunState[]> = {
  queued: ['running', 'cancelled', 'expired'],
  running: ['paused', 'interrupted', 'recovering', 'succeeded', 'failed', 'cancelled'],
  paused: ['running', 'cancelled'],
  interrupted: ['recovering', 'failed', 'cancelled'],
  recovering: ['running', 'failed', 'cancelled'],
  succeeded: [],
  failed: ['recovering'],
  cancelled: [],
  expired: [],
};

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

// Local digest for the startRun path: aligned with evidence-service's
// payload_digest (sha256 over canonical JSON). Evidence is the canonical
// source of record; this exists only because the startRun path constructs
// the first event idempotently before any other producer has run.
function digestPayload(value: unknown): string {
  return digest(value);
}

const SCHEMA_VERSION = publicContractVersion;

export interface CreateExecutionServiceOptions {
  databasePath: string;
  evidence: EvidenceService;
}

export function createSqliteExecutionStore(options: { databasePath: string }) {
  const database = new DatabaseSync(options.databasePath);
  database.exec(`
    CREATE TABLE IF NOT EXISTS mission_specifications (
      entity_id TEXT PRIMARY KEY,
      mission_ref TEXT NOT NULL,
      state TEXT NOT NULL,
      workspace_ref TEXT NOT NULL,
      record_version INTEGER NOT NULL,
      entity_schema_version TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS runs (
      entity_id TEXT PRIMARY KEY,
      run_ref TEXT NOT NULL,
      mission_ref TEXT NOT NULL,
      specification_ref TEXT NOT NULL,
      mission_record_ref TEXT NOT NULL,
      owning_operator_ref TEXT NOT NULL,
      owning_agent_ref TEXT NOT NULL,
      state TEXT NOT NULL,
      workspace_ref TEXT NOT NULL,
      record_version INTEGER NOT NULL,
      checkpoint_ref TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE UNIQUE INDEX IF NOT EXISTS runs_by_mission_record
      ON runs(mission_record_ref);

    CREATE INDEX IF NOT EXISTS runs_by_state
      ON runs(workspace_ref, state, updated_at DESC);
  `);

  function activateMission(input: {
    entity_id: string;
    mission_ref: string;
    workspace_ref: string;
    subject_identity_ref: string;
  }): ExecutionResult<{ entity_id: string; state: 'active'; mission_ref: string }> {
    const existing = database
      .prepare('SELECT record_version FROM mission_specifications WHERE entity_id = ?')
      .get(input.entity_id);
    if (existing !== undefined) {
      const row = existing as { record_version: number };
      return {
        outcome: 'conflict',
        deciding_source: 'aggregate_records',
        current_version: row.record_version,
      };
    }
    const now = new Date().toISOString();
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(`INSERT INTO mission_specifications VALUES (?, ?, 'active', ?, 1, ?, ?)`)
        .run(input.entity_id, input.mission_ref, input.workspace_ref, SCHEMA_VERSION, now);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return {
      outcome: 'committed',
      record_version: 1,
      record: { entity_id: input.entity_id, mission_ref: input.mission_ref, state: 'active' },
    };
  }

  function startRun(input: {
    entity_id: string;
    run_ref: string;
    mission_ref: string;
    specification_ref: string;
    owning_operator_ref: string;
    owning_agent_ref: string;
    workspace_ref: string;
  }): ExecutionResult {
    const existing = database
      .prepare('SELECT record_version, state FROM runs WHERE entity_id = ?')
      .get(input.entity_id) as { record_version: number; state: RunState } | undefined;
    if (existing !== undefined) {
      return {
        outcome: 'conflict',
        deciding_source: 'aggregate_records',
        current_version: existing.record_version,
      };
    }
    const now = new Date().toISOString();
    const missionRecordRef = `mission_record_${digest(input.run_ref)}`.slice(0, 60);
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(`INSERT INTO runs VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', ?, 1, NULL, ?, ?)`)
        .run(
          input.entity_id,
          input.run_ref,
          input.mission_ref,
          input.specification_ref,
          missionRecordRef,
          input.owning_operator_ref,
          input.owning_agent_ref,
          input.workspace_ref,
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
      record_version: 1,
      record: {
        entity_id: input.entity_id,
        run_ref: input.run_ref,
        mission_ref: input.mission_ref,
        specification_ref: input.specification_ref,
        mission_record_ref: missionRecordRef,
        owning_operator_ref: input.owning_operator_ref,
        owning_agent_ref: input.owning_agent_ref,
        state: 'queued',
        record_version: 1,
        workspace_ref: input.workspace_ref,
        updated_at: now,
        checkpoint_ref: null,
      },
    };
  }

  function transitionRun(input: {
    entity_id: string;
    expected_version: number;
    next_state: RunState;
  }): ExecutionResult {
    const row = database.prepare('SELECT * FROM runs WHERE entity_id = ?').get(input.entity_id) as
      { record_version: number; state: RunState } | undefined;
    if (!row) {
      return { outcome: 'conflict', deciding_source: 'aggregate_records', current_version: 0 };
    }
    if (row.record_version !== input.expected_version) {
      return {
        outcome: 'conflict',
        deciding_source: 'aggregate_records',
        current_version: row.record_version,
      };
    }
    if (!VALID_TRANSITIONS[row.state].includes(input.next_state)) {
      return {
        outcome: 'rejected',
        reason: `INVALID_TRANSITION: ${row.state} -> ${input.next_state}`,
      };
    }
    const now = new Date().toISOString();
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(
          `UPDATE runs SET state = ?, record_version = record_version + 1, updated_at = ? WHERE entity_id = ?`,
        )
        .run(input.next_state, now, input.entity_id);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    const fresh = database
      .prepare('SELECT * FROM runs WHERE entity_id = ?')
      .get(input.entity_id) as
      | {
          entity_id: string;
          run_ref: string;
          mission_ref: string;
          specification_ref: string;
          mission_record_ref: string;
          owning_operator_ref: string;
          owning_agent_ref: string;
          state: RunState;
          workspace_ref: string;
          record_version: number;
          checkpoint_ref: string | null;
          updated_at: string;
        }
      | undefined;
    if (!fresh) {
      return {
        outcome: 'conflict',
        deciding_source: 'aggregate_records',
        current_version: input.expected_version + 1,
      };
    }
    return {
      outcome: 'committed',
      record_version: input.expected_version + 1,
      record: {
        entity_id: fresh.entity_id,
        run_ref: fresh.run_ref,
        mission_ref: fresh.mission_ref,
        specification_ref: fresh.specification_ref,
        mission_record_ref: fresh.mission_record_ref,
        owning_operator_ref: fresh.owning_operator_ref,
        owning_agent_ref: fresh.owning_agent_ref,
        state: fresh.state,
        record_version: fresh.record_version,
        workspace_ref: fresh.workspace_ref,
        updated_at: fresh.updated_at,
        checkpoint_ref: fresh.checkpoint_ref,
      },
    };
  }

  function cancelRun(input: {
    entity_id: string;
    expected_version: number;
    reason: string;
  }): ExecutionResult {
    return transitionRun({
      entity_id: input.entity_id,
      expected_version: input.expected_version,
      next_state: 'cancelled',
    });
  }

  function attachCheckpoint(input: {
    entity_id: string;
    expected_version: number;
    checkpoint_ref: string;
  }): ExecutionResult {
    const rowVersion: number | undefined = (
      database
        .prepare('SELECT record_version FROM runs WHERE entity_id = ?')
        .get(input.entity_id) as { record_version: number } | undefined
    )?.record_version;
    if (!rowVersion || rowVersion !== input.expected_version) {
      return {
        outcome: 'conflict',
        deciding_source: 'aggregate_records',
        current_version: rowVersion ?? 0,
      };
    }
    const now = new Date().toISOString();
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(
          `UPDATE runs SET checkpoint_ref = ?, record_version = record_version + 1, updated_at = ? WHERE entity_id = ?`,
        )
        .run(input.checkpoint_ref, now, input.entity_id);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    const fresh = database
      .prepare('SELECT * FROM runs WHERE entity_id = ?')
      .get(input.entity_id) as
      | {
          entity_id: string;
          run_ref: string;
          mission_ref: string;
          specification_ref: string;
          mission_record_ref: string;
          owning_operator_ref: string;
          owning_agent_ref: string;
          state: RunState;
          workspace_ref: string;
          record_version: number;
          checkpoint_ref: string | null;
          updated_at: string;
        }
      | undefined;
    if (!fresh) {
      return { outcome: 'conflict', deciding_source: 'aggregate_records', current_version: 0 };
    }
    return {
      outcome: 'committed',
      record_version: input.expected_version + 1,
      record: {
        entity_id: fresh.entity_id,
        run_ref: fresh.run_ref,
        mission_ref: fresh.mission_ref,
        specification_ref: fresh.specification_ref,
        mission_record_ref: fresh.mission_record_ref,
        owning_operator_ref: fresh.owning_operator_ref,
        owning_agent_ref: fresh.owning_agent_ref,
        state: fresh.state,
        record_version: fresh.record_version,
        workspace_ref: fresh.workspace_ref,
        updated_at: fresh.updated_at,
        checkpoint_ref: fresh.checkpoint_ref,
      },
    };
  }

  function getRun(entity_id: string): RunRecord | null {
    const row = database.prepare('SELECT * FROM runs WHERE entity_id = ?').get(entity_id) as
      | {
          entity_id: string;
          run_ref: string;
          mission_ref: string;
          specification_ref: string;
          mission_record_ref: string;
          owning_operator_ref: string;
          owning_agent_ref: string;
          state: RunState;
          workspace_ref: string;
          record_version: number;
          checkpoint_ref: string | null;
          created_at: string;
          updated_at: string;
        }
      | undefined;
    if (!row) return null;
    return {
      entity_id: row.entity_id,
      run_ref: row.run_ref,
      mission_ref: row.mission_ref,
      specification_ref: row.specification_ref,
      mission_record_ref: row.mission_record_ref,
      owning_operator_ref: row.owning_operator_ref,
      owning_agent_ref: row.owning_agent_ref,
      state: row.state,
      record_version: row.record_version,
      workspace_ref: row.workspace_ref,
      updated_at: row.updated_at,
      checkpoint_ref: row.checkpoint_ref,
    };
  }

  return {
    activateMission,
    startRun,
    transitionRun,
    cancelRun,
    attachCheckpoint,
    getRun,
    close: () => {
      database.close();
    },
  };
}

export type ExecutionStore = ReturnType<typeof createSqliteExecutionStore>;

export function createExecutionService(options: CreateExecutionServiceOptions) {
  const store = createSqliteExecutionStore({ databasePath: options.databasePath });
  return {
    store,
    evidence: options.evidence,
    startRunWithMissionRecord(input: {
      entity_id: string;
      run_ref: string;
      mission_ref: string;
      specification_ref: string;
      owning_operator_ref: string;
      owning_agent_ref: string;
      workspace_ref: string;
    }): ExecutionResult {
      const started = store.startRun(input);
      if (started.outcome !== 'committed') return started;
      options.evidence.commitMutation({
        mutation_id: `mutation_open_${started.record.run_ref}`,
        command_id: 'cmd.run.create',
        request_key: `req_open_${started.record.run_ref}`,
        intent_digest: digest({ mission_record_ref: started.record.mission_record_ref }),
        coordinator_component: 'execution-service',
        aggregate_ref: started.record.run_ref,
        expected_version: 0,
        intended_record_version: 1,
        record: { run_ref: started.record.run_ref, state: 'queued' },
        events: [
          {
            kind: 'event-record',
            state: 'recorded',
            entity_id: `event_open_${started.record.run_ref}`,
            entity_schema_version: '1.0.0' as const,
            workspace_ref: 'workspace_main',
            record_version: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            event_id: `event_open_${started.record.run_ref}`,
            event_type: 'run.created',
            schema_version: '1.0.0',
            recorded_at: new Date().toISOString(),
            subject_identity_ref: 'identity://operator/taras',
            run_ref: started.record.run_ref,
            command_id: 'cmd.run.create',
            aggregate_ref: started.record.run_ref,
            aggregate_version: 1,
            correlation_id: `cor_open_${started.record.run_ref}`,
            payload: { state: 'queued' },
            payload_digest: digestPayload({ state: 'queued' }),
            sensitivity_class: 'workspace-internal',
          },
        ],
        result: {
          aggregate_ref: started.record.run_ref,
          record_version: 1,
          evidence_ref: `event_open_${started.record.run_ref}`,
        },
        prepared_at: new Date().toISOString(),
      });
      options.evidence.openMissionRecord({
        mission_record_ref: started.record.mission_record_ref,
        run_ref: started.record.run_ref,
        created_event_id: `event_open_${started.record.run_ref}`,
      });
      return started;
    },
    transitionWithEvent(input: {
      entity_id: string;
      expected_version: number;
      next_state: RunState;
      event: Parameters<EvidenceService['commitMutation']>[0]['events'][0] | null;
    }): ExecutionResult {
      const transitioned = store.transitionRun({
        entity_id: input.entity_id,
        expected_version: input.expected_version,
        next_state: input.next_state,
      });
      if (transitioned.outcome !== 'committed') return transitioned;
      if (input.event) {
        const run = store.getRun(input.entity_id);
        if (!run) {
          return { outcome: 'conflict', deciding_source: 'aggregate_records', current_version: 0 };
        }
        options.evidence.commitMutation({
          mutation_id: `mutation_${run.run_ref}_${String(run.record_version)}`,
          command_id: 'cmd.transition',
          request_key: `req_${run.run_ref}_${String(run.record_version)}`,
          intent_digest: digest({ run: run.run_ref, state: input.next_state }),
          coordinator_component: 'execution-service',
          aggregate_ref: run.run_ref,
          expected_version: input.expected_version,
          intended_record_version: input.expected_version + 1,
          events: [input.event],
          record: { run_ref: run.run_ref, state: input.next_state },
          result: {
            aggregate_ref: run.run_ref,
            record_version: run.record_version,
            evidence_ref: input.event.event_id,
          },
          prepared_at: new Date().toISOString(),
        });
      }
      return transitioned;
    },
    close: () => {
      store.close();
    },
  };
}

export function computeCheckpointDigest(payload: unknown): string {
  return digest(payload);
}
