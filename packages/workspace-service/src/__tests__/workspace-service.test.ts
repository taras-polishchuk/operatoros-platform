import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  SUPPORTED_OPERATIONS,
  createWorkspaceService,
  deleteSnapshotIfExists,
  parseWorkspaceContract,
} from '../index.js';

const workspaceFixture = {
  kind: 'workspace',
  entity_id: 'ws_smoke',
  entity_schema_version: '1.0.0',
  workspace_ref: 'workspace_smoke',
  record_version: 1,
  created_at: '2026-07-19T18:00:00.000Z',
  updated_at: '2026-07-19T18:00:00.000Z',
  state: 'active',
  root: '/srv/ws/smoke',
};
const artifactFixture = {
  kind: 'artifact',
  entity_id: 'artifact_smoke',
  entity_schema_version: '1.0.0',
  workspace_ref: 'workspace_smoke',
  record_version: 1,
  created_at: '2026-07-19T18:00:00.000Z',
  updated_at: '2026-07-19T18:00:00.000Z',
  state: 'validated',
  artifact_kind: 'specification',
  content_ref: '/srv/ws/smoke/spec.json',
};

const tempDirectories: string[] = [];

async function makeWorkspace() {
  const dbRoot = await mkdtemp(join(tmpdir(), 'operatoros-ws-'));
  const snapRoot = join(dbRoot, 'snapshots');
  const wsRoot = join(dbRoot, 'ws');
  await mkdir(wsRoot, { recursive: true });
  tempDirectories.push(dbRoot);
  const workspaceId = `workspace_${Math.random().toString(36).slice(2, 8)}`;
  const service = createWorkspaceService({
    databasePath: join(dbRoot, 'db.sqlite'),
    snapshotsDirectory: snapRoot,
  });
  return {
    workspaceId,
    service,
    root: wsRoot,
    cleanup: async () => {
      service.close();
      await rm(dbRoot, { recursive: true, force: true });
    },
  };
}

beforeEach(() => {
  tempDirectories.length = 0;
});

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe('IP-005 Workspace Service', () => {
  it('declares the supported operation set', () => {
    expect(SUPPORTED_OPERATIONS).toContain('workspace.initialize');
    expect(SUPPORTED_OPERATIONS).toContain('artifact.create');
    expect(SUPPORTED_OPERATIONS).toContain('catalog.rebuild');
    expect(SUPPORTED_OPERATIONS).toContain('snapshot.export');
  });

  it('creates and activates a workspace with provenance and metadata', async () => {
    const ctx = await makeWorkspace();
    const init = ctx.service.initializeWorkspace({
      workspace_ref: ctx.workspaceId,
      root_path: ctx.root,
      subject_identity_ref: 'identity://operator/taras',
    });
    expect(init.outcome).toBe('committed');
    const initRecord = ctx.service.getWorkspaceRecord(ctx.workspaceId);
    expect(initRecord?.schema_version).toBe('1.0.0');

    const activate = ctx.service.activateWorkspace({
      workspace_ref: ctx.workspaceId,
      subject_identity_ref: 'identity://operator/taras',
      expected_version: 1,
    });
    expect(activate).toMatchObject({ outcome: 'committed', record_version: 2 });

    const record = ctx.service.getWorkspaceRecord(ctx.workspaceId);
    expect(record?.state).toBe('active');
    await ctx.cleanup();
  });

  it('rejects initialize that conflicts with an existing workspace', async () => {
    const ctx = await makeWorkspace();
    ctx.service.initializeWorkspace({
      workspace_ref: ctx.workspaceId,
      root_path: ctx.root,
      subject_identity_ref: 'identity://operator/taras',
    });
    const second = ctx.service.initializeWorkspace({
      workspace_ref: ctx.workspaceId,
      root_path: ctx.root,
      subject_identity_ref: 'identity://operator/taras',
    });
    expect(second).toMatchObject({ outcome: 'conflict', deciding_source: 'aggregate_records' });
    await ctx.cleanup();
  });

  it('persists an artifact with content digest, supersedes, and content_ref', async () => {
    const ctx = await makeWorkspace();
    ctx.service.initializeWorkspace({
      workspace_ref: ctx.workspaceId,
      root_path: ctx.root,
      subject_identity_ref: 'identity://operator/taras',
    });
    const first = ctx.service.createArtifact({
      workspace_ref: ctx.workspaceId,
      artifact_id: 'spec_01',
      artifact_kind: 'specification',
      content_ref: `${ctx.root}/spec_01.json`,
      content: Buffer.from(JSON.stringify({ subject: 'first' })),
      subject_identity_ref: 'identity://operator/taras',
    });
    expect(first.outcome).toBe('committed');
    if (first.outcome === 'committed') {
      expect(first.content_digest).toMatch(/^[0-9a-f]{64}$/);
    }

    const superseded = ctx.service.createArtifact({
      workspace_ref: ctx.workspaceId,
      artifact_id: 'spec_02',
      artifact_kind: 'specification',
      content_ref: `${ctx.root}/spec_02.json`,
      content: Buffer.from(JSON.stringify({ subject: 'second' })),
      supersedes: 'spec_01',
      subject_identity_ref: 'identity://operator/taras',
    });
    expect(superseded.outcome).toBe('committed');

    const previous = ctx.service.getArtifact({
      workspace_ref: ctx.workspaceId,
      artifact_id: 'spec_01',
    });
    expect(previous?.state).toBe('superseded');
    await ctx.cleanup();
  });

  it('reuses the contracts package exported parseContract for Workspace and Artifact schemas', async () => {
    const ctx = await makeWorkspace();
    const workspace = parseWorkspaceContract('entity.workspace', workspaceFixture);
    expect((workspace as { kind: string }).kind).toBe('workspace');
    const artifact = parseWorkspaceContract('entity.artifact', artifactFixture);
    expect((artifact as { kind: string }).kind).toBe('artifact');
    await ctx.cleanup();
  });

  it('rebuilds the catalog after delete and reproduces equivalent query results', async () => {
    const ctx = await makeWorkspace();
    ctx.service.initializeWorkspace({
      workspace_ref: ctx.workspaceId,
      root_path: ctx.root,
      subject_identity_ref: 'identity://operator/taras',
    });
    for (const i of [0, 1, 2, 3, 4]) {
      ctx.service.createArtifact({
        workspace_ref: ctx.workspaceId,
        artifact_id: `art_${String(i)}`,
        artifact_kind: 'specification',
        content_ref: `${ctx.root}/art_${String(i)}`,
        content: Buffer.from(`"${String(i)}"`),
        subject_identity_ref: 'identity://operator/taras',
      });
    }

    const beforeArtifacts = ctx.service.listArtifacts({ workspace_ref: ctx.workspaceId });
    expect(beforeArtifacts).toHaveLength(5);

    const rebuilt = ctx.service.rebuildCatalog({ workspace_ref: ctx.workspaceId });
    expect(rebuilt).toMatchObject({ outcome: 'projection_built', rebuilt_entities: 5 });

    const afterArtifacts = ctx.service.listArtifacts({ workspace_ref: ctx.workspaceId });
    expect(afterArtifacts).toEqual(beforeArtifacts);

    const projection = ctx.service.getProjection({ workspace_ref: ctx.workspaceId });
    expect(projection).toHaveLength(5);
    await ctx.cleanup();
  });

  it('exports a snapshot and imports it into a fresh workspace of the same workspace_ref', async () => {
    const sharedWorkspaceRef = `workspace_shared_${Math.random().toString(36).slice(2, 6)}`;
    const sharedRoot = await mkdtemp(join(tmpdir(), 'operatoros-snap-'));
    tempDirectories.push(sharedRoot);
    const snapshotPath = join(sharedRoot, 'snapshot.json');

    const sourceCtx = await makeWorkspace();
    sourceCtx.service.initializeWorkspace({
      workspace_ref: sharedWorkspaceRef,
      root_path: sourceCtx.root,
      subject_identity_ref: 'identity://operator/taras',
    });
    for (const i of [0, 1, 2]) {
      sourceCtx.service.createArtifact({
        workspace_ref: sharedWorkspaceRef,
        artifact_id: `art_${String(i)}`,
        artifact_kind: 'specification',
        content_ref: `${sourceCtx.root}/art_${String(i)}`,
        content: Buffer.from(`"${String(i)}"`),
        subject_identity_ref: 'identity://operator/taras',
      });
    }
    const exportResult = await sourceCtx.service.exportSnapshot({
      workspace_ref: sharedWorkspaceRef,
      target_path: snapshotPath,
    });
    expect(exportResult).toMatchObject({ outcome: 'snapshot_built', artifact_count: 3 });
    const snapshotRaw = await readFile(snapshotPath, 'utf8');
    const snapshot = JSON.parse(snapshotRaw) as { workspace_ref: string; artifacts: unknown[] };
    expect(snapshot.workspace_ref).toBe(sharedWorkspaceRef);
    expect(snapshot.artifacts).toHaveLength(3);
    await sourceCtx.cleanup();

    const targetCtx = await makeWorkspace();
    targetCtx.service.initializeWorkspace({
      workspace_ref: sharedWorkspaceRef,
      root_path: targetCtx.root,
      subject_identity_ref: 'identity://operator/taras',
    });
    const imported = await targetCtx.service.importSnapshot({
      workspace_ref: sharedWorkspaceRef,
      root_path: targetCtx.root,
      source_path: snapshotPath,
    });
    expect(imported).toMatchObject({ outcome: 'snapshot_imported', entities_imported: 3 });
    await targetCtx.cleanup();
  });

  it('refuses to import a snapshot whose workspace_ref does not match the target', async () => {
    const sourceCtx = await makeWorkspace();
    sourceCtx.service.initializeWorkspace({
      workspace_ref: sourceCtx.workspaceId,
      root_path: sourceCtx.root,
      subject_identity_ref: 'identity://operator/taras',
    });
    const snapshotPath = `/tmp/operatoros-tampered-${String(Date.now())}.json`;
    const tampered = {
      schema_version: '1.0.0',
      workspace_ref: 'other_workspace_ref',
      artifacts: [],
    };
    await writeFile(
      snapshotPath,
      `${JSON.stringify(tampered, null, 2)}
`,
    );
    const targetCtx = await makeWorkspace();
    targetCtx.service.initializeWorkspace({
      workspace_ref: targetCtx.workspaceId,
      root_path: targetCtx.root,
      subject_identity_ref: 'identity://operator/taras',
    });
    await expect(
      targetCtx.service.importSnapshot({
        workspace_ref: targetCtx.workspaceId,
        root_path: targetCtx.root,
        source_path: snapshotPath,
      }),
    ).rejects.toThrow(/WORKSPACE_REF_MISMATCH/u);
    await deleteSnapshotIfExists(snapshotPath);
    await sourceCtx.cleanup();
    await targetCtx.cleanup();
  });
});
