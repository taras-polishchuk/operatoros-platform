# OperatorOS Platform

[![Build](https://img.shields.io/badge/release%20candidate-local%20validation-informational)](docs/RELEASE-PROCESS.md) [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Coverage gates](https://img.shields.io/badge/coverage%20gates-80%2F80%2F80%2F70-informational)](artifacts/release-candidates/v1.0/QUALITY-GATE.md)

**Local-first Mission execution with an evidence ledger.**

## What is this?

OperatorOS Platform is an operator-controlled execution platform for named Missions. A Mission is durable intent; each Run is an execution with explicit state, optimistic concurrency, and recoverable checkpoints. The evidence ledger records what was acknowledged instead of allowing a projection to guess success.

The Local profile is the default: canonical Workspace operations work without a network and evidence is persisted in SQLite WAL. The platform is a TypeScript monorepo with four authoritative implementation components plus integration packages for agents, extensions, secrets, recovery, and migration. Hosted runtime and distributed coordination are tested contract/primitives packages, not bundled production deployments. See `packages/execution-service/src/` and `packages/evidence-service/src/` for the core implementation.

This checkout contains the v1.0 release-candidate implementation. M0..M4 are closed and release gates E, G, H, and K have repository evidence; publication and tagging remain separate operator-authorized steps. The architecture remains pinned at SHA-256 `1e79049d9ae5a328556378ff8235525cd0f692bfa317fd7da6dc2bcdb1f27610`.

## Why?

Automation without trustworthy state leaves operators unable to answer: what ran, under whose authority, what changed, and whether recovery is safe. OperatorOS makes the operator the final authority: capabilities are explicitly granted, evidence is durable and sealed, unknown outcomes remain unresolved, and recovery uses fencing rather than hope. The promise is evidence over inference and a local canonical record even when the network is unavailable.

## First Mission

The following is the smallest repository-backed smoke path; it runs the golden integration wiring and prints a report:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm test apps/smoke
```

For the guided five-minute flow, see [Getting Started](docs/GETTING-STARTED.md). Source integrators can compose the factories exported from `packages/workspace-service/src/`, `packages/execution-service/src/`, and `packages/evidence-service/src/`. The workspace packages are private monorepo units in v1.0; no registry package or standalone SDK is published.

For a one-command maintained demonstration, run `pnpm demo`. For the complete repository acceptance sequence, run `pnpm clean-tree:verify`.

## Quick start

Requirements: Node.js 22+, pnpm 9, and 2 GB RAM.

```sh
git clone https://github.com/taras-polishchuk/operatoros-platform.git
cd operatoros-platform
corepack enable
pnpm install --frozen-lockfile
pnpm quality
pnpm test apps/smoke
```

The smoke run initializes an isolated Workspace, records a Mission, exercises capability and extension paths, and verifies evidence. Installation and troubleshooting details are in [Installation](docs/INSTALLATION.md).

## Architecture

Four replaceable components implement one shared Domain contract:

```text
Interface Host ──┬──> Workspace Service ──┐
                 └──> Execution Service ──┼──> Evidence Service
                                          └──> Workspace commands
```

Read the [architecture guide](docs/ARCHITECTURE.md) and the frozen [architecture authority](docs/authorities/architecture.md). The authority lock is `authority-lock.json`; do not change either it or the pinned SHA without the formal successor-ADR process.

## Packages

| Package                                         | Purpose                                                                                             |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `@operatoros-platform/contracts`                | Public contract vocabulary (14 entities + 5 envelopes + 1 extension manifest).                      |
| `@operatoros-platform/evidence-service`         | Authoritative evidence ledger with Mission Records, mutation envelopes, and integrity verification. |
| `@operatoros-platform/workspace-service`        | Workspace and Artifact aggregates, snapshot export/import.                                          |
| `@operatoros-platform/execution-service`        | Mission Record + Run state machine (8 `RUN_STATES`) with optimistic concurrency.                    |
| `@operatoros-platform/governance-service`       | Operator Profile, Capability Grant, Configuration Revision, Effective Configuration projection.     |
| `@operatoros-platform/interface-host`           | Shared local interface dispatcher and surface boundary.                                             |
| `@operatoros-platform/recovery-service`         | Recovery leases with fencing tokens, atomic checkpoints, and dual-contender resolution.             |
| `@operatoros-platform/secrets-service`          | Secret References and security baseline; preview-only secret material.                              |
| `@operatoros-platform/v08-importer`             | Non-destructive v0.8 → v1.0 importer (READ-ONLY on v0.8).                                           |
| `@operatoros-platform/agent-execution`          | Agent registration, capability matching, and invocation flow.                                       |
| `@operatoros-platform/extension-runtime`        | Extension lifecycle, boundary checks, and uninstall.                                                |
| `@operatoros-platform/hosted-runtime`           | In-memory multi-tenant contract shape; not a production hosted service.                             |
| `@operatoros-platform/distributed-coordination` | Tested peer/reconciliation primitives; not a multi-host deployment.                                 |

Concrete contracts and behavior live in each package's `src/`; operator guides are in package `README.md` files.

## NFR matrix (observed release evidence)

| NFR                            | Target              | Observed                                          |
| ------------------------------ | ------------------- | ------------------------------------------------- |
| NFR-PERF throughput            | >= 1000 ops/sec     | 3602–4009 ops/sec across three 5000-mutation runs |
| NFR-REL-2 RTO                  | < 30000 ms          | 40 ms                                             |
| NFR-OPS-1 local deployment     | isolated workspaces | 2 distinct stores                                 |
| NFR-USE-1 cold start           | < 5000 ms           | 88 ms                                             |
| AV-O6 secret value never leaks | none                | none                                              |

These are observed values from the release evidence, not universal capacity guarantees. Source: [`artifacts/release-candidates/v1.0/QUALITY-GATE.md`](artifacts/release-candidates/v1.0/QUALITY-GATE.md). The values are single-release observations on the recorded test host, not capacity or latency guarantees.

## Roadmap

- **M0 Local Bedrock — closed**
- **M1 Agent Execution — closed**
- **M2 Extensibility — closed**
- **M3 Operator-hosted — implementation milestone closed; no hosted service is bundled**
- **M4 Distributed — implementation milestone closed; no multi-host deployment is bundled**
- **v1.1 backlog:** OS keyring, OpenTelemetry, stable SQLite binding, and other tracked technical-debt work.

Public v1.0 publication and tagging remain pending.

## Documentation

- [Installation](docs/INSTALLATION.md) · [Getting Started](docs/GETTING-STARTED.md) · [Architecture](docs/ARCHITECTURE.md)
- [Deployment](docs/DEPLOYMENT.md) · [FAQ](docs/FAQ.md) · [Release process](docs/RELEASE-PROCESS.md)
- Local source API reference (five core entry points): generate with `pnpm docs:build` · [Architecture authorities](docs/authorities/)
- [Changelog](CHANGELOG.md) · [Local release-candidate report](artifacts/release-candidates/v1.0/final-report.md)

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Security

See [SECURITY.md](SECURITY.md) for defaults, threat model, and private disclosure instructions.

## License

MIT. See [LICENSE](LICENSE).

## Support

Ask questions and share deployments in [SUPPORT.md](SUPPORT.md). GitHub Discussions are not part of the currently configured public support surface.

---

[OperatorOS Platform on GitHub](https://github.com/taras-polishchuk/operatoros-platform)
