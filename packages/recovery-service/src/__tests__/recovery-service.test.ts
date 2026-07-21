import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SUPPORTED_OPERATIONS, createSqliteRecoveryStore, type LeaseHolder } from '../index.js';

const tempDirectories: string[] = [];

async function makeStore() {
  const root = await mkdtemp(join(tmpdir(), 'operatoros-recovery-'));
  tempDirectories.push(root);
  const store = createSqliteRecoveryStore({ databasePath: join(root, 'recovery.sqlite') });
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

describe('IP-010 Recovery — Checkpoint, Lease, Dual-contender, Snapshot Restore', () => {
  it('declares the supported operation set', () => {
    expect(SUPPORTED_OPERATIONS).toContain('recovery.checkpoint.create');
    expect(SUPPORTED_OPERATIONS).toContain('recovery.lease.acquire');
    expect(SUPPORTED_OPERATIONS).toContain('recovery.contender.resolve');
  });

  it('creates a checkpoint and reads back the latest for a run', async () => {
    const ctx = await makeStore();
    const first = ctx.store.createCheckpoint({
      checkpoint_ref: 'cp_01',
      run_ref: 'run_01',
      workspace_ref: 'workspace_main',
      state_at: 'paused',
      cursor: 10,
      evidence_anchor: 'evidence_anchor_event_01',
      payload: { agent: 'agent://main', progress: 'halfway' },
    });
    expect(first.outcome).toBe('committed');
    ctx.store.createCheckpoint({
      checkpoint_ref: 'cp_02',
      run_ref: 'run_01',
      workspace_ref: 'workspace_main',
      state_at: 'paused',
      cursor: 20,
      evidence_anchor: 'evidence_anchor_event_02',
      payload: { agent: 'agent://main', progress: 'almost' },
    });
    const latest = ctx.store.getLatestCheckpoint('run_01');
    expect(latest?.cursor).toBe(20);
    expect(latest?.payload_digest).toMatch(/^[0-9a-f]{64}$/);
    await ctx.cleanup();
  });

  it('refuses to recreate a checkpoint with the same checkpoint_ref', async () => {
    const ctx = await makeStore();
    ctx.store.createCheckpoint({
      checkpoint_ref: 'cp_dup',
      run_ref: 'run_dup',
      workspace_ref: 'workspace_main',
      state_at: 'paused',
      cursor: 1,
      evidence_anchor: 'evidence_anchor',
      payload: { ok: true },
    });
    const dup = ctx.store.createCheckpoint({
      checkpoint_ref: 'cp_dup',
      run_ref: 'run_dup',
      workspace_ref: 'workspace_main',
      state_at: 'paused',
      cursor: 2,
      evidence_anchor: 'evidence_anchor_2',
      payload: { ok: false },
    });
    expect(dup).toMatchObject({ outcome: 'conflict', deciding_source: 'aggregate_records' });
    await ctx.cleanup();
  });

  it('acquires a lease, rejects a second concurrent lease, releases, and re-acquires', async () => {
    const ctx = await makeStore();
    const holderA: LeaseHolder = { kind: 'process', process_ref: 'process_A' };
    const first = ctx.store.acquireLease({
      workspace_ref: 'workspace_main',
      holder: holderA,
      ttl_ms: 60_000,
    });
    expect(first.outcome).toBe('committed');
    if (first.outcome === 'committed') {
      expect(first.lease.state).toBe('active');
      expect(first.lease.fencing_token).toBe(1);
      expect(first.lease.contender_seq).toBe(1);
    }
    const holderB: LeaseHolder = { kind: 'operator', operator_ref: 'operator_B' };
    const second = ctx.store.acquireLease({
      workspace_ref: 'workspace_main',
      holder: holderB,
      ttl_ms: 60_000,
    });
    expect(second.outcome).toBe('rejected');
    if (second.outcome === 'rejected') {
      expect(second.reason).toBe('LEASE_ALREADY_ACTIVE');
    }
    if (first.outcome === 'committed') {
      const release = ctx.store.releaseLease({
        lease_id: first.lease.lease_id,
        expected_version: 1,
      });
      expect(release.outcome).toBe('committed');
    }
    const third = ctx.store.acquireLease({
      workspace_ref: 'workspace_main',
      holder: holderB,
      ttl_ms: 60_000,
    });
    expect(third.outcome).toBe('committed');
    if (third.outcome === 'committed') {
      expect(third.lease.fencing_token).toBe(2);
      expect(third.lease.contender_seq).toBe(2);
    }
    await ctx.cleanup();
  });

  it('renews a lease, rejects renew with stale fencing_token, and rejects renew on released lease', async () => {
    const ctx = await makeStore();
    const holder: LeaseHolder = { kind: 'agent', agent_ref: 'agent_recovery_01' };
    const acq = ctx.store.acquireLease({
      workspace_ref: 'workspace_main',
      holder,
      ttl_ms: 30_000,
    });
    expect(acq.outcome).toBe('committed');
    if (acq.outcome !== 'committed') {
      throw new Error('expected committed');
    }
    const renewOk = ctx.store.renewLease({
      lease_id: acq.lease.lease_id,
      expected_version: 1,
      ttl_ms: 60_000,
      expected_fencing_token: acq.lease.fencing_token,
    });
    expect(renewOk.outcome).toBe('committed');
    if (renewOk.outcome === 'committed') {
      expect(renewOk.lease.fencing_token).toBe(acq.lease.fencing_token);
    }
    const staleFencing = ctx.store.renewLease({
      lease_id: acq.lease.lease_id,
      expected_version: 1,
      ttl_ms: 60_000,
      expected_fencing_token: acq.lease.fencing_token - 1,
    });
    expect(staleFencing).toMatchObject({ outcome: 'rejected', reason: 'FENCING_TOKEN_PREEMPTED' });
    ctx.store.releaseLease({ lease_id: acq.lease.lease_id, expected_version: 2 });
    const released = ctx.store.renewLease({
      lease_id: acq.lease.lease_id,
      expected_version: 3,
      ttl_ms: 60_000,
      expected_fencing_token: acq.lease.fencing_token,
    });
    expect(released).toMatchObject({ outcome: 'rejected', reason: 'LEASE_NOT_ACTIVE' });
    await ctx.cleanup();
  });

  it('dual-contender resolve: the lease with the higher fencing_token wins, loser is preempted', async () => {
    const ctx = await makeStore();
    // First acquire — fencing 1
    const holderA: LeaseHolder = { kind: 'process', process_ref: 'process_first' };
    const acqA = ctx.store.acquireLease({
      workspace_ref: 'workspace_main',
      holder: holderA,
      ttl_ms: 30_000,
    });
    expect(acqA.outcome).toBe('committed');
    if (acqA.outcome !== 'committed') throw new Error('expected committed A');
    // Release so the workspace has no active lease; then acquire holderB (fencing 2).
    ctx.store.releaseLease({ lease_id: acqA.lease.lease_id, expected_version: 1 });
    const holderB: LeaseHolder = { kind: 'operator', operator_ref: 'operator_second' };
    const acqB = ctx.store.acquireLease({
      workspace_ref: 'workspace_main',
      holder: holderB,
      ttl_ms: 30_000,
    });
    expect(acqB.outcome).toBe('committed');
    if (acqB.outcome !== 'committed') throw new Error('expected committed B');
    // Simulate "stale contender" by trying to use lease A against B.
    const verdict = ctx.store.resolveDualContender({
      workspace_ref: 'workspace_main',
      contender_a: { lease_id: acqA.lease.lease_id, holder: holderA },
      contender_b: { lease_id: acqB.lease.lease_id, holder: holderB },
    });
    expect(verdict.outcome).toBe('resolved');
    if (verdict.outcome === 'resolved') {
      expect(verdict.verdict.winning_lease_id).toBe(acqB.lease.lease_id);
      expect(verdict.verdict.losing_lease_id).toBe(acqA.lease.lease_id);
      expect(verdict.verdict.decided_by).toBe('fencing_token');
    }
    // After resolution, the loser cannot renew or release (already preempted).
    const after = ctx.store.releaseLease({
      lease_id: acqA.lease.lease_id,
      expected_version: 1,
    });
    expect(after).toMatchObject({ outcome: 'rejected' });
    await ctx.cleanup();
  });

  it('dual-contender resolve: workspace_ref mismatch rejected', async () => {
    const ctx = await makeStore();
    const acqA = ctx.store.acquireLease({
      workspace_ref: 'workspace_main',
      holder: { kind: 'process', process_ref: 'process_a' },
      ttl_ms: 30_000,
    });
    const acqB = ctx.store.acquireLease({
      workspace_ref: 'workspace_other',
      holder: { kind: 'process', process_ref: 'process_b' },
      ttl_ms: 30_000,
    });
    expect(acqA.outcome).toBe('committed');
    expect(acqB.outcome).toBe('committed');
    if (acqA.outcome !== 'committed' || acqB.outcome !== 'committed') throw new Error('seed');
    const verdict = ctx.store.resolveDualContender({
      workspace_ref: 'workspace_main',
      contender_a: {
        lease_id: acqA.lease.lease_id,
        holder: { kind: 'process', process_ref: 'process_a' },
      },
      contender_b: {
        lease_id: acqB.lease.lease_id,
        holder: { kind: 'process', process_ref: 'process_b' },
      },
    });
    expect(verdict).toMatchObject({ outcome: 'rejected', reason: 'WORKSPACE_REF_MISMATCH' });
    await ctx.cleanup();
  });
});
