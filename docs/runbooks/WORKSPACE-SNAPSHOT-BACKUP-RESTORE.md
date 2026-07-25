# Workspace Snapshot Backup and Restore

Scope: single-host Local profile. A snapshot is an application-level Workspace export, not a byte copy of a live SQLite database.

## Preconditions

- Run from an OperatorOS Platform checkout with Node.js 22 and pnpm 9.
- Stop writers for the target Workspace during export and import.
- Keep the source artifact files readable until export completes.
- Restore into an initialized Workspace with the same `workspace_ref` and a new root path.

## Export

Use `createWorkspaceService(...).exportSnapshot({ workspace_ref, target_path })`. The v1.0 snapshot contains:

- schema and Workspace identity;
- artifact metadata;
- embedded artifact bytes;
- SHA-256 transport integrity and canonical content digest for every artifact.

Store the resulting JSON on operator-controlled encrypted storage. Do not edit it.

## Restore

1. Create a fresh Workspace store.
2. Initialize the same `workspace_ref` with the new root path.
3. Call `importSnapshot({ workspace_ref, root_path, source_path })`.
4. Treat any of these errors as a failed restore: `SNAPSHOT_SCHEMA_VERSION_UNSUPPORTED`, `WORKSPACE_REF_MISMATCH`, `SNAPSHOT_CONTENT_INTEGRITY_FAILED`, `SNAPSHOT_CONTENT_DIGEST_MISMATCH`.
5. Read every restored Artifact through Workspace Service and compare expected IDs and content.
6. Run the recovery fencing test before allowing resumed execution.

Import is transactional for authoritative SQLite rows. Content files are written before their rows and validated before writing; a rejected snapshot leaves no authoritative Artifact rows.

## Verification

```sh
pnpm exec vitest run packages/workspace-service/src/__tests__/workspace-service.test.ts
pnpm exec vitest run packages/recovery-service/src/__tests__/recovery-service.test.ts
```

The tests prove byte-preserving round trip, workspace mismatch rejection, digest-tamper rejection, and monotonic fencing after reopening the store.
