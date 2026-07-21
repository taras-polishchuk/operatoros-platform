import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SUPPORTED_OPERATIONS, createGovernanceService } from '../index.js';

const tempDirectories: string[] = [];

async function makeGovernance() {
  const root = await mkdtemp(join(tmpdir(), 'operatoros-gov-'));
  tempDirectories.push(root);
  const service = createGovernanceService({ databasePath: join(root, 'gov.sqlite') });
  return {
    service,
    cleanup: async () => {
      service.close();
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

describe('IP-006 Governance Service', () => {
  it('declares the supported operation set', () => {
    expect(SUPPORTED_OPERATIONS).toContain('operator-profile.activate');
    expect(SUPPORTED_OPERATIONS).toContain('capability-grant.issue');
    expect(SUPPORTED_OPERATIONS).toContain('configuration-revision.publish');
    expect(SUPPORTED_OPERATIONS).toContain('effective-configuration.compute');
  });

  it('activates an operator profile once and refuses duplicates', async () => {
    const ctx = await makeGovernance();
    const first = ctx.service.activateOperator({
      entity_id: 'operator_taras',
      identity_ref: 'identity://operator/taras',
      workspace_ref: 'workspace_main',
      subject_identity_ref: 'identity://operator/taras',
    });
    expect(first.outcome).toBe('committed');
    if (first.outcome === 'committed') {
      expect(first.record_version).toBe(1);
    }
    const second = ctx.service.activateOperator({
      entity_id: 'operator_taras',
      identity_ref: 'identity://operator/taras',
      workspace_ref: 'workspace_main',
      subject_identity_ref: 'identity://operator/taras',
    });
    expect(second).toMatchObject({ outcome: 'conflict', deciding_source: 'aggregate_records' });
    await ctx.cleanup();
  });

  it('suspends an active operator profile only with the expected version', async () => {
    const ctx = await makeGovernance();
    ctx.service.activateOperator({
      entity_id: 'operator_taras',
      identity_ref: 'identity://operator/taras',
      workspace_ref: 'workspace_main',
      subject_identity_ref: 'identity://operator/taras',
    });
    const wrong = ctx.service.suspendOperator({
      entity_id: 'operator_taras',
      expected_version: 99,
      subject_identity_ref: 'identity://operator/taras',
    });
    expect(wrong).toMatchObject({ outcome: 'conflict' });
    const ok = ctx.service.suspendOperator({
      entity_id: 'operator_taras',
      expected_version: 1,
      subject_identity_ref: 'identity://operator/taras',
    });
    expect(ok).toMatchObject({ outcome: 'committed', record_version: 2 });
    await ctx.cleanup();
  });

  it('issues and revokes a capability grant, with active grants scoped by subject', async () => {
    const ctx = await makeGovernance();
    const issued = ctx.service.issueGrant({
      grant_id: 'grant_01',
      entity_id: 'entity_grant_01',
      subject_ref: 'identity://operator/taras',
      capability_definition_ref: 'cap_def_runtime',
      scope: 'runtime:execute',
      workspace_ref: 'workspace_main',
    });
    expect(issued.outcome).toBe('committed');
    if (issued.outcome === 'committed') {
      expect(issued.record.state).toBe('active');
    }
    const listed = ctx.service.listActiveGrantsFor({ subject_ref: 'identity://operator/taras' });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.grant_id).toBe('grant_01');

    const revoked = ctx.service.revokeGrant({
      grant_id: 'grant_01',
      expected_version: 1,
      revoker_ref: 'identity://admin/taras',
    });
    expect(revoked).toMatchObject({ outcome: 'committed', record_version: 2 });
    const stillActive = ctx.service.listActiveGrantsFor({
      subject_ref: 'identity://operator/taras',
    });
    expect(stillActive).toHaveLength(0);
    await ctx.cleanup();
  });

  it('publishes configuration revisions and computes the effective configuration by precedence', async () => {
    const ctx = await makeGovernance();
    const low = ctx.service.publishRevision({
      config_ref: 'cfg_workspace_low',
      entity_id: 'cfg_entity_low',
      scope: 'workspace',
      precedence: 10,
      payload: { feature_flag_a: false, network_allow_list: ['10.0.0.0/8'] },
      workspace_ref: 'workspace_main',
    });
    expect(low.outcome).toBe('committed');

    const high = ctx.service.publishRevision({
      config_ref: 'cfg_workspace_high',
      entity_id: 'cfg_entity_high',
      scope: 'workspace',
      precedence: 100,
      payload: { feature_flag_a: true, audit_sink: 'sqlite://./audit' },
      workspace_ref: 'workspace_main',
    });
    expect(high.outcome).toBe('committed');

    const effective = ctx.service.computeEffectiveConfiguration({
      workspace_ref: 'workspace_main',
      approver_refs: ['identity://admin/taras'],
    });
    expect(effective).toMatchObject({ outcome: 'computed' });
    if (effective.outcome === 'computed') {
      expect(effective.effective.payload).toEqual({
        feature_flag_a: true,
        network_allow_list: ['10.0.0.0/8'],
        audit_sink: 'sqlite://./audit',
      });
      const precedences = effective.effective.resolved_precedence.map((r) => r.precedence);
      expect(precedences).toEqual([100, 10]);
      expect(effective.effective.approver_refs).toEqual(['identity://admin/taras']);
      expect(effective.effective.digest).toMatch(/^[0-9a-f]{64}$/);
    }
    await ctx.cleanup();
  });

  it('rejects publishing a configuration revision with non-integer precedence', async () => {
    const ctx = await makeGovernance();
    const rejected = ctx.service.publishRevision({
      config_ref: 'cfg_bad',
      entity_id: 'cfg_entity_bad',
      scope: 'run',
      precedence: 1.5,
      payload: { foo: 'bar' },
      workspace_ref: 'workspace_main',
    });
    expect(rejected).toMatchObject({
      outcome: 'rejected',
      reason: 'PRECEDENCE_NOT_INTEGER_NONNEGATIVE',
    });
    await ctx.cleanup();
  });

  it('retires an active configuration revision optimistically', async () => {
    const ctx = await makeGovernance();
    ctx.service.publishRevision({
      config_ref: 'cfg_retire',
      entity_id: 'cfg_entity_retire',
      scope: 'mission',
      precedence: 50,
      payload: { mission_default: true },
      workspace_ref: 'workspace_main',
    });
    const bad = ctx.service.retireRevision({
      config_ref: 'cfg_retire',
      expected_version: 9,
    });
    expect(bad).toMatchObject({ outcome: 'conflict' });
    const ok = ctx.service.retireRevision({
      config_ref: 'cfg_retire',
      expected_version: 1,
    });
    expect(ok).toMatchObject({ outcome: 'committed', record_version: 2 });
    await ctx.cleanup();
  });
});
