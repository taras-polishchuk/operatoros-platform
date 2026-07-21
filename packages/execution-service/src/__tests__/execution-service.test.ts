import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createExecutionService } from '../index.js';
import { digestPayload } from '@operatoros-platform/evidence-service';

interface MockEvidence {
  commitCalls: number;
  openCalls: number;
  sealedRecord: { mission_record_ref: string; outcome: string } | null;
}

async function makeServiceWithEvidence() {
  const root = await mkdtemp(join(tmpdir(), 'operatoros-exec-'));
  const evidencePath = join(root, 'evidence.sqlite');
  const execPath = join(root, 'exec.sqlite');
  const evidenceModule = await import('@operatoros-platform/evidence-service');
  const evidence = evidenceModule.createSqliteEvidenceService({ databasePath: evidencePath });
  const mock: MockEvidence = { commitCalls: 0, openCalls: 0, sealedRecord: null };
  const wrapped = {
    ...evidence,
    openMissionRecord: (input: Parameters<typeof evidence.openMissionRecord>[0]) => {
      mock.openCalls += 1;
      return evidence.openMissionRecord(input);
    },
    commitMutation: (request: Parameters<typeof evidence.commitMutation>[0]) => {
      mock.commitCalls += 1;
      return evidence.commitMutation(request);
    },
    sealMissionRecord: (input: Parameters<typeof evidence.sealMissionRecord>[0]): unknown => {
      mock.sealedRecord = {
        mission_record_ref: input.mission_record_ref,
        outcome: input.terminal_outcome,
      };
      return evidence.sealMissionRecord(input);
    },
  };
  const service = createExecutionService({ databasePath: execPath, evidence: wrapped });
  return {
    service,
    evidence,
    mock,
    cleanup: async () => {
      service.close();
      evidence.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

const tempDirectories: string[] = [];

beforeEach(() => {
  tempDirectories.length = 0;
});

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe('IP-007 Execution Service', () => {
  it('activates a mission specification exactly once', async () => {
    const ctx = await makeServiceWithEvidence();
    const first = ctx.service.store.activateMission({
      entity_id: 'mission_spec_01',
      mission_ref: 'mission_01',
      workspace_ref: 'workspace_main',
      subject_identity_ref: 'identity://operator/taras',
    });
    expect(first.outcome).toBe('committed');
    if (first.outcome === 'committed') {
      expect(first.record_version).toBe(1);
      expect(first.record.state).toBe('active');
    }
    const dup = ctx.service.store.activateMission({
      entity_id: 'mission_spec_01',
      mission_ref: 'mission_01',
      workspace_ref: 'workspace_main',
      subject_identity_ref: 'identity://operator/taras',
    });
    expect(dup).toMatchObject({ outcome: 'conflict' });
    await ctx.cleanup();
  });

  it('starts a run, opens a mission record, and transitions states with optimistic concurrency', async () => {
    const ctx = await makeServiceWithEvidence();
    ctx.service.store.activateMission({
      entity_id: 'mission_spec_01',
      mission_ref: 'mission_01',
      workspace_ref: 'workspace_main',
      subject_identity_ref: 'identity://operator/taras',
    });
    const started = ctx.service.startRunWithMissionRecord({
      entity_id: 'run_01',
      run_ref: 'run_01',
      mission_ref: 'mission_01',
      specification_ref: 'mission_spec_01',
      owning_operator_ref: 'identity://operator/taras',
      owning_agent_ref: 'agent://build-agent/01',
      workspace_ref: 'workspace_main',
    });
    expect(started.outcome).toBe('committed');
    expect(ctx.mock.openCalls).toBe(1);
    if (started.outcome !== 'committed') {
      throw new Error('expected committed');
    }

    const toRunning = ctx.service.store.transitionRun({
      entity_id: 'run_01',
      expected_version: 1,
      next_state: 'running',
    });
    expect(toRunning).toMatchObject({ outcome: 'committed' });

    const wrong = ctx.service.store.transitionRun({
      entity_id: 'run_01',
      expected_version: 99,
      next_state: 'paused',
    });
    expect(wrong).toMatchObject({ outcome: 'conflict' });

    const toPaused = ctx.service.store.transitionRun({
      entity_id: 'run_01',
      expected_version: 2,
      next_state: 'paused',
    });
    expect(toPaused).toMatchObject({ outcome: 'committed' });

    const run = ctx.service.store.getRun('run_01');
    expect(run?.state).toBe('paused');
    await ctx.cleanup();
  });

  it('rejects an invalid state transition (queued -> succeeded is not in the transition graph)', async () => {
    const ctx = await makeServiceWithEvidence();
    ctx.service.store.activateMission({
      entity_id: 'mission_spec_01',
      mission_ref: 'mission_01',
      workspace_ref: 'workspace_main',
      subject_identity_ref: 'identity://operator/taras',
    });
    ctx.service.startRunWithMissionRecord({
      entity_id: 'run_01',
      run_ref: 'run_01',
      mission_ref: 'mission_01',
      specification_ref: 'mission_spec_01',
      owning_operator_ref: 'identity://operator/taras',
      owning_agent_ref: 'agent://build-agent/01',
      workspace_ref: 'workspace_main',
    });
    const invalid = ctx.service.store.transitionRun({
      entity_id: 'run_01',
      expected_version: 1,
      next_state: 'succeeded',
    });
    expect(invalid).toMatchObject({
      outcome: 'rejected',
      reason: expect.stringContaining('INVALID_TRANSITION') as string,
    });
    await ctx.cleanup();
  });

  it('records an event through the evidence service during a state transition', async () => {
    const ctx = await makeServiceWithEvidence();
    ctx.service.store.activateMission({
      entity_id: 'mission_spec_01',
      mission_ref: 'mission_01',
      workspace_ref: 'workspace_main',
      subject_identity_ref: 'identity://operator/taras',
    });
    ctx.service.startRunWithMissionRecord({
      entity_id: 'run_01',
      run_ref: 'run_01',
      mission_ref: 'mission_01',
      specification_ref: 'mission_spec_01',
      owning_operator_ref: 'identity://operator/taras',
      owning_agent_ref: 'agent://build-agent/01',
      workspace_ref: 'workspace_main',
    });
    ctx.service.transitionWithEvent({
      entity_id: 'run_01',
      expected_version: 1,
      next_state: 'running',
      event: {
        kind: 'event-record',
        state: 'recorded',
        entity_id: 'event_run_01_running',
        entity_schema_version: '1.0.0',
        workspace_ref: 'workspace_main',
        record_version: 1,
        created_at: '2026-07-19T18:00:00.000Z',
        updated_at: '2026-07-19T18:00:00.000Z',
        event_id: 'event_run_01_running',
        event_type: 'run.started',
        schema_version: '1.0.0',
        recorded_at: '2026-07-19T18:00:00.000Z',
        subject_identity_ref: 'identity://operator/taras',
        run_ref: 'run_01',
        aggregate_ref: 'run_01',
        aggregate_version: 2,
        correlation_id: 'cor_run_01',
        payload: { state: 'running' },
        payload_digest: digestPayload({ state: 'running' }),
        sensitivity_class: 'workspace-internal',
      },
    });
    expect(ctx.mock.commitCalls).toBe(2);
    await ctx.cleanup();
  });

  it('cancels a run via the cancelRun shortcut', async () => {
    const ctx = await makeServiceWithEvidence();
    ctx.service.store.activateMission({
      entity_id: 'mission_spec_01',
      mission_ref: 'mission_01',
      workspace_ref: 'workspace_main',
      subject_identity_ref: 'identity://operator/taras',
    });
    ctx.service.startRunWithMissionRecord({
      entity_id: 'run_01',
      run_ref: 'run_01',
      mission_ref: 'mission_01',
      specification_ref: 'mission_spec_01',
      owning_operator_ref: 'identity://operator/taras',
      owning_agent_ref: 'agent://build-agent/01',
      workspace_ref: 'workspace_main',
    });
    const cancelled = ctx.service.store.cancelRun({
      entity_id: 'run_01',
      expected_version: 1,
      reason: 'user request',
    });
    expect(cancelled).toMatchObject({ outcome: 'committed', record_version: 2 });
    const run = ctx.service.store.getRun('run_01');
    expect(run?.state).toBe('cancelled');
    await ctx.cleanup();
  });

  it('attaches a checkpoint reference to an active run', async () => {
    const ctx = await makeServiceWithEvidence();
    ctx.service.store.activateMission({
      entity_id: 'mission_spec_01',
      mission_ref: 'mission_01',
      workspace_ref: 'workspace_main',
      subject_identity_ref: 'identity://operator/taras',
    });
    ctx.service.startRunWithMissionRecord({
      entity_id: 'run_01',
      run_ref: 'run_01',
      mission_ref: 'mission_01',
      specification_ref: 'mission_spec_01',
      owning_operator_ref: 'identity://operator/taras',
      owning_agent_ref: 'agent://build-agent/01',
      workspace_ref: 'workspace_main',
    });
    const attached = ctx.service.store.attachCheckpoint({
      entity_id: 'run_01',
      expected_version: 1,
      checkpoint_ref: 'checkpoint_run_01_at_v1',
    });
    expect(attached).toMatchObject({ outcome: 'committed' });
    if (attached.outcome === 'committed') {
      expect(attached.record.checkpoint_ref).toBe('checkpoint_run_01_at_v1');
      expect(attached.record_version).toBe(2);
    }
    await ctx.cleanup();
  });
});
