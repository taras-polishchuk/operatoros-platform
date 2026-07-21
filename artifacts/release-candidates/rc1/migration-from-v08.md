# Migration Notes — OperatorOS v0.8.x → OperatorOS Platform v1.0

## Scope

This document describes how to migrate a workspace from OperatorOS v0.8.x (CHANGELOG v0.8.2) to OperatorOS Platform v1.0.

## Pre-flight

1. Make sure the v0.8 source is on a stable release (v0.8.x).
2. Run the dry-run importer (`importer.v08.dry-run`) and inspect the workspace catalog.
3. Identify which v0.8 entities need to be carried over: workspaces, presets, modules, identities.

## Procedure

```ts
import { createInProcessImporter } from '@operatoros-platform/v08-importer';
import { createWorkspaceService } from '@operatoros-platform/workspace-service';

const importer = createInProcessImporter({
  readonlyV08RootPath: '/path/to/operatoros/v0.8.x',
  importerOperatorRef: 'identity://operator/<your-handle>',
  defaultImportRootPath: '/srv/operatoros-platform/imports',
  workspaceService: createWorkspaceService({
    databasePath: '/srv/operatoros-platform/workspace.sqlite',
    snapshotsDirectory: '/srv/operatoros-platform/snap',
  }),
});

// Step 1 — dry run.
const dry = await importer.dryRun();
console.log(dry);

// Step 2 — actual import.
const result = await importer.importToWorkspace({ workspace_ref: 'migrated_from_v08' });
console.log(result);
```

The importer is READ-ONLY on the v0.8 source. It produces OperatorOS Platform `artifact` records, one per v0.8 workspace, plus a manifest artifact.

## Post-migration

- Re-activate any agents you were running under v0.8 (the v0.8 schema does not include the Operator Profile / Capability Grant vocabulary).
- Re-issue Secret References through OperatorOS Platform's `secrets-service` (the v0.8 env-file conventions carry over but the registry is now SQLite-backed).
- Re-anchor any pending Recovery Leases; the v0.8 in-memory coordination does not have a v1.0-equivalent lease.

## Compatibility notes

- v0.8 `v0.8.0` (core/package.json) and `v0.8.2` (CHANGELOG) are both detected by `V08_VERSION_SUPPORTED: '0.8.x'`.
- v0.8 identities, presets, modules, and catalogs are mapped 1:1 to OperatorOS Platform artifacts.
- No v0.8 data is migrated to Operator Profile or Capability Grant — these are operator-managed post-migration.
