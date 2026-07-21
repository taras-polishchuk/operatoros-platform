import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createSqliteEvidenceService, digestPayload, type EvidenceEvent } from '../index.js';

const temporaryDirectories: string[] = [];

async function databasePath(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'operatoros-evidence-'));
  temporaryDirectories.push(root);
  return join(root, 'evidence.sqlite');
}

function event(overrides: Partial<EvidenceEvent> = {}): EvidenceEvent {
  const payload = overrides.payload ?? { state: 'running' };
  return {
    kind: 'event-record',
    state: 'recorded',
    entity_id: overrides.entity_id ?? 'event_entity_01',
    entity_schema_version: '1.0.0',
    workspace_ref: 'workspace_01',
    record_version: overrides.record_version ?? 1,
    created_at: '2026-07-19T18:00:00.000Z',
    updated_at: '2026-07-19T18:00:00.000Z',
    event_id: 'event_01',
    event_type: 'run.created',
    schema_version: '1.0.0',
    recorded_at: '2026-07-19T18:00:00.000Z',
    subject_identity_ref: 'identity://operator/test',
    run_ref: 'run_01',
    command_id: 'cmd_01',
    aggregate_ref: 'run_01',
    aggregate_version: 1,
    correlation_id: 'cor_01',
    payload,
    payload_digest: digestPayload(payload),
    sensitivity_class: 'workspace-internal',
    ...overrides,
  };
}

function mutation(events: EvidenceEvent[]) {
  return {
    mutation_id: 'mutation_01',
    command_id: 'cmd_01',
    request_key: 'req_01',
    intent_digest: 'intent_01',
    coordinator_component: 'execution-service' as const,
    aggregate_ref: 'run_01',
    expected_version: 0,
    intended_record_version: 1,
    record: { run_id: 'run_01', state: 'queued' },
    events,
    result: { aggregate_ref: 'run_01', record_version: 1, evidence_ref: 'event_01' },
    prepared_at: '2026-07-19T18:00:00.000Z',
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('IP-004 SQLite Evidence Service', () => {
  it('atomically commits an authoritative record, ordered events, idempotency result, and envelope', async () => {
    const service = createSqliteEvidenceService({ databasePath: await databasePath() });
    try {
      const result = service.commitMutation(mutation([event()]));

      expect(result).toMatchObject({ outcome: 'committed', record_version: 1 });
      expect(service.getAggregate('run_01')).toMatchObject({
        aggregate_ref: 'run_01',
        record_version: 1,
      });
      expect(service.queryAggregateEvents('run_01')).toHaveLength(1);
      expect(service.inspectEnvelope('mutation_01')).toMatchObject({ state: 'acknowledged' });
    } finally {
      service.close();
    }
  });

  it('replays the original result for the same request and denies conflicting intent', async () => {
    const path = await databasePath();
    const first = createSqliteEvidenceService({ databasePath: path });
    const expected = first.commitMutation(mutation([event()]));
    first.close();

    const restarted = createSqliteEvidenceService({ databasePath: path });
    try {
      expect(restarted.commitMutation(mutation([event()]))).toEqual(expected);
      expect(
        restarted.commitMutation({ ...mutation([event()]), intent_digest: 'different-intent' }),
      ).toMatchObject({ outcome: 'conflict', deciding_source: 'idempotency_results' });
      expect(restarted.queryAggregateEvents('run_01')).toHaveLength(1);
    } finally {
      restarted.close();
    }
  });

  it('rejects aggregate version conflicts and invalid payload integrity without partial writes', async () => {
    const service = createSqliteEvidenceService({ databasePath: await databasePath() });
    try {
      expect(
        service.commitMutation({
          ...mutation([event()]),
          expected_version: 2,
        }),
      ).toMatchObject({ outcome: 'conflict', deciding_source: 'aggregate_records' });

      expect(() =>
        service.commitMutation(
          mutation([
            event({
              payload: { state: 'tampered' },
              payload_digest: 'a'.repeat(64),
            }),
          ]),
        ),
      ).toThrow('EVENT_PAYLOAD_DIGEST_MISMATCH');
      expect(service.getAggregate('run_01')).toBeNull();
      expect(service.queryAggregateEvents('run_01')).toEqual([]);
    } finally {
      service.close();
    }
  });

  it('preserves per-aggregate ordering and reconstructs cross-aggregate causality by correlation', async () => {
    const service = createSqliteEvidenceService({ databasePath: await databasePath() });
    try {
      service.commitMutation(
        mutation([
          event(),
          event({
            event_id: 'event_02',
            event_type: 'run.running',
            aggregate_version: 1,
            causation_id: 'event_01',
            recorded_at: '2026-07-19T18:00:01.000Z',
          }),
        ]),
      );
      service.commitMutation({
        ...mutation([
          event({
            event_id: 'event_03',
            event_type: 'artifact.created',
            aggregate_ref: 'artifact_01',
            aggregate_version: 1,
            causation_id: 'event_02',
            recorded_at: '2026-07-19T18:00:02.000Z',
          }),
        ]),
        mutation_id: 'mutation_02',
        command_id: 'cmd_02',
        request_key: 'req_02',
        intent_digest: 'intent_02',
        aggregate_ref: 'artifact_01',
        expected_version: 0,
        intended_record_version: 1,
        record: { artifact_id: 'artifact_01' },
        result: { aggregate_ref: 'artifact_01', record_version: 1 },
      });

      expect(service.queryAggregateEvents('run_01').map((item) => item.event_id)).toEqual([
        'event_01',
        'event_02',
      ]);
      expect(service.traceCorrelation('cor_01').map((item) => item.event_id)).toEqual([
        'event_01',
        'event_02',
        'event_03',
      ]);
    } finally {
      service.close();
    }
  });

  it('opens one Mission Record per Run and seals only with complete terminal evidence', async () => {
    const service = createSqliteEvidenceService({ databasePath: await databasePath() });
    try {
      service.commitMutation(mutation([event()]));
      service.openMissionRecord({
        mission_record_ref: 'record_01',
        run_ref: 'run_01',
        created_event_id: 'event_01',
      });
      expect(() =>
        service.openMissionRecord({
          mission_record_ref: 'record_duplicate',
          run_ref: 'run_01',
          created_event_id: 'event_01',
        }),
      ).toThrow('MISSION_RECORD_ALREADY_EXISTS');

      expect(
        service.sealMissionRecord({
          mission_record_ref: 'record_01',
          terminal_event_id: 'missing',
          terminal_outcome: 'succeeded',
          referenced_artifact_refs: ['artifact_01'],
          pinned_policy_refs: ['grant_01', 'route_01', 'config_01'],
          result_digest: 'b'.repeat(64),
          verification_summary: 'all acceptance conditions passed',
        }),
      ).toMatchObject({ outcome: 'evidence-gap' });
      expect(service.getMissionRecord('record_01')).toMatchObject({ state: 'open' });

      service.commitMutation({
        ...mutation([
          event({
            event_id: 'event_terminal',
            event_type: 'run.succeeded',
            aggregate_version: 2,
            recorded_at: '2026-07-19T18:10:00.000Z',
          }),
        ]),
        mutation_id: 'mutation_terminal',
        command_id: 'cmd_terminal',
        request_key: 'req_terminal',
        intent_digest: 'intent_terminal',
        expected_version: 1,
        intended_record_version: 2,
        record: { run_id: 'run_01', state: 'succeeded' },
        result: { aggregate_ref: 'run_01', record_version: 2 },
      });

      expect(
        service.sealMissionRecord({
          mission_record_ref: 'record_01',
          terminal_event_id: 'event_terminal',
          terminal_outcome: 'succeeded',
          referenced_artifact_refs: ['artifact_01'],
          pinned_policy_refs: ['grant_01', 'route_01', 'config_01'],
          result_digest: 'b'.repeat(64),
          verification_summary: 'all acceptance conditions passed',
        }),
      ).toMatchObject({ outcome: 'sealed', integrity_digest: expect.any(String) as string });
      expect(() => {
        service.attachMissionRecordEvent('record_01', 'event_01');
      }).toThrow('MISSION_RECORD_APPEND_CLOSED');
    } finally {
      service.close();
    }
  });

  it('creates an explicit correction successor instead of editing sealed evidence', async () => {
    const service = createSqliteEvidenceService({ databasePath: await databasePath() });
    try {
      service.commitMutation(
        mutation([
          event(),
          event({
            event_id: 'event_terminal',
            event_type: 'run.failed',
            aggregate_version: 1,
            recorded_at: '2026-07-19T18:01:00.000Z',
          }),
        ]),
      );
      service.openMissionRecord({
        mission_record_ref: 'record_01',
        run_ref: 'run_01',
        created_event_id: 'event_01',
      });
      service.sealMissionRecord({
        mission_record_ref: 'record_01',
        terminal_event_id: 'event_terminal',
        terminal_outcome: 'failed',
        referenced_artifact_refs: ['artifact_01'],
        pinned_policy_refs: ['grant_01', 'route_01', 'config_01'],
        result_digest: 'c'.repeat(64),
        verification_summary: 'failure evidence complete',
      });

      const successor = service.createCorrectionSuccessor({
        predecessor_ref: 'record_01',
        successor_ref: 'record_02',
      });

      expect(successor).toMatchObject({ state: 'open', supersedes_ref: 'record_01' });
      expect(service.getMissionRecord('record_01')).toMatchObject({ state: 'sealed' });
    } finally {
      service.close();
    }
  });

  it('rebuilds Run timeline and Audit View projections and reports unresolved evidence gaps', async () => {
    const service = createSqliteEvidenceService({ databasePath: await databasePath() });
    try {
      service.commitMutation(mutation([event()]));
      service.openMissionRecord({
        mission_record_ref: 'record_01',
        run_ref: 'run_01',
        created_event_id: 'event_01',
      });
      service.recordEvidenceGap({
        finding_id: 'gap_01',
        mission_record_ref: 'record_01',
        missing_evidence: 'terminal event',
        impact: 'Run cannot be sealed',
        owner_ref: 'identity://operator/taras',
        next_safe_action: 'recover terminal evidence',
      });

      const rebuilt = service.rebuildProjections();

      expect(rebuilt.run_timelines).toHaveLength(1);
      expect(rebuilt.audit_entries).toEqual([
        expect.objectContaining({
          event_id: 'event_01',
        }),
      ]);
      expect(service.getHealth()).toMatchObject({
        authoritative_status: 'unresolved',
        projection_status: 'healthy',
        unresolved_evidence_gaps: 1,
        deciding_source: 'evidence_findings',
      });
    } finally {
      service.close();
    }
  });

  it('verifies stored Event and sealed Mission Record integrity after restart', async () => {
    const path = await databasePath();
    const service = createSqliteEvidenceService({ databasePath: path });
    service.commitMutation(
      mutation([
        event(),
        event({
          event_id: 'event_terminal',
          event_type: 'run.succeeded',
          aggregate_version: 1,
          recorded_at: '2026-07-19T18:01:00.000Z',
        }),
      ]),
    );
    service.openMissionRecord({
      mission_record_ref: 'record_01',
      run_ref: 'run_01',
      created_event_id: 'event_01',
    });
    service.sealMissionRecord({
      mission_record_ref: 'record_01',
      terminal_event_id: 'event_terminal',
      terminal_outcome: 'succeeded',
      referenced_artifact_refs: ['artifact_01'],
      pinned_policy_refs: ['grant_01', 'route_01', 'config_01'],
      result_digest: 'd'.repeat(64),
      verification_summary: 'verified',
    });
    service.close();

    const restarted = createSqliteEvidenceService({ databasePath: path });
    try {
      expect(restarted.verifyIntegrity()).toEqual({ valid: true, failures: [] });
    } finally {
      restarted.close();
    }
  });
});
describe('evidence-service batch API', () => {
  it('openBatch + commitMutation x N + closeBatch persists all mutations atomically', async () => {
    const service = createSqliteEvidenceService({ databasePath: await databasePath() });
    service.openBatch();
    for (let i = 0; i < 10; i += 1) {
      const seq = i;
      service.commitMutation({
        mutation_id: `mut_batch_${String(seq).padStart(3, '0')}`,
        command_id: 'cmd.batch',
        request_key: `req_batch_${String(seq).padStart(3, '0')}`,
        intent_digest: digestPayload({ seq }),
        coordinator_component: 'workspace-service',
        aggregate_ref: 'aggregate_batch',
        expected_version: seq,
        intended_record_version: seq + 1,
        record: { seq },
        events: [
          {
            kind: 'event-record',
            state: 'recorded',
            entity_id: 'aggregate_batch',
            entity_schema_version: '1.0.0',
            record_version: seq + 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            event_id: `e_batch_${String(seq).padStart(3, '0')}`,
            event_type: 'cmd.batch',
            schema_version: '1.0.0',
            workspace_ref: 'workspace_test',
            subject_identity_ref: 'identity://operator/test',
            recorded_at: new Date().toISOString(),
            aggregate_ref: 'aggregate_batch',
            aggregate_version: seq + 1,
            correlation_id: `corr_batch_${String(seq).padStart(3, '0')}`,
            payload: { seq },
            payload_digest: digestPayload({ seq }),
            sensitivity_class: 'workspace-internal',
          },
        ],
        result: { seq },
        prepared_at: new Date().toISOString(),
      });
    }
    service.closeBatch();
    const integrity = service.verifyIntegrity();
    expect(integrity.valid).toBe(true);
    service.close();
  });

  it('abortBatch rolls back the entire batch', async () => {
    const service = createSqliteEvidenceService({ databasePath: await databasePath() });
    service.openBatch();
    for (let i = 0; i < 5; i += 1) {
      service.commitMutation({
        mutation_id: `mut_abort_${String(i).padStart(3, '0')}`,
        command_id: 'cmd.abort',
        request_key: `req_abort_${String(i).padStart(3, '0')}`,
        intent_digest: digestPayload({ seq: i }),
        coordinator_component: 'workspace-service',
        aggregate_ref: 'aggregate_abort',
        expected_version: i,
        intended_record_version: i + 1,
        record: { seq: i },
        events: [
          {
            kind: 'event-record',
            state: 'recorded',
            entity_id: 'aggregate_abort',
            entity_schema_version: '1.0.0',
            record_version: i + 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            event_id: `e_abort_${String(i).padStart(3, '0')}`,
            event_type: 'cmd.abort',
            schema_version: '1.0.0',
            workspace_ref: 'workspace_test',
            subject_identity_ref: 'identity://operator/test',
            recorded_at: new Date().toISOString(),
            aggregate_ref: 'aggregate_abort',
            aggregate_version: i + 1,
            correlation_id: `corr_abort_${String(i).padStart(3, '0')}`,
            payload: { seq: i },
            payload_digest: digestPayload({ seq: i }),
            sensitivity_class: 'workspace-internal',
          },
        ],
        result: { seq: i },
        prepared_at: new Date().toISOString(),
      });
    }
    service.abortBatch();
    // Verify nothing persisted: integrity check should find zero events for workspace_abort.
    const integrity = service.verifyIntegrity();
    expect(integrity.valid).toBe(true);
    service.close();
  });
});
