import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SUPPORTED_OPERATIONS, createSqliteAgentRegistry } from '../index.js';

const tempDirectories: string[] = [];

async function makeRegistry() {
  const root = await mkdtemp(join(tmpdir(), 'operatoros-agent-'));
  tempDirectories.push(root);
  const store = createSqliteAgentRegistry({ databasePath: join(root, 'agents.sqlite') });
  return {
    store,
    cleanup: async () => {
      store.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

beforeEach(() => {
  tempDirectories.length = 0;
});

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe('IP-101..IP-104 Agent Execution', () => {
  it('declares the supported operation set', () => {
    expect(SUPPORTED_OPERATIONS).toContain('agent.register');
    expect(SUPPORTED_OPERATIONS).toContain('agent.activate');
    expect(SUPPORTED_OPERATIONS).toContain('agent.invoke');
    expect(SUPPORTED_OPERATIONS).toContain('agent.record-result');
  });

  it('registers an agent, refuses duplicates, and persists typed_responsibility + capabilities', async () => {
    const ctx = await makeRegistry();
    const reg = ctx.store.registerAgent({
      entity_id: 'agent_echo_01',
      agent_id: 'agent_echo_01',
      typed_responsibility: 'execute read-only tool calls',
      identity_class: 'service',
      capability_definitions: ['cap.read.repo', 'cap.write.events'],
      security_boundary_ref: 'boundary://agent-echo-01',
      isolation_tier: 'T2',
      workspace_ref: 'workspace_main',
    });
    expect(reg.outcome).toBe('committed');
    if (reg.outcome === 'committed') {
      expect(reg.record.state).toBe('draft');
      expect(reg.record.capability_definitions).toEqual(['cap.read.repo', 'cap.write.events']);
    }
    const dup = ctx.store.registerAgent({
      entity_id: 'agent_echo_01',
      agent_id: 'agent_echo_01',
      typed_responsibility: 'execute read-only tool calls',
      identity_class: 'service',
      capability_definitions: ['cap.read.repo'],
      security_boundary_ref: 'boundary://agent-echo-01',
      isolation_tier: 'T2',
      workspace_ref: 'workspace_main',
    });
    expect(dup).toMatchObject({ outcome: 'conflict', deciding_source: 'aggregate_records' });
    await ctx.cleanup();
  });

  it('rejects activation if a required capability grant is missing (capability matching)', async () => {
    const ctx = await makeRegistry();
    ctx.store.registerAgent({
      entity_id: 'agent_writer_01',
      agent_id: 'agent_writer_01',
      typed_responsibility: 'write to canonical store',
      identity_class: 'machine',
      capability_definitions: ['cap.write.store', 'cap.read.audit'],
      security_boundary_ref: 'boundary://writer',
      isolation_tier: 'T3',
      workspace_ref: 'workspace_main',
    });
    const governanceStore = {
      listActiveGrantsFor: ({ subject_ref }: { subject_ref: string }) => {
        if (subject_ref === 'identity://operator/taras') {
          // Only cap.write.store granted, cap.read.audit missing.
          return [{ capability_definition_ref: 'cap.write.store', state: 'active' as const }];
        }
        return [];
      },
    };
    const activation = ctx.store.activateAgent({
      entity_id: 'agent_writer_01',
      expected_version: 1,
      required_capability_grants: [
        { subject_ref: 'identity://operator/taras', capability_definition_ref: 'cap.read.audit' },
      ],
      governanceStore: governanceStore,
    });
    expect(activation).toMatchObject({
      outcome: 'rejected',
      reason: 'CAPABILITY_GRANT_MISSING:cap.read.audit',
    });
    await ctx.cleanup();
  });

  it('activates the agent once all capability grants exist; record_version increments', async () => {
    const ctx = await makeRegistry();
    ctx.store.registerAgent({
      entity_id: 'agent_writer_02',
      agent_id: 'agent_writer_02',
      typed_responsibility: 'write to canonical store',
      identity_class: 'machine',
      capability_definitions: ['cap.write.store'],
      security_boundary_ref: 'boundary://writer-02',
      isolation_tier: 'T3',
      workspace_ref: 'workspace_main',
    });
    const governanceStore = {
      listActiveGrantsFor: () => [
        { capability_definition_ref: 'cap.write.store', state: 'active' as const },
      ],
    };
    const activation = ctx.store.activateAgent({
      entity_id: 'agent_writer_02',
      expected_version: 1,
      required_capability_grants: [
        { subject_ref: 'identity://operator/taras', capability_definition_ref: 'cap.write.store' },
      ],
      governanceStore: governanceStore,
    });
    expect(activation.outcome).toBe('committed');
    if (activation.outcome === 'committed') {
      expect(activation.record_version).toBe(2);
    }
    expect(ctx.store.getAgent('agent_writer_02')?.state).toBe('active');
    await ctx.cleanup();
  });

  it('invokes the agent, records the result, and computes payload_digest', async () => {
    const ctx = await makeRegistry();
    ctx.store.registerAgent({
      entity_id: 'agent_echo_02',
      agent_id: 'agent_echo_02',
      typed_responsibility: 'execute read-only tool calls',
      identity_class: 'service',
      capability_definitions: ['cap.read.repo'],
      security_boundary_ref: 'boundary://echo-02',
      isolation_tier: 'T2',
      workspace_ref: 'workspace_main',
    });
    ctx.store.activateAgent({
      entity_id: 'agent_echo_02',
      expected_version: 1,
      required_capability_grants: [
        { subject_ref: 'identity://operator/taras', capability_definition_ref: 'cap.read.repo' },
      ],
      governanceStore: {
        listActiveGrantsFor: () => [
          { capability_definition_ref: 'cap.read.repo', state: 'active' as const },
        ],
      },
    });
    const invocation = ctx.store.invokeAgent({
      invocation_id: 'invocation_01',
      agent_id: 'agent_echo_02',
      run_ref: 'run_agent_01',
      workspace_ref: 'workspace_main',
      capability_needed: 'cap.read.repo',
      subject_identity_ref: 'identity://operator/taras',
      correlation_id: 'cor_agent_01',
    });
    expect(invocation.outcome).toBe('committed');
    if (invocation.outcome !== 'committed') throw new Error('seed');
    const result = ctx.store.recordAgentResult({
      invocation_id: 'invocation_01',
      outcome: 'succeeded',
      payload: { files_read: ['README.md'], bytes: 42 },
    });
    expect(result.outcome).toBe('committed');
    if (result.outcome === 'committed') {
      expect(result.payload_digest).toMatch(/^[0-9a-f]{64}$/);
    }
    const invAfter = ctx.store.getInvocation('invocation_01');
    expect(invAfter?.state).toBe('recorded');
    await ctx.cleanup();
  });

  it('refuses invocation if capability_needed is not declared by the agent', async () => {
    const ctx = await makeRegistry();
    ctx.store.registerAgent({
      entity_id: 'agent_echo_03',
      agent_id: 'agent_echo_03',
      typed_responsibility: 'execute read-only tool calls',
      identity_class: 'service',
      capability_definitions: ['cap.read.repo'],
      security_boundary_ref: 'boundary://echo-03',
      isolation_tier: 'T2',
      workspace_ref: 'workspace_main',
    });
    ctx.store.activateAgent({
      entity_id: 'agent_echo_03',
      expected_version: 1,
      required_capability_grants: [
        { subject_ref: 'identity://operator/taras', capability_definition_ref: 'cap.read.repo' },
      ],
      governanceStore: {
        listActiveGrantsFor: () => [
          { capability_definition_ref: 'cap.read.repo', state: 'active' as const },
        ],
      },
    });
    const invocation = ctx.store.invokeAgent({
      invocation_id: 'invocation_bad',
      agent_id: 'agent_echo_03',
      run_ref: 'run_bad',
      workspace_ref: 'workspace_main',
      capability_needed: 'cap.delete.repo',
      subject_identity_ref: 'identity://operator/taras',
      correlation_id: 'cor_bad',
    });
    expect(invocation).toMatchObject({ outcome: 'rejected', reason: 'CAPABILITY_NOT_DECLARED' });
    await ctx.cleanup();
  });

  it('refuses recording a result twice for the same invocation (idempotency on the agent path)', async () => {
    const ctx = await makeRegistry();
    ctx.store.registerAgent({
      entity_id: 'agent_echo_04',
      agent_id: 'agent_echo_04',
      typed_responsibility: 'execute read-only tool calls',
      identity_class: 'service',
      capability_definitions: ['cap.read.repo'],
      security_boundary_ref: 'boundary://echo-04',
      isolation_tier: 'T2',
      workspace_ref: 'workspace_main',
    });
    ctx.store.activateAgent({
      entity_id: 'agent_echo_04',
      expected_version: 1,
      required_capability_grants: [
        { subject_ref: 'identity://operator/taras', capability_definition_ref: 'cap.read.repo' },
      ],
      governanceStore: {
        listActiveGrantsFor: () => [
          { capability_definition_ref: 'cap.read.repo', state: 'active' as const },
        ],
      },
    });
    ctx.store.invokeAgent({
      invocation_id: 'invocation_dup',
      agent_id: 'agent_echo_04',
      run_ref: 'run_dup',
      workspace_ref: 'workspace_main',
      capability_needed: 'cap.read.repo',
      subject_identity_ref: 'identity://operator/taras',
      correlation_id: 'cor_dup',
    });
    const first = ctx.store.recordAgentResult({
      invocation_id: 'invocation_dup',
      outcome: 'succeeded',
      payload: { ok: true },
    });
    expect(first.outcome).toBe('committed');
    const second = ctx.store.recordAgentResult({
      invocation_id: 'invocation_dup',
      outcome: 'succeeded',
      payload: { ok: true },
    });
    expect(second).toMatchObject({ outcome: 'rejected', reason: 'INVOCATION_ALREADY_RECORDED' });
    await ctx.cleanup();
  });

  it('cancels an in-flight invocation; result is then rejected', async () => {
    const ctx = await makeRegistry();
    ctx.store.registerAgent({
      entity_id: 'agent_echo_05',
      agent_id: 'agent_echo_05',
      typed_responsibility: 'execute read-only tool calls',
      identity_class: 'service',
      capability_definitions: ['cap.read.repo'],
      security_boundary_ref: 'boundary://echo-05',
      isolation_tier: 'T2',
      workspace_ref: 'workspace_main',
    });
    ctx.store.activateAgent({
      entity_id: 'agent_echo_05',
      expected_version: 1,
      required_capability_grants: [
        { subject_ref: 'identity://operator/taras', capability_definition_ref: 'cap.read.repo' },
      ],
      governanceStore: {
        listActiveGrantsFor: () => [
          { capability_definition_ref: 'cap.read.repo', state: 'active' as const },
        ],
      },
    });
    ctx.store.invokeAgent({
      invocation_id: 'invocation_cancel',
      agent_id: 'agent_echo_05',
      run_ref: 'run_cancel',
      workspace_ref: 'workspace_main',
      capability_needed: 'cap.read.repo',
      subject_identity_ref: 'identity://operator/taras',
      correlation_id: 'cor_cancel',
    });
    const cancel = ctx.store.cancelAgentInvocation({ invocation_id: 'invocation_cancel' });
    expect(cancel.outcome).toBe('committed');
    const record = ctx.store.recordAgentResult({
      invocation_id: 'invocation_cancel',
      outcome: 'cancelled',
      payload: { reason: 'user_cancelled' },
    });
    expect(record).toMatchObject({ outcome: 'rejected', reason: 'INVOCATION_ALREADY_RECORDED' });
    await ctx.cleanup();
  });

  it('suspend + retire state machine; resume impossible after retire', async () => {
    const ctx = await makeRegistry();
    ctx.store.registerAgent({
      entity_id: 'agent_echo_06',
      agent_id: 'agent_echo_06',
      typed_responsibility: 'execute read-only tool calls',
      identity_class: 'service',
      capability_definitions: ['cap.read.repo'],
      security_boundary_ref: 'boundary://echo-06',
      isolation_tier: 'T2',
      workspace_ref: 'workspace_main',
    });
    ctx.store.activateAgent({
      entity_id: 'agent_echo_06',
      expected_version: 1,
      required_capability_grants: [
        { subject_ref: 'identity://operator/taras', capability_definition_ref: 'cap.read.repo' },
      ],
      governanceStore: {
        listActiveGrantsFor: () => [
          { capability_definition_ref: 'cap.read.repo', state: 'active' as const },
        ],
      },
    });
    const suspend = ctx.store.suspendAgent({ entity_id: 'agent_echo_06', expected_version: 2 });
    expect(suspend.outcome).toBe('committed');
    const retire = ctx.store.retireAgent({ entity_id: 'agent_echo_06', expected_version: 3 });
    expect(retire.outcome).toBe('committed');
    const retry = ctx.store.activateAgent({
      entity_id: 'agent_echo_06',
      expected_version: 4,
      required_capability_grants: [
        { subject_ref: 'identity://operator/taras', capability_definition_ref: 'cap.read.repo' },
      ],
      governanceStore: {
        listActiveGrantsFor: () => [
          { capability_definition_ref: 'cap.read.repo', state: 'active' as const },
        ],
      },
    });
    expect(retry).toMatchObject({ outcome: 'rejected', reason: 'AGENT_NOT_DRAFT' });
    await ctx.cleanup();
  });
});
