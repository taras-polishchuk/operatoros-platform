import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { z } from 'zod';

import { eventRecordSchema, publicContractVersion } from '@operatoros-platform/contracts';

export const packageName = '@operatoros-platform/evidence-service' as const;

export type EvidenceEvent = z.infer<typeof eventRecordSchema>;

export interface MutationRequest {
  mutation_id: string;
  command_id: string;
  request_key: string;
  intent_digest: string;
  coordinator_component: 'workspace-service' | 'execution-service';
  aggregate_ref: string;
  expected_version: number;
  intended_record_version: number;
  record: Record<string, unknown>;
  events: EvidenceEvent[];
  result: Record<string, unknown>;
  prepared_at: string;
}

export type MutationResult =
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

interface MissionRecordInput {
  mission_record_ref: string;
  run_ref: string;
  created_event_id: string;
}

interface SealMissionRecordInput {
  mission_record_ref: string;
  terminal_event_id: string;
  terminal_outcome: 'succeeded' | 'failed' | 'cancelled';
  referenced_artifact_refs: string[];
  pinned_policy_refs: string[];
  result_digest: string;
  verification_summary: string;
}

interface EvidenceGapInput {
  finding_id: string;
  mission_record_ref: string;
  missing_evidence: string;
  impact: string;
  owner_ref: string;
  next_safe_action: string;
}

interface AggregateRecord {
  aggregate_ref: string;
  record_version: number;
  record: Record<string, unknown>;
}

interface MissionRecord {
  mission_record_ref: string;
  run_ref: string;
  state: 'open' | 'sealing' | 'sealed';
  supersedes_ref?: string;
  terminal_outcome?: string;
  integrity_digest?: string;
}

interface EnvelopeRecord {
  mutation_id: string;
  state: string;
  acknowledged_at: string | null;
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

function canonicalEventForDigest(item: EvidenceEvent): Record<string, unknown> {
  // Hash the event-level fields described by Architecture §5.3; entity-level
  // bookkeeping (entity_id, entity_schema_version, record_version, etc.) is
  // reconstructed from the same row at read time so the digest stays stable.
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item)) {
    if (
      key === 'entity_id' ||
      key === 'entity_schema_version' ||
      key === 'workspace_ref' ||
      key === 'record_version' ||
      key === 'created_at' ||
      key === 'updated_at' ||
      key === 'supersedes' ||
      key === 'kind'
    ) {
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function digestPayload(payload: unknown): string {
  return createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

function initialize(database: DatabaseSync): void {
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS aggregate_records (
      aggregate_ref TEXT PRIMARY KEY,
      record_version INTEGER NOT NULL,
      record_json TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS event_records (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      schema_version TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      subject_identity_ref TEXT NOT NULL,
      workspace_ref TEXT NOT NULL,
      run_ref TEXT,
      command_id TEXT,
      aggregate_ref TEXT NOT NULL,
      aggregate_version INTEGER NOT NULL,
      correlation_id TEXT NOT NULL,
      causation_id TEXT,
      payload_json TEXT NOT NULL,
      payload_digest TEXT NOT NULL,
      sensitivity_class TEXT NOT NULL,
      event_digest TEXT NOT NULL,
      event_json TEXT NOT NULL,
      UNIQUE(aggregate_ref, aggregate_version, event_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS events_by_aggregate
      ON event_records(aggregate_ref, aggregate_version, recorded_at, event_id);
    CREATE INDEX IF NOT EXISTS events_by_correlation
      ON event_records(correlation_id, recorded_at, event_id);
    CREATE TABLE IF NOT EXISTS idempotency_results (
      request_key TEXT PRIMARY KEY,
      intent_digest TEXT NOT NULL,
      aggregate_ref TEXT NOT NULL,
      record_version INTEGER NOT NULL,
      result_json TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS mutation_envelopes (
      mutation_id TEXT PRIMARY KEY,
      command_id TEXT NOT NULL,
      request_key TEXT NOT NULL,
      coordinator_component TEXT NOT NULL,
      aggregate_ref TEXT NOT NULL,
      expected_version INTEGER NOT NULL,
      intended_record_version INTEGER NOT NULL,
      required_event_ids_json TEXT NOT NULL,
      idempotency_result_digest TEXT NOT NULL,
      state TEXT NOT NULL,
      prepared_at TEXT NOT NULL,
      committed_at TEXT,
      acknowledged_at TEXT
    ) STRICT;
    CREATE TABLE IF NOT EXISTS mission_records (
      mission_record_ref TEXT PRIMARY KEY,
      run_ref TEXT NOT NULL UNIQUE,
      state TEXT NOT NULL,
      supersedes_ref TEXT UNIQUE,
      terminal_event_id TEXT,
      terminal_outcome TEXT,
      artifact_refs_json TEXT,
      pinned_policy_refs_json TEXT,
      result_digest TEXT,
      verification_summary TEXT,
      integrity_digest TEXT
    ) STRICT;
    CREATE TABLE IF NOT EXISTS mission_record_events (
      mission_record_ref TEXT NOT NULL,
      event_id TEXT NOT NULL,
      PRIMARY KEY(mission_record_ref, event_id),
      FOREIGN KEY(mission_record_ref) REFERENCES mission_records(mission_record_ref),
      FOREIGN KEY(event_id) REFERENCES event_records(event_id)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS evidence_findings (
      finding_id TEXT PRIMARY KEY,
      mission_record_ref TEXT NOT NULL,
      missing_evidence TEXT NOT NULL,
      impact TEXT NOT NULL,
      owner_ref TEXT NOT NULL,
      next_safe_action TEXT NOT NULL,
      state TEXT NOT NULL
    ) STRICT;
  `);
}

function mapEvent(row: Record<string, unknown>): EvidenceEvent {
  const storedSchemaVersion: unknown = row.schema_version;
  const schemaVersionValue =
    typeof storedSchemaVersion === 'string' || typeof storedSchemaVersion === 'number'
      ? String(storedSchemaVersion)
      : publicContractVersion;
  return eventRecordSchema.parse({
    kind: 'event-record',
    entity_id: row.event_id,
    entity_schema_version: publicContractVersion,
    workspace_ref:
      row.workspace_ref ?? `workspace_${String(row.aggregate_ref).split('_')[0] ?? '01'}`,
    record_version: 1,
    created_at: row.recorded_at,
    updated_at: row.recorded_at,
    state: 'recorded',
    event_id: row.event_id,
    event_type: row.event_type,
    schema_version: schemaVersionValue,
    recorded_at: row.recorded_at,
    subject_identity_ref: row.subject_identity_ref,
    run_ref: row.run_ref ?? undefined,
    command_id: row.command_id ?? undefined,
    aggregate_ref: row.aggregate_ref,
    aggregate_version: row.aggregate_version,
    correlation_id: row.correlation_id,
    causation_id: row.causation_id ?? undefined,
    payload: JSON.parse(String(row.payload_json)) as Record<string, unknown>,
    payload_digest: row.payload_digest,
    sensitivity_class: row.sensitivity_class,
  });
}

export function createSqliteEvidenceService(options: { databasePath: string }) {
  const database = new DatabaseSync(options.databasePath);
  initialize(database);
  let batchDepth = 0;

  function commitMutation(request: MutationRequest): MutationResult {
    const externalBatch = batchDepth > 0;
    const existing = database
      .prepare(
        'SELECT intent_digest, aggregate_ref, record_version, result_json FROM idempotency_results WHERE request_key = ?',
      )
      .get(request.request_key) as
      | {
          intent_digest: string;
          aggregate_ref: string;
          record_version: number;
          result_json: string;
        }
      | undefined;
    if (existing !== undefined) {
      if (existing.intent_digest !== request.intent_digest) {
        return {
          outcome: 'conflict',
          aggregate_ref: existing.aggregate_ref,
          current_version: existing.record_version,
          deciding_source: 'idempotency_results',
        };
      }
      return {
        outcome: 'committed',
        aggregate_ref: existing.aggregate_ref,
        record_version: existing.record_version,
        evidence_refs: request.events.map((item) => item.event_id),
        result: JSON.parse(existing.result_json) as Record<string, unknown>,
      };
    }

    const current = database
      .prepare('SELECT record_version FROM aggregate_records WHERE aggregate_ref = ?')
      .get(request.aggregate_ref) as { record_version: number } | undefined;
    const currentVersion = current?.record_version ?? 0;
    if (
      currentVersion !== request.expected_version ||
      request.intended_record_version !== currentVersion + 1
    ) {
      return {
        outcome: 'conflict',
        aggregate_ref: request.aggregate_ref,
        current_version: currentVersion,
        deciding_source: 'aggregate_records',
      };
    }

    const events = request.events.map((input) => {
      const parsed = eventRecordSchema.parse(input);
      if (digestPayload(parsed.payload) !== parsed.payload_digest) {
        throw new Error(`EVENT_PAYLOAD_DIGEST_MISMATCH: ${parsed.event_id}`);
      }
      if (parsed.aggregate_ref !== request.aggregate_ref) {
        throw new Error(`EVENT_AGGREGATE_MISMATCH: ${parsed.event_id}`);
      }
      if (parsed.aggregate_version !== request.intended_record_version) {
        throw new Error(`EVENT_AGGREGATE_VERSION_MISMATCH: ${parsed.event_id}`);
      }
      return parsed;
    });

    const now = new Date().toISOString();
    const useSavepoint = externalBatch;
    const savepointId = useSavepoint
      ? `sp_${String(Date.now())}_${String(Math.floor(Math.random() * 1e6))}`
      : null;
    if (useSavepoint && savepointId !== null) {
      database.exec(`SAVEPOINT ${savepointId}`);
    } else {
      database.exec('BEGIN IMMEDIATE');
    }
    try {
      database
        .prepare(
          `INSERT INTO mutation_envelopes (
            mutation_id, command_id, request_key, coordinator_component, aggregate_ref,
            expected_version, intended_record_version, required_event_ids_json,
            idempotency_result_digest, state, prepared_at, committed_at, acknowledged_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'prepared', NULL, NULL)`,
        )
        .run(
          request.mutation_id,
          request.command_id,
          request.request_key,
          request.coordinator_component,
          request.aggregate_ref,
          request.expected_version,
          request.intended_record_version,
          JSON.stringify(events.map((item) => item.event_id)),
          digestPayload(request.result),
          request.prepared_at,
        );
      database
        .prepare(
          `INSERT INTO aggregate_records VALUES (?, ?, ?)
           ON CONFLICT(aggregate_ref) DO UPDATE SET
             record_version = excluded.record_version,
             record_json = excluded.record_json`,
        )
        .run(
          request.aggregate_ref,
          request.intended_record_version,
          JSON.stringify(request.record),
        );
      const insertEvent: { run: (...args: unknown[]) => void } = database.prepare(
        `INSERT INTO event_records VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ) as never;
      for (const item of events) {
        const eventDigest = digestPayload(canonicalEventForDigest(item));
        insertEvent.run(
          item.event_id,
          item.event_type,
          item.schema_version,
          item.recorded_at,
          item.subject_identity_ref,
          item.workspace_ref,
          item.run_ref ?? null,
          item.command_id ?? null,
          item.aggregate_ref,
          item.aggregate_version,
          item.correlation_id,
          item.causation_id ?? null,
          JSON.stringify(item.payload),
          item.payload_digest,
          item.sensitivity_class,
          eventDigest,
          JSON.stringify(item),
        );
      }
      database
        .prepare('INSERT INTO idempotency_results VALUES (?, ?, ?, ?, ?)')
        .run(
          request.request_key,
          request.intent_digest,
          request.aggregate_ref,
          request.intended_record_version,
          JSON.stringify(request.result),
        );
      database
        .prepare(
          `UPDATE mutation_envelopes
           SET state = 'committed', committed_at = ?
           WHERE mutation_id = ?`,
        )
        .run(now, request.mutation_id);
      if (useSavepoint && savepointId !== null) {
        database.exec(`RELEASE SAVEPOINT ${savepointId}`);
      } else {
        database.exec('COMMIT');
      }
    } catch (error) {
      if (useSavepoint && savepointId !== null) {
        database.exec(`ROLLBACK TO SAVEPOINT ${savepointId}`);
        database.exec(`RELEASE SAVEPOINT ${savepointId}`);
      } else {
        database.exec('ROLLBACK');
      }
      throw error;
    }
    database
      .prepare(
        `UPDATE mutation_envelopes
         SET state = 'acknowledged', acknowledged_at = ?
         WHERE mutation_id = ?`,
      )
      .run(new Date().toISOString(), request.mutation_id);
    return {
      outcome: 'committed',
      aggregate_ref: request.aggregate_ref,
      record_version: request.intended_record_version,
      evidence_refs: events.map((item) => item.event_id),
      result: request.result,
    };
  }

  function getAggregate(aggregateRef: string): AggregateRecord | null {
    const row = database
      .prepare(
        'SELECT aggregate_ref, record_version, record_json FROM aggregate_records WHERE aggregate_ref = ?',
      )
      .get(aggregateRef) as
      { aggregate_ref: string; record_version: number; record_json: string } | undefined;
    if (row === undefined) return null;
    return {
      aggregate_ref: row.aggregate_ref,
      record_version: row.record_version,
      record: JSON.parse(row.record_json) as Record<string, unknown>,
    };
  }

  function queryAggregateEvents(aggregateRef: string): EvidenceEvent[] {
    return (
      database
        .prepare(
          `SELECT * FROM event_records
           WHERE aggregate_ref = ?
           ORDER BY aggregate_version, recorded_at, event_id`,
        )
        .all(aggregateRef) as Record<string, unknown>[]
    ).map(mapEvent);
  }

  function traceCorrelation(correlationId: string): EvidenceEvent[] {
    return (
      database
        .prepare(
          `SELECT * FROM event_records
           WHERE correlation_id = ?
           ORDER BY recorded_at, event_id`,
        )
        .all(correlationId) as Record<string, unknown>[]
    ).map(mapEvent);
  }

  function inspectEnvelope(mutationId: string): EnvelopeRecord | null {
    const row = database
      .prepare(
        'SELECT mutation_id, state, acknowledged_at FROM mutation_envelopes WHERE mutation_id = ?',
      )
      .get(mutationId) as unknown as EnvelopeRecord | undefined;
    return row ?? null;
  }

  function openMissionRecord(input: MissionRecordInput): MissionRecord {
    const existing = database
      .prepare('SELECT mission_record_ref FROM mission_records WHERE run_ref = ?')
      .get(input.run_ref);
    if (existing !== undefined) throw new Error('MISSION_RECORD_ALREADY_EXISTS');
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(
          'INSERT INTO mission_records (mission_record_ref, run_ref, state) VALUES (?, ?, ?)',
        )
        .run(input.mission_record_ref, input.run_ref, 'open');
      database
        .prepare('INSERT INTO mission_record_events VALUES (?, ?)')
        .run(input.mission_record_ref, input.created_event_id);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return { mission_record_ref: input.mission_record_ref, run_ref: input.run_ref, state: 'open' };
  }

  function getMissionRecord(reference: string): MissionRecord | null {
    return (
      (database
        .prepare(
          `SELECT mission_record_ref, run_ref, state, supersedes_ref,
                  terminal_outcome, integrity_digest
           FROM mission_records WHERE mission_record_ref = ?`,
        )
        .get(reference) as unknown as MissionRecord | undefined) ?? null
    );
  }

  function attachMissionRecordEvent(reference: string, eventId: string): void {
    const record = getMissionRecord(reference);
    if (record === null) throw new Error('MISSION_RECORD_NOT_FOUND');
    if (record.state === 'sealed') throw new Error('MISSION_RECORD_APPEND_CLOSED');
    database
      .prepare('INSERT OR IGNORE INTO mission_record_events VALUES (?, ?)')
      .run(reference, eventId);
  }

  function sealMissionRecord(
    input: SealMissionRecordInput,
  ):
    | { outcome: 'sealed'; integrity_digest: string }
    | { outcome: 'evidence-gap'; missing_evidence: string[] } {
    const record = getMissionRecord(input.mission_record_ref);
    if (record === null) throw new Error('MISSION_RECORD_NOT_FOUND');
    if (record.state === 'sealed') throw new Error('MISSION_RECORD_ALREADY_SEALED');
    const terminal = database
      .prepare('SELECT event_id FROM event_records WHERE event_id = ?')
      .get(input.terminal_event_id);
    if (terminal === undefined) {
      return { outcome: 'evidence-gap', missing_evidence: [input.terminal_event_id] };
    }
    attachMissionRecordEvent(input.mission_record_ref, input.terminal_event_id);
    const eventIds = (
      database
        .prepare(
          'SELECT event_id FROM mission_record_events WHERE mission_record_ref = ? ORDER BY event_id',
        )
        .all(input.mission_record_ref) as { event_id: string }[]
    ).map((row) => row.event_id);
    const integrityDigest = digestPayload({
      mission_record_ref: input.mission_record_ref,
      run_ref: record.run_ref,
      terminal_event_id: input.terminal_event_id,
      terminal_outcome: input.terminal_outcome,
      event_ids: eventIds,
      referenced_artifact_refs: [...input.referenced_artifact_refs].sort(),
      pinned_policy_refs: [...input.pinned_policy_refs].sort(),
      result_digest: input.result_digest,
      verification_summary: input.verification_summary,
    });
    database
      .prepare(
        `UPDATE mission_records SET
          state = 'sealed', terminal_event_id = ?, terminal_outcome = ?,
          artifact_refs_json = ?, pinned_policy_refs_json = ?, result_digest = ?,
          verification_summary = ?, integrity_digest = ?
         WHERE mission_record_ref = ?`,
      )
      .run(
        input.terminal_event_id,
        input.terminal_outcome,
        JSON.stringify(input.referenced_artifact_refs),
        JSON.stringify(input.pinned_policy_refs),
        input.result_digest,
        input.verification_summary,
        integrityDigest,
        input.mission_record_ref,
      );
    return { outcome: 'sealed', integrity_digest: integrityDigest };
  }

  function createCorrectionSuccessor(input: {
    predecessor_ref: string;
    successor_ref: string;
  }): MissionRecord {
    const predecessor = getMissionRecord(input.predecessor_ref);
    if (predecessor?.state !== 'sealed') {
      throw new Error('CORRECTION_PREDECESSOR_NOT_SEALED');
    }
    database
      .prepare(
        `INSERT INTO mission_records
          (mission_record_ref, run_ref, state, supersedes_ref)
         VALUES (?, ?, 'open', ?)`,
      )
      .run(
        input.successor_ref,
        `${predecessor.run_ref}:correction:${input.successor_ref}`,
        input.predecessor_ref,
      );
    return {
      mission_record_ref: input.successor_ref,
      run_ref: `${predecessor.run_ref}:correction:${input.successor_ref}`,
      state: 'open',
      supersedes_ref: input.predecessor_ref,
    };
  }

  function recordEvidenceGap(input: EvidenceGapInput): void {
    database
      .prepare('INSERT INTO evidence_findings VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(
        input.finding_id,
        input.mission_record_ref,
        input.missing_evidence,
        input.impact,
        input.owner_ref,
        input.next_safe_action,
        'unresolved',
      );
  }

  function rebuildProjections() {
    const runTimelines = database
      .prepare(
        `SELECT mr.run_ref, mr.mission_record_ref, mr.state,
                GROUP_CONCAT(mre.event_id, ',') AS event_ids
         FROM mission_records mr
         LEFT JOIN mission_record_events mre
           ON mre.mission_record_ref = mr.mission_record_ref
         GROUP BY mr.mission_record_ref
         ORDER BY mr.run_ref`,
      )
      .all();
    const auditEntries = database
      .prepare(
        `SELECT event_id, event_type, subject_identity_ref, workspace_ref,
                run_ref, command_id, correlation_id, recorded_at
         FROM event_records ORDER BY recorded_at, event_id`,
      )
      .all();
    return { run_timelines: runTimelines, audit_entries: auditEntries };
  }

  function getHealth() {
    const unresolved = (
      database
        .prepare("SELECT COUNT(*) AS count FROM evidence_findings WHERE state = 'unresolved'")
        .get() as { count: number }
    ).count;
    return {
      authoritative_status: unresolved > 0 ? 'unresolved' : 'healthy',
      projection_status: 'healthy',
      unresolved_evidence_gaps: unresolved,
      deciding_source: unresolved > 0 ? 'evidence_findings' : 'authoritative_evidence',
    };
  }

  function verifyIntegrity(): { valid: boolean; failures: string[] } {
    const failures: string[] = [];
    const events = database
      .prepare('SELECT * FROM event_records ORDER BY event_id')
      .all() as Record<string, unknown>[];
    for (const row of events) {
      const mapped = JSON.parse(String(row.event_json)) as EvidenceEvent;
      if (digestPayload(mapped.payload) !== mapped.payload_digest) {
        failures.push(`${mapped.event_id}: payload digest mismatch`);
      }
      if (digestPayload(canonicalEventForDigest(mapped)) !== row.event_digest) {
        failures.push(`${mapped.event_id}: event digest mismatch`);
      }
    }
    const sealed = database
      .prepare("SELECT * FROM mission_records WHERE state = 'sealed' ORDER BY mission_record_ref")
      .all() as Record<string, unknown>[];
    for (const row of sealed) {
      const eventIds = (
        database
          .prepare(
            'SELECT event_id FROM mission_record_events WHERE mission_record_ref = ? ORDER BY event_id',
          )
          .all(String(row.mission_record_ref)) as { event_id: string }[]
      ).map((item) => item.event_id);
      const calculated = digestPayload({
        mission_record_ref: row.mission_record_ref,
        run_ref: row.run_ref,
        terminal_event_id: row.terminal_event_id,
        terminal_outcome: row.terminal_outcome,
        event_ids: eventIds,
        referenced_artifact_refs: (JSON.parse(String(row.artifact_refs_json)) as string[])
          .slice()
          .sort(),
        pinned_policy_refs: (JSON.parse(String(row.pinned_policy_refs_json)) as string[])
          .slice()
          .sort(),
        result_digest: row.result_digest,
        verification_summary: row.verification_summary,
      });
      if (calculated !== row.integrity_digest) {
        failures.push(`${String(row.mission_record_ref)}: Mission Record integrity mismatch`);
      }
    }
    return { valid: failures.length === 0, failures };
  }

  return {
    commitMutation,
    getAggregate,
    queryAggregateEvents,
    traceCorrelation,
    inspectEnvelope,
    openMissionRecord,
    getMissionRecord,
    attachMissionRecordEvent,
    sealMissionRecord,
    createCorrectionSuccessor,
    recordEvidenceGap,
    rebuildProjections,
    getHealth,
    verifyIntegrity,
    openBatch: () => {
      if (batchDepth === 0) database.exec('BEGIN IMMEDIATE');
      batchDepth += 1;
    },
    closeBatch: () => {
      if (batchDepth === 0) return;
      batchDepth -= 1;
      if (batchDepth === 0) database.exec('COMMIT');
    },
    abortBatch: () => {
      if (batchDepth === 0) return;
      batchDepth = 0;
      database.exec('ROLLBACK');
    },
    close: () => {
      database.close();
    },
  };
}
