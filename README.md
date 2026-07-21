# OperatorOS Platform

Implementation of the frozen OperatorOS Platform architecture.

Status: **v1.0.0-rc1** — RC1 release candidate. All four milestones (M0..M4) closed, all four release gates (E, G, H, K) PASS, 132 tests passing across 20 files.

## Quick start

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm quality
```

`pnpm quality` runs:

- format:check (prettier)
- lint (eslint, --max-warnings 0)
- typecheck (tsc root + every package)
- test:coverage (vitest, 80/80/80/70 thresholds)
- build (turbo, every package)
- contracts:verify (8/8 frozen authorities)
- architecture:check (5/5 invariants)

Supplementary tooling:

- `pnpm docs:build` — typedoc API surface.
- `pnpm security:scan` — pnpm audit + source-pattern scan.
- `pnpm licenses:report` — production-dependency-licenses.json.
- `pnpm sbom` — CycloneDX-shaped SBOM.
- `pnpm spike:persistence` — SQLite WAL vs file journal.
- `pnpm test apps/smoke` — golden-path integration smoke.

## What this is

OperatorOS Platform is the canonical successor to OperatorOS v0.8.x, implemented as a separate monorepo at `/home/taras/projects/operatoros-platform/`. The v0.8 repo at `/home/taras/projects/operatoros/` remains **read-only** — a compatibility authority referenced by the v08-importer package.

The platform is structured around four authoritative surfaces — `contracts`, `evidence-service`, `workspace-service`, `execution-service` — surrounded by nine integration packages: `governance-service`, `interface-host`, `recovery-service`, `secrets-service`, `v08-importer`, `agent-execution`, `extension-runtime`, `hosted-runtime`, `distributed-coordination`.

The Local profile requires no network for authoritative Workspace operations and uses SQLite WAL for evidence persistence.

## Packages

| Package                                         | Purpose                                                                                         |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `@operatoros-platform/contracts`                | Public contract vocabulary (14 entities + 5 envelopes + 1 extension manifest).                  |
| `@operatoros-platform/evidence-service`         | Authoritative evidence ledger with mission records, mutation envelopes, integrity verification. |
| `@operatoros-platform/workspace-service`        | Workspace aggregate, Artifact aggregate, snapshot export/import.                                |
| `@operatoros-platform/execution-service`        | Mission Record + Run state machine (8 RUN_STATES) with optimistic concurrency.                  |
| `@operatoros-platform/governance-service`       | Operator Profile, Capability Grant, Configuration Revision, Effective Configuration projection. |
| `@operatoros-platform/interface-host`           | Local CLI dispatcher (in-process).                                                              |
| `@operatoros-platform/recovery-service`         | Recovery lease w/ fencing tokens, atomic checkpoint, dual-contender resolution.                 |
| `@operatoros-platform/secrets-service`          | Secret Reference + Security Baseline; preview-only secret material.                             |
| `@operatoros-platform/v08-importer`             | Non-destructive v0.8 -> v1.0 importer (READ-ONLY on v0.8).                                      |
| `@operatoros-platform/agent-execution`          | Agent registration + capability matching + invocation flow.                                     |
| `@operatoros-platform/extension-runtime`        | Extension lifecycle + boundary check + uninstall.                                               |
| `@operatoros-platform/hosted-runtime`           | Multi-tenant hosted CLI shape.                                                                  |
| `@operatoros-platform/distributed-coordination` | Peer registry + checkpoint anchoring + reconcile.                                               |
| `@operatoros-platform/smoke`                    | Golden-path integration smoke wiring all 13 packages.                                           |

## NFR matrix (RC1 evidence)

| NFR                            | Target              | Observed          |
| ------------------------------ | ------------------- | ----------------- |
| NFR-PERF throughput            | >= 1000 ops/sec     | 3850 ops/sec      |
| NFR-REL-2 RTO                  | < 30000 ms          | 40 ms             |
| NFR-OPS-1 local deployment     | isolated workspaces | 2 distinct stores |
| NFR-USE-1 cold start           | < 5000 ms           | 88 ms             |
| AV-O6 secret value never leaks | none                | none              |

## Architecture SHA-256 pin

`1e79049d9ae5a328556378ff8235525cd0f692bfa317fd7da6dc2bcdb1f27610` must remain unchanged through IP-V4. Verified on every CI run.

## Authority

- Frozen documents: `docs/authorities/`
- Machine lock: `authority-lock.json`
- Implementation roadmap: `docs/authorities/implementation-roadmap.md`

## Release candidate

RC1 artifacts at `artifacts/release-candidates/rc1/`:

- `rc1-manifest.json` — gates E/G/H/K pinned PASS.
- `CHANGELOG.md` — release notes.
- `final-report.md` — delivery summary.
- `technical-debt.md` — six items tracked.
- `v1.1-backlog.md` — backlog for the next minor.
- `migration-from-v08.md` — operator-facing migration.
- `architecture-deltas.md` — six intentional deviations from the frozen architecture.

## Documentation

- API reference (generated): `docs/api/index.html` — build with `pnpm docs:build`.
- ADRs: `docs/adr/`.
- Mission State: `/home/taras/projects/.project-state/operatoros-platform-m0-m4-implementation-2026-07-19/`.
