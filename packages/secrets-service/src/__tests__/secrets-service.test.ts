import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  SUPPORTED_OPERATIONS,
  SECURITY_BASELINE,
  SecretMaterializationForbiddenError,
  assertSecurityBaseline,
  createSqliteSecretStore,
  inMemorySecretBackend,
  resolveSecret,
} from '../index.js';

const tempDirectories: string[] = [];

async function makeStore() {
  const root = await mkdtemp(join(tmpdir(), 'operatoros-secrets-'));
  tempDirectories.push(root);
  const store = createSqliteSecretStore({ databasePath: join(root, 'secrets.sqlite') });
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

describe('IP-008 Security Baseline + Secret Reference', () => {
  it('declares the supported operation set', () => {
    expect(SUPPORTED_OPERATIONS).toContain('secret-reference.issue');
    expect(SUPPORTED_OPERATIONS).toContain('secret-reference.resolve');
    expect(SUPPORTED_OPERATIONS).toContain('security-baseline.assert');
  });

  it('asserts the canonical security baseline', () => {
    const assertion = assertSecurityBaseline();
    expect(assertion.enforcing).toBe(true);
    expect(assertion.baseline.enforce_no_secret_persistence).toBe(true);
    expect(assertion.baseline.enforce_workspace_isolation).toBe(true);
    expect(assertion.baseline.enforce_audit_trail).toBe(true);
    expect(SECURITY_BASELINE.enforce_no_secret_persistence).toBe(true);
  });

  it('issues a Secret Reference but never stores the secret value itself', async () => {
    const ctx = await makeStore();
    const issued = ctx.store.issueSecretReference({
      entity_id: 'secret_ref_01',
      secret_ref: 'env://runtime/api-key',
      backend: 'env-file',
      path: '/srv/ws/env/.env.api',
      placeholder: 'api-key-placeholder',
      workspace_ref: 'workspace_main',
    });
    expect(issued.outcome).toBe('committed');
    if (issued.outcome === 'committed') {
      expect(issued.record.placeholder_fingerprint).toMatch(/^[0-9a-f]{64}$/);
      // the literal placeholder string must not appear in any persisted column.
      expect(issued.record.path.includes('api-key-placeholder')).toBe(false);
      expect(issued.record.placeholder_fingerprint.startsWith('api-key-')).toBe(false);
    }
    const fetch = ctx.store.getSecretReference('env://runtime/api-key');
    expect(fetch?.placeholder_fingerprint).toMatch(/^[0-9a-f]{64}$/);
    await ctx.cleanup();
  });

  it('rejects issuing the same entity_id twice (no overwrite of security surface)', async () => {
    const ctx = await makeStore();
    ctx.store.issueSecretReference({
      entity_id: 'secret_ref_01',
      secret_ref: 'env://runtime/api-key',
      backend: 'env-file',
      path: '/srv/ws/env/.env.api',
      placeholder: 'placeholder',
      workspace_ref: 'workspace_main',
    });
    const dup = ctx.store.issueSecretReference({
      entity_id: 'secret_ref_01',
      secret_ref: 'env://runtime/api-key',
      backend: 'env-file',
      path: '/srv/ws/env/.env.api',
      placeholder: 'placeholder',
      workspace_ref: 'workspace_main',
    });
    expect(dup).toMatchObject({ outcome: 'conflict', deciding_source: 'aggregate_records' });
    await ctx.cleanup();
  });

  it('resolves via an explicit backend and exposes only an in-memory preview, never the raw value', async () => {
    const ctx = await makeStore();
    ctx.store.issueSecretReference({
      entity_id: 'secret_ref_02',
      secret_ref: 'env://runtime/token',
      backend: 'env-file',
      path: '/srv/ws/env/.env.token',
      placeholder: 'placeholder-prefix',
      workspace_ref: 'workspace_main',
    });
    const backend = inMemorySecretBackend({ 'env://runtime/token': 'super-secret-token-value' });
    const resolution = await resolveSecret(ctx.store, backend, {
      secret_ref: 'env://runtime/token',
      caller_ref: 'identity://operator/taras',
    });
    expect(resolution.state).toBe('resolved');
    expect(resolution.materialization).toBe('in-memory-only');
    expect(resolution.preview).toBe('supe…');
    expect(resolution.preview?.includes('super-secret-token-value')).toBe(false);
    await ctx.cleanup();
  });

  it('returns "absent" when the backend has no material for an active Secret Reference', async () => {
    const ctx = await makeStore();
    ctx.store.issueSecretReference({
      entity_id: 'secret_ref_03',
      secret_ref: 'env://runtime/token',
      backend: 'env-file',
      path: '/srv/ws/env/.env.token',
      placeholder: 'placeholder',
      workspace_ref: 'workspace_main',
    });
    const backend = inMemorySecretBackend();
    const resolution = await resolveSecret(ctx.store, backend, {
      secret_ref: 'env://runtime/token',
      caller_ref: 'identity://operator/taras',
    });
    expect(resolution).toMatchObject({ state: 'absent', materialization: 'never-stored' });
    await ctx.cleanup();
  });

  it('returns "forbidden" when the Secret Reference is no longer active', async () => {
    const ctx = await makeStore();
    ctx.store.issueSecretReference({
      entity_id: 'secret_ref_04',
      secret_ref: 'env://runtime/token',
      backend: 'env-file',
      path: '/srv/ws/env/.env.token',
      placeholder: 'placeholder',
      workspace_ref: 'workspace_main',
    });
    ctx.store.revokeSecretReference({
      entity_id: 'secret_ref_04',
      expected_version: 1,
      revoker_ref: 'identity://admin/taras',
    });
    const backend = inMemorySecretBackend({ 'env://runtime/token': 'super-secret' });
    const resolution = await resolveSecret(ctx.store, backend, {
      secret_ref: 'env://runtime/token',
      caller_ref: 'identity://operator/taras',
    });
    expect(resolution).toMatchObject({ state: 'forbidden', materialization: 'never-stored' });
    await ctx.cleanup();
  });

  it('rotates a Secret Reference and chains the successor', async () => {
    const ctx = await makeStore();
    ctx.store.issueSecretReference({
      entity_id: 'secret_ref_05',
      secret_ref: 'env://runtime/token',
      backend: 'env-file',
      path: '/srv/ws/env/.env.token',
      placeholder: 'first-placeholder',
      workspace_ref: 'workspace_main',
    });
    const rotated = ctx.store.rotateSecretReference({
      entity_id: 'secret_ref_05',
      expected_version: 1,
      successor_entity_id: 'secret_ref_05_rot1',
      new_placeholder: 'second-placeholder',
    });
    expect(rotated).toMatchObject({ outcome: 'committed' });
    const first = ctx.store.getSecretReference('env://runtime/token');
    expect(first?.state).toBe('rotated');
    await ctx.cleanup();
  });

  it('exposes the security baseline class for downstream consumers', () => {
    expect(SecretMaterializationForbiddenError.name).toBe('SecretMaterializationForbiddenError');
  });
});
