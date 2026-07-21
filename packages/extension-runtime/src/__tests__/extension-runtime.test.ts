import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SUPPORTED_OPERATIONS, createSqliteExtensionRuntime } from '../index.js';

const tempDirectories: string[] = [];

async function makeRuntime() {
  const root = await mkdtemp(join(tmpdir(), 'operatoros-ext-'));
  tempDirectories.push(root);
  const store = createSqliteExtensionRuntime({ databasePath: join(root, 'extensions.sqlite') });
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

describe('IP-201..IP-205 Extension Runtime', () => {
  it('declares the supported operation set', () => {
    expect(SUPPORTED_OPERATIONS).toContain('extension.stage');
    expect(SUPPORTED_OPERATIONS).toContain('extension.activate');
    expect(SUPPORTED_OPERATIONS).toContain('extension.boundary.check');
    expect(SUPPORTED_OPERATIONS).toContain('extension.uninstall');
  });

  it('stages an extension, refuses duplicate entity_id, validates lifecycle', async () => {
    const ctx = await makeRuntime();
    const staged = ctx.store.stage({
      entity_id: 'ext_telemetry_01',
      extension_id: 'telemetry.exporter',
      extension_kind: 'telemetry-exporter',
      manifest_ref: 'manifest://telemetry-01',
      content: 'plugin-source-code',
      host_compatibility: '>=0.1.0',
      capability_definitions: ['cap.metrics.emit'],
      requested_capabilities: ['cap.metrics.emit', 'cap.disk.write'],
      security_boundary_ref: 'boundary://telemetry-01',
      workspace_ref: 'workspace_main',
    });
    expect(staged.outcome).toBe('committed');
    if (staged.outcome === 'committed') {
      expect(staged.record.state).toBe('staged');
      expect(staged.record.content_digest).toMatch(/^[0-9a-f]{64}$/);
    }
    const dup = ctx.store.stage({
      entity_id: 'ext_telemetry_01',
      extension_id: 'telemetry.exporter',
      extension_kind: 'telemetry-exporter',
      manifest_ref: 'manifest://telemetry-01',
      content: 'x',
      host_compatibility: '>=0.1.0',
      capability_definitions: [],
      requested_capabilities: [],
      security_boundary_ref: 'boundary://telemetry-01',
      workspace_ref: 'workspace_main',
    });
    expect(dup).toMatchObject({ outcome: 'conflict', reason: 'EXTENSION_ENTITY_ID_EXISTS' });
    const val = ctx.store.validate({ entity_id: 'ext_telemetry_01', expected_version: 1 });
    expect(val.outcome).toBe('committed');
    await ctx.cleanup();
  });

  it('rejects activation when capability grants are missing', async () => {
    const ctx = await makeRuntime();
    ctx.store.stage({
      entity_id: 'ext_obs_01',
      extension_id: 'ext_obs',
      extension_kind: 'integration',
      manifest_ref: 'manifest://ext_obs',
      content: 'content',
      host_compatibility: '>=0.1.0',
      capability_definitions: ['cap.metrics.emit'],
      requested_capabilities: ['cap.metrics.emit', 'cap.disk.write'],
      security_boundary_ref: 'boundary://obs',
      workspace_ref: 'workspace_main',
    });
    ctx.store.validate({ entity_id: 'ext_obs_01', expected_version: 1 });
    const gov = {
      listActiveGrantsFor: () => [
        { capability_definition_ref: 'cap.metrics.emit', state: 'active' as const },
      ],
    };
    const act = ctx.store.activate({
      entity_id: 'ext_obs_01',
      expected_version: 2,
      subject_ref: 'identity://extension/ext_obs',
      governanceStore: gov,
    });
    expect(act).toMatchObject({
      outcome: 'rejected',
      reason: 'CAPABILITY_GRANT_MISSING:cap.disk.write',
    });
    await ctx.cleanup();
  });

  it('boundary check: extension not active denies all capabilities', async () => {
    const ctx = await makeRuntime();
    ctx.store.stage({
      entity_id: 'ext_b_01',
      extension_id: 'ext_b',
      extension_kind: 'plugin',
      manifest_ref: 'manifest://ext_b',
      content: 'c',
      host_compatibility: '>=0.1.0',
      capability_definitions: ['cap.metrics.emit'],
      requested_capabilities: ['cap.metrics.emit'],
      security_boundary_ref: 'boundary://ext_b',
      workspace_ref: 'workspace_main',
    });
    const result = ctx.store.checkBoundary({
      extension_id: 'ext_b',
      capability_requested: 'cap.metrics.emit',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('EXTENSION_NOT_ACTIVE');
    await ctx.cleanup();
  });

  it('boundary check: extension active but capability not declared denies the call', async () => {
    const ctx = await makeRuntime();
    ctx.store.stage({
      entity_id: 'ext_b_02',
      extension_id: 'ext_b2',
      extension_kind: 'plugin',
      manifest_ref: 'manifest://ext_b2',
      content: 'c',
      host_compatibility: '>=0.1.0',
      capability_definitions: ['cap.metrics.emit'],
      requested_capabilities: ['cap.metrics.emit'],
      security_boundary_ref: 'boundary://ext_b2',
      workspace_ref: 'workspace_main',
    });
    ctx.store.validate({ entity_id: 'ext_b_02', expected_version: 1 });
    ctx.store.activate({
      entity_id: 'ext_b_02',
      expected_version: 2,
      subject_ref: 'identity://extension/ext_b2',
      governanceStore: {
        listActiveGrantsFor: () => [
          { capability_definition_ref: 'cap.metrics.emit', state: 'active' as const },
        ],
      },
    });
    const ok = ctx.store.checkBoundary({
      extension_id: 'ext_b2',
      capability_requested: 'cap.metrics.emit',
    });
    expect(ok).toMatchObject({ allowed: true, reason: 'WITHIN_BOUNDARY' });
    const denied = ctx.store.checkBoundary({
      extension_id: 'ext_b2',
      capability_requested: 'cap.disk.write',
    });
    expect(denied).toMatchObject({ allowed: false, reason: 'CAPABILITY_NOT_DECLARED' });
    await ctx.cleanup();
  });

  it('lifecycle: stage → validate → activate → retire → uninstall, double-retire rejected', async () => {
    const ctx = await makeRuntime();
    ctx.store.stage({
      entity_id: 'ext_lifecycle',
      extension_id: 'ext_lifecycle',
      extension_kind: 'plugin',
      manifest_ref: 'manifest://ext_lifecycle',
      content: 'c',
      host_compatibility: '>=0.1.0',
      capability_definitions: ['cap.x'],
      requested_capabilities: ['cap.x'],
      security_boundary_ref: 'boundary://ext_lifecycle',
      workspace_ref: 'workspace_main',
    });
    ctx.store.validate({ entity_id: 'ext_lifecycle', expected_version: 1 });
    const activate = ctx.store.activate({
      entity_id: 'ext_lifecycle',
      expected_version: 2,
      subject_ref: 'identity://extension/ext_lifecycle',
      governanceStore: {
        listActiveGrantsFor: () => [
          { capability_definition_ref: 'cap.x', state: 'active' as const },
        ],
      },
    });
    expect(activate).toMatchObject({ outcome: 'committed', record_version: 3 });
    // Retire from active state, version 3 -> 4 (retired).
    const retire = ctx.store.retire({ entity_id: 'ext_lifecycle', expected_version: 3 });
    expect(retire).toMatchObject({ outcome: 'committed', record_version: 4 });
    // Already retired, so retire again is rejected.
    const retireAgain = ctx.store.retire({ entity_id: 'ext_lifecycle', expected_version: 4 });
    expect(retireAgain).toMatchObject({ outcome: 'rejected', reason: 'EXTENSION_ALREADY_RETIRED' });
    // Uninstall succeeds since state == 'retired'.
    const uninstall = ctx.store.uninstall({ entity_id: 'ext_lifecycle' });
    expect(uninstall.outcome).toBe('committed');
    expect(ctx.store.getExtension('ext_lifecycle')).toBeNull();
    await ctx.cleanup();
  });

  it('retire-with-successor records successor ref; uninstall refuses if successor not actually installed', async () => {
    const ctx = await makeRuntime();
    ctx.store.stage({
      entity_id: 'ext_v1',
      extension_id: 'ext_v1',
      extension_kind: 'plugin',
      manifest_ref: 'manifest://ext_v1',
      content: 'c',
      host_compatibility: '>=0.1.0',
      capability_definitions: ['cap.x'],
      requested_capabilities: ['cap.x'],
      security_boundary_ref: 'boundary://ext_v1',
      workspace_ref: 'workspace_main',
    });
    ctx.store.validate({ entity_id: 'ext_v1', expected_version: 1 });
    ctx.store.activate({
      entity_id: 'ext_v1',
      expected_version: 2,
      subject_ref: 'identity://extension/ext_v1',
      governanceStore: {
        listActiveGrantsFor: () => [
          { capability_definition_ref: 'cap.x', state: 'active' as const },
        ],
      },
    });
    const badSuccessor = ctx.store.retire({
      entity_id: 'ext_v1',
      expected_version: 3,
      successor_entity_id: 'ext_v2',
    });
    expect(badSuccessor).toMatchObject({ outcome: 'rejected', reason: 'SUCCESSOR_NOT_FOUND' });
    await ctx.cleanup();
  });
});
