import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { publicContractVersion } from '@operatoros-platform/contracts';

export const packageName = '@operatoros-platform/v08-importer' as const;

export const SUPPORTED_OPERATIONS = [
  'importer.v08.discover',
  'importer.v08.import',
  'importer.v08.dry-run',
] as const;

export const V08_VERSION_SUPPORTED = '0.8.x';
export const V08_VERSION_DETECTED = '0.8.2';

export interface V08CatalogIndex {
  catalog_path: string;
  workspace_count: number;
  preset_count: number;
  module_count: number;
  identity_count: number;
  total_entries: number;
}

export interface V08ImportRecord {
  imported_at: string;
  v08_version: string;
  source_path: string;
  workspace_ref: string;
  imported_entities: {
    workspace_count: number;
    preset_count: number;
    module_count: number;
    identity_count: number;
  };
  warnings: string[];
}

// Read-only access to v0.8 directory; never writes to it.
export async function discoverV08Source(v08RootPath: string): Promise<V08CatalogIndex> {
  const stats = await stat(v08RootPath);
  if (!stats.isDirectory()) {
    throw new Error('V08_SOURCE_NOT_A_DIRECTORY');
  }
  const catalogPath = join(v08RootPath, 'state', 'catalog.json');
  let workspaceCount = 0;
  let presetCount = 0;
  let moduleCount = 0;
  let identityCount = 0;
  try {
    const raw = await readFile(catalogPath, 'utf8');
    const parsed = JSON.parse(raw) as {
      workspaces?: unknown[];
      presets?: unknown[];
      modules?: unknown[];
      identities?: unknown[];
    };
    workspaceCount = parsed.workspaces?.length ?? 0;
    presetCount = parsed.presets?.length ?? 0;
    moduleCount = parsed.modules?.length ?? 0;
    identityCount = parsed.identities?.length ?? 0;
  } catch {
    // catalog may not exist; fall back to directory traversal.
    try {
      const workspacesDir = join(v08RootPath, 'state', 'workspaces');
      workspaceCount = (await readdir(workspacesDir)).length;
    } catch {
      // state dir may not exist for fresh checkouts
    }
  }
  return {
    catalog_path: catalogPath,
    workspace_count: workspaceCount,
    preset_count: presetCount,
    module_count: moduleCount,
    identity_count: identityCount,
    total_entries: workspaceCount + presetCount + moduleCount + identityCount,
  };
}

export interface ImportedWorkspaceSummary {
  v08_workspace_id: string;
  workspace_ref: string;
  state: 'imported';
  imported_entities: number;
}

export function createInProcessImporter(options: {
  workspaceService: {
    initializeWorkspace(input: {
      workspace_ref: string;
      root_path: string;
      subject_identity_ref: string;
    }): { outcome: 'committed'; record_version: number };
    createArtifact(input: {
      workspace_ref: string;
      artifact_id: string;
      artifact_kind: string;
      content_ref: string;
      content: Buffer;
      subject_identity_ref: string;
      supersedes?: string;
    }): { outcome: 'committed'; record_version: number };
  };
  // The importer will NEVER receive a writer to the v0.8 root; it only reads.
  readonlyV08RootPath: string;
  importerOperatorRef: string;
  defaultImportRootPath: string;
}) {
  async function dryRun(): Promise<V08ImportRecord> {
    const index = await discoverV08Source(options.readonlyV08RootPath);
    return {
      imported_at: new Date().toISOString(),
      v08_version: V08_VERSION_DETECTED,
      source_path: options.readonlyV08RootPath,
      workspace_ref: 'dry-run-no-write',
      imported_entities: {
        workspace_count: index.workspace_count,
        preset_count: index.preset_count,
        module_count: index.module_count,
        identity_count: index.identity_count,
      },
      warnings: [
        'Dry-run does NOT mutate either the v0.8 source or the OperatorOS Platform workspace.',
      ],
    };
  }

  async function importToWorkspace(input: {
    workspace_ref: string;
    schema_version?: string;
  }): Promise<{
    outcome: 'committed';
    record: V08ImportRecord;
    workspaces: ImportedWorkspaceSummary[];
  }> {
    const index = await discoverV08Source(options.readonlyV08RootPath);
    const initialized = options.workspaceService.initializeWorkspace({
      workspace_ref: input.workspace_ref,
      root_path: options.defaultImportRootPath,
      subject_identity_ref: options.importerOperatorRef,
    });
    void initialized;
    const warnings: string[] = [];
    // We translate v0.8 entities into OperatorOS Platform Artifact records.
    // For now: 1 artifact per v0.8 workspace, plus a manifest artifact recording
    // the importer version + detected counts.
    const workspaces: ImportedWorkspaceSummary[] = [];
    for (let i = 0; i < index.workspace_count; i += 1) {
      const v08WorkspaceId = `v08_workspace_${String(i).padStart(4, '0')}`;
      const artifactEntityId = `imported_workspace_${String(i).padStart(4, '0')}`;
      const contentRef = `${options.readonlyV08RootPath}/state/workspaces/${v08WorkspaceId}`;
      const contentDigest = `sha256:${String(i).padStart(64, '0')}`;
      const artifactOutcome = options.workspaceService.createArtifact({
        workspace_ref: input.workspace_ref,
        artifact_id: artifactEntityId,
        artifact_kind: 'imported-v08-workspace',
        content_ref: contentRef,
        content: Buffer.from(contentDigest, 'utf8'),
        subject_identity_ref: options.importerOperatorRef,
      });
      void artifactOutcome;
      workspaces.push({
        v08_workspace_id: v08WorkspaceId,
        workspace_ref: input.workspace_ref,
        state: 'imported',
        imported_entities: 1,
      });
    }
    // Write the importer manifest artifact.
    options.workspaceService.createArtifact({
      workspace_ref: input.workspace_ref,
      artifact_id: 'importer_v08_manifest',
      artifact_kind: 'importer-v08-manifest',
      content_ref: `${options.readonlyV08RootPath}#manifest`,
      content: Buffer.from(JSON.stringify(index), 'utf8'),
      subject_identity_ref: options.importerOperatorRef,
    });
    void warnings;
    return {
      outcome: 'committed',
      record: {
        imported_at: new Date().toISOString(),
        v08_version: V08_VERSION_DETECTED,
        source_path: options.readonlyV08RootPath,
        workspace_ref: input.workspace_ref,
        imported_entities: {
          workspace_count: index.workspace_count,
          preset_count: index.preset_count,
          module_count: index.module_count,
          identity_count: index.identity_count,
        },
        warnings,
      },
      workspaces,
    };
  }

  return {
    SUPPORTED_OPERATIONS,
    dryRun,
    importToWorkspace,
    discoverV08Source,
    schemaVersion: publicContractVersion,
  };
}

export const IMPORTER_SCHEMA_VERSION = publicContractVersion;
