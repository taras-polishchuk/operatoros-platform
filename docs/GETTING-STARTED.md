# Getting Started

This guide takes about five minutes and uses the repository's golden path. It keeps all data in an isolated temporary workspace.

## 1. Install

```sh
corepack enable
pnpm install --frozen-lockfile
```

## 2. Initialize a Workspace

A Workspace is the operator-scoped container for artifacts, grants, configuration, and Mission references. The service factory and schemas live in `packages/workspace-service/src/`.

For the executable onboarding path, build and invoke the CLI:

```sh
pnpm --filter @operatoros-platform/cli build
node apps/cli/dist/index.js --workspace /tmp/operatoros-demo init
node apps/cli/dist/index.js --workspace /tmp/operatoros-demo explain --json
```

For library composition, the concrete factory requires both SQLite and snapshot paths:

```ts
import { createWorkspaceService } from '@operatoros-platform/workspace-service';

const workspace = createWorkspaceService({
  databasePath: '/tmp/operatoros-demo/workspace.sqlite',
  snapshotsDirectory: '/tmp/operatoros-demo/snapshots',
});
```

## 3. Create a Mission Record

Define the Mission Execution Specification through Workspace Service, then create a Mission Record through Execution Service. A Mission is named declarative intent. A Run is one execution of that intent. A Mission Record is the durable evidence record for a Run and can be sealed after terminal evidence is verified. The smoke composition in `apps/smoke/src/index.ts` is the executable reference for the complete set of factories and identity envelopes.

## 4. Run a Mission

For a verified first run from source:

```sh
pnpm test apps/smoke
```

The smoke flow creates an isolated Workspace, grants a capability, dispatches an interface operation, registers agent/extension paths, and closes its stores cleanly.

## 5. Inspect evidence

Evidence Service owns append, integrity verification, Mission Record indexing, and sealing. Inspect the returned event/evidence references rather than inferring success from a projection. See `packages/evidence-service/src/` and [Architecture](ARCHITECTURE.md).

## 6. Cancel safely

Cancellation is an attributed interface command. Use the same workspace, identity, correlation, and request context as the Run, then inspect the resulting evidence. A lost response is safe to retry with the same request key; do not create a new key to bypass idempotency.

## Quick architecture

```text
operator/surface
       |
       v
Interface Host --> Workspace Service --> Evidence Service
       |                  ^                 ^
       +--> Execution Service -------------+
```

The four components share contracts; evidence and authoritative records outlive processes, caches, and projections.
