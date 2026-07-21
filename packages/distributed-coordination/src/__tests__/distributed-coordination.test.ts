import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SUPPORTED_OPERATIONS, createSqliteDistributedCoordination } from '../index.js';

const tempDirectories: string[] = [];

async function makeCoordination() {
  const root = await mkdtemp(join(tmpdir(), 'operatoros-dist-'));
  tempDirectories.push(root);
  const store = createSqliteDistributedCoordination({ databasePath: join(root, 'dist.sqlite') });
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

describe('IP-401..IP-403 Distributed Coordination', () => {
  it('declares the supported operation set', () => {
    expect(SUPPORTED_OPERATIONS).toContain('distributed.peer.register');
    expect(SUPPORTED_OPERATIONS).toContain('distributed.checkpoint.anchor');
    expect(SUPPORTED_OPERATIONS).toContain('distributed.snapshot.reconcile');
    expect(SUPPORTED_OPERATIONS).toContain('distributed.consistency.verify');
  });

  it('registers two peers and refuses duplicates', async () => {
    const ctx = await makeCoordination();
    const primary = ctx.store.registerPeer({
      peer_id: 'peer_alpha',
      host: '10.0.0.1',
      port: 7_000,
      role: 'primary',
    });
    const replica = ctx.store.registerPeer({
      peer_id: 'peer_beta',
      host: '10.0.0.2',
      port: 7_001,
      role: 'replica',
    });
    expect(primary.outcome).toBe('committed');
    expect(replica.outcome).toBe('committed');
    expect(ctx.store.listPeers()).toHaveLength(2);
    const dup = ctx.store.registerPeer({
      peer_id: 'peer_alpha',
      host: '10.0.0.99',
      port: 9_999,
      role: 'replica',
    });
    expect(dup).toMatchObject({ outcome: 'conflict', reason: 'PEER_ID_EXISTS' });
    await ctx.cleanup();
  });

  it('anchors a checkpoint from two peers with the same payload — payload_digest matches across peers', async () => {
    const ctx = await makeCoordination();
    ctx.store.registerPeer({
      peer_id: 'peer_alpha',
      host: '10.0.0.1',
      port: 7_000,
      role: 'primary',
    });
    ctx.store.registerPeer({
      peer_id: 'peer_beta',
      host: '10.0.0.2',
      port: 7_001,
      role: 'replica',
    });
    const a = ctx.store.anchorCheckpoint({
      checkpoint_ref: 'cp_dist_01',
      workspace_ref: 'workspace_dist',
      run_ref: 'run_dist_01',
      cursor: 100,
      payload: { progress: 'halfway' },
      peer_id: 'peer_alpha',
    });
    const b = ctx.store.anchorCheckpoint({
      checkpoint_ref: 'cp_dist_01',
      workspace_ref: 'workspace_dist',
      run_ref: 'run_dist_01',
      cursor: 100,
      payload: { progress: 'halfway' },
      peer_id: 'peer_beta',
    });
    expect(a.outcome).toBe('committed');
    expect(b.outcome).toBe('committed');
    if (a.outcome === 'committed' && b.outcome === 'committed') {
      expect(a.anchor.payload_digest).toBe(b.anchor.payload_digest);
      expect(b.anchor.fencing_token).toBeGreaterThan(a.anchor.fencing_token);
    }
    // verifyConsistency checks payload_digest across peers and agrees.
    const verify = ctx.store.verifyConsistency({
      workspace_ref: 'workspace_dist',
      peer_ids: ['peer_alpha', 'peer_beta'],
    });
    expect(verify).toMatchObject({ consistent: true, anchors_compared: 1 });
    await ctx.cleanup();
  });

  it('conflicting payload across peers → reconcile flags the divergence', async () => {
    const ctx = await makeCoordination();
    ctx.store.registerPeer({
      peer_id: 'peer_alpha',
      host: '10.0.0.1',
      port: 7_000,
      role: 'primary',
    });
    ctx.store.registerPeer({
      peer_id: 'peer_beta',
      host: '10.0.0.2',
      port: 7_001,
      role: 'replica',
    });
    ctx.store.anchorCheckpoint({
      checkpoint_ref: 'cp_diverge',
      workspace_ref: 'workspace_diverge',
      run_ref: 'run_d',
      cursor: 50,
      payload: { x: 1 },
      peer_id: 'peer_alpha',
    });
    ctx.store.anchorCheckpoint({
      checkpoint_ref: 'cp_diverge',
      workspace_ref: 'workspace_diverge',
      run_ref: 'run_d',
      cursor: 50,
      payload: { x: 2 }, // different payload
      peer_id: 'peer_beta',
    });
    const verdict = ctx.store.reconcileSnapshots({ workspace_ref: 'workspace_diverge' });
    expect(verdict.consistent).toBe(false);
    expect(verdict.conflicting_checkpoints).toHaveLength(1);
    expect(verdict.conflicting_checkpoints[0]).toMatchObject({ checkpoint_ref: 'cp_diverge' });
    expect(verdict.conflicting_checkpoints[0]?.peer_payload_digests).toHaveLength(2);
    await ctx.cleanup();
  });

  it('fencing token increments per anchor; same payload + different fencing detected', async () => {
    const ctx = await makeCoordination();
    ctx.store.registerPeer({
      peer_id: 'peer_alpha',
      host: '10.0.0.1',
      port: 7_000,
      role: 'primary',
    });
    ctx.store.registerPeer({
      peer_id: 'peer_beta',
      host: '10.0.0.2',
      port: 7_001,
      role: 'replica',
    });
    const first = ctx.store.anchorCheckpoint({
      checkpoint_ref: 'cp_token',
      workspace_ref: 'workspace_tok',
      run_ref: 'run_t',
      cursor: 10,
      payload: { state: 'A' },
      peer_id: 'peer_alpha',
    });
    const second = ctx.store.anchorCheckpoint({
      checkpoint_ref: 'cp_token',
      workspace_ref: 'workspace_tok',
      run_ref: 'run_t',
      cursor: 10,
      payload: { state: 'A' },
      peer_id: 'peer_beta',
    });
    expect(first.outcome).toBe('committed');
    expect(second.outcome).toBe('committed');
    if (first.outcome === 'committed' && second.outcome === 'committed') {
      expect(second.anchor.fencing_token).toBeGreaterThan(first.anchor.fencing_token);
    }
    const verdict = ctx.store.reconcileSnapshots({ workspace_ref: 'workspace_tok' });
    expect(verdict.consistent).toBe(false);
    await ctx.cleanup();
  });

  it('verifyConsistency agrees with reconcile verdict and reports anchors_compared', async () => {
    const ctx = await makeCoordination();
    ctx.store.registerPeer({
      peer_id: 'peer_alpha',
      host: '10.0.0.1',
      port: 7_000,
      role: 'primary',
    });
    ctx.store.registerPeer({
      peer_id: 'peer_beta',
      host: '10.0.0.2',
      port: 7_001,
      role: 'replica',
    });
    ctx.store.anchorCheckpoint({
      checkpoint_ref: 'cp_v',
      workspace_ref: 'workspace_v',
      run_ref: 'run_v',
      cursor: 1,
      payload: { v: 'same' },
      peer_id: 'peer_alpha',
    });
    ctx.store.anchorCheckpoint({
      checkpoint_ref: 'cp_v',
      workspace_ref: 'workspace_v',
      run_ref: 'run_v',
      cursor: 1,
      payload: { v: 'same' },
      peer_id: 'peer_beta',
    });
    const ok = ctx.store.verifyConsistency({
      workspace_ref: 'workspace_v',
      peer_ids: ['peer_alpha', 'peer_beta'],
    });
    expect(ok).toMatchObject({
      consistent: true,
      anchors_compared: 1,
      details: 'all_anchors_match',
    });
    await ctx.cleanup();
  });

  it('deregister transitions the peer to offline; subsequent anchor is rejected', async () => {
    const ctx = await makeCoordination();
    ctx.store.registerPeer({
      peer_id: 'peer_alpha',
      host: '10.0.0.1',
      port: 7_000,
      role: 'primary',
    });
    expect(ctx.store.deregisterPeer({ peer_id: 'peer_alpha' })).toMatchObject({
      outcome: 'committed',
    });
    expect(ctx.store.getPeer('peer_alpha')?.state).toBe('offline');
    const blocked = ctx.store.anchorCheckpoint({
      checkpoint_ref: 'cp_offline',
      workspace_ref: 'workspace_off',
      run_ref: 'run_off',
      cursor: 1,
      payload: { x: 1 },
      peer_id: 'peer_alpha',
    });
    expect(blocked).toMatchObject({ outcome: 'rejected', reason: 'PEER_NOT_REGISTERED' });
    await ctx.cleanup();
  });
});
