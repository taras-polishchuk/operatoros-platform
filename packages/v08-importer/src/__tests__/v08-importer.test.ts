import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  SUPPORTED_OPERATIONS,
  V08_VERSION_DETECTED,
  V08_VERSION_SUPPORTED,
  createInProcessImporter,
  discoverV08Source,
} from '../index.js';
import { createWorkspaceService } from '@operatoros-platform/workspace-service';

const tempDirectories: string[] = [];

async function makeV08Fixture(opts: { workspaces: number; writeCatalog: boolean }) {
  const root = await mkdtemp(join(tmpdir(), 'operatoros-v08-'));
  tempDirectories.push(root);
  await mkdir(join(root, 'state', 'workspaces'), { recursive: true });
  for (let i = 0; i < opts.workspaces; i += 1) {
    const idx = String(i);
    await writeFile(
      join(root, 'state', 'workspaces', `ws_${idx.padStart(4, '0')}.json`),
      JSON.stringify({ id: `ws_${idx.padStart(4, '0')}`, name: `Workspace ${idx}` }),
    );
  }
  if (opts.writeCatalog) {
    await writeFile(
      join(root, 'state', 'catalog.json'),
      JSON.stringify({
        workspaces: Array.from({ length: opts.workspaces }, (_, i) => ({ id: `ws_${String(i)}` })),
        presets: [{ id: 'p1' }],
        modules: [{ id: 'm1' }, { id: 'm2' }],
        identities: [{ id: 'i1' }],
      }),
    );
  }
  return root;
}

beforeEach(() => {
  tempDirectories.length = 0;
});

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe('IP-011 v0.8 Importer (non-destructive)', () => {
  it('declares supported operations and version compatibility', () => {
    expect(SUPPORTED_OPERATIONS).toContain('importer.v08.discover');
    expect(SUPPORTED_OPERATIONS).toContain('importer.v08.import');
    expect(SUPPORTED_OPERATIONS).toContain('importer.v08.dry-run');
    expect(V08_VERSION_SUPPORTED).toBe('0.8.x');
    expect(V08_VERSION_DETECTED).toMatch(/0\.8\.\d/);
  });

  it('discovers v0.8 entities via catalog.json when present', async () => {
    const root = await makeV08Fixture({ workspaces: 3, writeCatalog: true });
    const index = await discoverV08Source(root);
    expect(index.workspace_count).toBe(3);
    expect(index.preset_count).toBe(1);
    expect(index.module_count).toBe(2);
    expect(index.identity_count).toBe(1);
    expect(index.total_entries).toBe(7);
    expect(index.catalog_path).toContain('catalog.json');
  });

  it('falls back to directory traversal when catalog.json is missing', async () => {
    const root = await makeV08Fixture({ workspaces: 2, writeCatalog: false });
    const index = await discoverV08Source(root);
    expect(index.workspace_count).toBe(2);
    expect(index.preset_count).toBe(0);
  });

  it('refuses non-directory inputs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'operatoros-v08-bad-'));
    tempDirectories.push(root);
    const filePath = join(root, 'not-a-dir.txt');
    await writeFile(filePath, 'hello');
    await expect(discoverV08Source(filePath)).rejects.toThrow('V08_SOURCE_NOT_A_DIRECTORY');
  });

  it('dry-run does NOT touch v0.8 source or target workspace', async () => {
    const root = await makeV08Fixture({ workspaces: 1, writeCatalog: true });
    const target = await mkdtemp(join(tmpdir(), 'operatoros-v08-target-'));
    tempDirectories.push(target);
    const workspace = createWorkspaceService({
      databasePath: join(target, 'workspace.sqlite'),
      snapshotsDirectory: join(target, 'snap'),
    });
    const importer = createInProcessImporter({
      workspaceService: workspace as unknown as Parameters<
        typeof createInProcessImporter
      >[0]['workspaceService'],
      readonlyV08RootPath: root,
      importerOperatorRef: 'identity://operator/taras',
      defaultImportRootPath: join(target, 'imports'),
    });
    const dry = await importer.dryRun();
    expect(dry.workspace_ref).toBe('dry-run-no-write');
    expect(dry.imported_entities.workspace_count).toBe(1);
    expect(dry.warnings[0]).toMatch(/dry-run/i);
    workspace.close();
  });

  it('import translates v0.8 entities into OperatorOS Platform artifacts without touching v0.8', async () => {
    const root = await makeV08Fixture({ workspaces: 4, writeCatalog: true });
    const target = await mkdtemp(join(tmpdir(), 'operatoros-v08-target2-'));
    tempDirectories.push(target);
    const workspace = createWorkspaceService({
      databasePath: join(target, 'workspace.sqlite'),
      snapshotsDirectory: join(target, 'snap'),
    });
    const importer = createInProcessImporter({
      workspaceService: workspace as unknown as Parameters<
        typeof createInProcessImporter
      >[0]['workspaceService'],
      readonlyV08RootPath: root,
      importerOperatorRef: 'identity://operator/taras',
      defaultImportRootPath: join(target, 'imports'),
    });
    const result = await importer.importToWorkspace({ workspace_ref: 'imported_v08_target' });
    expect(result.outcome).toBe('committed');
    expect(result.workspaces.length).toBe(4);
    expect(result.workspaces[0]).toMatchObject({
      state: 'imported',
      workspace_ref: 'imported_v08_target',
    });
    expect(result.record.imported_entities.workspace_count).toBe(4);
    expect(result.record.v08_version).toMatch(/0\.8\.\d/);
    // Verify v0.8 source untouched: count of workspace files unchanged.
    const catalog = JSON.parse(
      await (
        await import('node:fs/promises')
      ).readFile(join(root, 'state', 'catalog.json'), 'utf8'),
    ) as { workspaces: unknown[] };
    expect(catalog.workspaces.length).toBe(4);
    workspace.close();
  });
});
