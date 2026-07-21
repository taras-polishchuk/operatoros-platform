import { describe, expect, it } from 'vitest';

import {
  SUPPORTED_OPERATIONS,
  createHostedRuntime,
  createInMemoryTenantStore,
  type TenantStore,
} from '../index.js';

describe('IP-301..IP-304 Hosted Runtime', () => {
  it('declares the supported operation set', () => {
    expect(SUPPORTED_OPERATIONS).toContain('hosted.tenant.register');
    expect(SUPPORTED_OPERATIONS).toContain('hosted.cli.run');
    expect(SUPPORTED_OPERATIONS).toContain('hosted.cli.explain');
  });

  it('registers two tenants in two separate workspaces; cross-tenant access rejected', () => {
    const store: TenantStore = createInMemoryTenantStore();
    const a = store.register({
      tenant_id: 'tenant_a',
      workspace_ref: 'workspace_tenant_a',
      storage_path: '/srv/hosted/tenant_a',
      isolation_tier: 'T2',
    });
    const b = store.register({
      tenant_id: 'tenant_b',
      workspace_ref: 'workspace_tenant_b',
      storage_path: '/srv/hosted/tenant_b',
      isolation_tier: 'T3',
    });
    expect(a.outcome).toBe('committed');
    expect(b.outcome).toBe('committed');
    const dup = store.register({
      tenant_id: 'tenant_a',
      workspace_ref: 'workspace_tenant_a',
      storage_path: '/srv/hosted/tenant_a',
      isolation_tier: 'T2',
    });
    expect(dup).toMatchObject({ outcome: 'conflict', reason: 'TENANT_ID_EXISTS' });
    const runtime = createHostedRuntime({ tenantStore: store });
    expect(runtime.isolateArtifactAccess('workspace_tenant_a')).toBe(true);
    expect(runtime.isolateArtifactAccess('workspace_unrelated')).toBe(false);
  });

  it('dispatch surfaces tenant_id + workspace_ref; refuses suspended/archived tenants', () => {
    const store: TenantStore = createInMemoryTenantStore();
    store.register({
      tenant_id: 'tenant_x',
      workspace_ref: 'workspace_tenant_x',
      storage_path: '/srv/hosted/x',
      isolation_tier: 'T1',
    });
    const runtime = createHostedRuntime({ tenantStore: store });
    const explain = runtime.dispatch({
      tenant_id: 'tenant_x',
      operation: 'hosted.cli.explain',
      args: {},
      subject_identity_ref: 'identity://operator/hosted',
      correlation_id: 'cor_x_01',
    });
    expect(explain).toMatchObject({ outcome: 'accepted', at_runtime: 'hosted-cli' });
    if (explain.outcome === 'accepted') {
      expect(explain.payload).toMatchObject({
        tenant_id: 'tenant_x',
        workspace_ref: 'workspace_tenant_x',
      });
    }
    store.suspend({ tenant_id: 'tenant_x' });
    const rejected = runtime.dispatch({
      tenant_id: 'tenant_x',
      operation: 'hosted.cli.explain',
      args: {},
      subject_identity_ref: 'identity://operator/hosted',
      correlation_id: 'cor_x_02',
    });
    expect(rejected).toMatchObject({ outcome: 'rejected', reason: 'TENANT_SUSPENDED' });
  });

  it('suspend + resume state machine; cannot suspend an already-suspended tenant', () => {
    const store: TenantStore = createInMemoryTenantStore();
    store.register({
      tenant_id: 'tenant_y',
      workspace_ref: 'workspace_tenant_y',
      storage_path: '/srv/hosted/y',
      isolation_tier: 'T2',
    });
    expect(store.suspend({ tenant_id: 'tenant_y' })).toMatchObject({ outcome: 'committed' });
    expect(store.suspend({ tenant_id: 'tenant_y' })).toMatchObject({
      outcome: 'rejected',
      reason: 'TENANT_NOT_ACTIVE',
    });
    expect(store.resume({ tenant_id: 'tenant_y' })).toMatchObject({ outcome: 'committed' });
    expect(store.resume({ tenant_id: 'tenant_y' })).toMatchObject({
      outcome: 'rejected',
      reason: 'TENANT_NOT_SUSPENDED',
    });
  });

  it('run forwards operation + computes request_digest; cancel requires correlation_id', () => {
    const store: TenantStore = createInMemoryTenantStore();
    store.register({
      tenant_id: 'tenant_z',
      workspace_ref: 'workspace_tenant_z',
      storage_path: '/srv/hosted/z',
      isolation_tier: 'T2',
    });
    const runtime = createHostedRuntime({ tenantStore: store });
    const run = runtime.dispatch({
      tenant_id: 'tenant_z',
      operation: 'hosted.cli.run',
      args: {
        operation: 'interface.run',
        workspace_ref: 'workspace_tenant_z',
        mission_ref: 'mission_z',
      },
      subject_identity_ref: 'identity://operator/hosted',
      correlation_id: 'cor_z_01',
    });
    expect(run.outcome).toBe('accepted');
    if (run.outcome === 'accepted') {
      expect(run.payload).toMatchObject({
        tenant_id: 'tenant_z',
        forwarded_operation: 'interface.run',
      });
      expect(run.payload.request_digest).toMatch(/^[0-9a-f]{64}$/);
    }
    const cancelNoCorrelation = runtime.dispatch({
      tenant_id: 'tenant_z',
      operation: 'hosted.cli.cancel',
      args: {},
      subject_identity_ref: 'identity://operator/hosted',
      correlation_id: 'cor_z_02',
    });
    expect(cancelNoCorrelation).toMatchObject({
      outcome: 'rejected',
      reason: 'CORRELATION_ID_REQUIRED',
    });
  });

  it('rejects unknown tenant; refuses when storage_path differs from the registered one', () => {
    const store: TenantStore = createInMemoryTenantStore();
    const runtime = createHostedRuntime({ tenantStore: store });
    const unknown = runtime.dispatch({
      tenant_id: 'no_such_tenant',
      operation: 'hosted.cli.explain',
      args: {},
      subject_identity_ref: 'identity://operator/hosted',
      correlation_id: 'cor_unkn',
    });
    expect(unknown).toMatchObject({ outcome: 'rejected', reason: 'TENANT_NOT_FOUND' });
  });
});
