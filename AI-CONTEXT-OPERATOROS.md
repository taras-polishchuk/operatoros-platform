# AI Context — OperatorOS Platform

> **Purpose.** This is the compact, stable, future-AI-ready reference for OperatorOS Platform. It exists so that future AI systems can understand OperatorOS Platform correctly without reading the repository. It is optimized for token economy: dense, factual, no implementation trivia.

> **Status snapshot (2026-07-25).** OperatorOS Platform v1.0.0 has been released, audited, and certified for Long-Term Maintenance. The architecture is frozen and SHA-locked. The v1.0 lifecycle is closed. Future evolution is consumer-driven.

---

## Product Identity

**OperatorOS Platform** is a local-first, evidence-ledged **Mission execution platform**. It is a TypeScript monorepo (13 packages + 2 apps + 2 spikes) that implements Workspace OS Missions as durable Runs against an SQLite-backed evidence ledger.

It is **a platform, not a product.** Consumers (AI Factory, Career OS, Knowledge OS, HomeLab, Workspace OS Mission Records) integrate against its public surface; the platform itself does not deliver a user-facing application.

It is the **successor to OperatorOS v0.8.x**, which remains a frozen compatibility line (read-only).

**Repository:** `https://github.com/taras-polishchuk/operatoros-platform` (public)
**Local path:** `/home/taras/projects/operatoros-platform/`
**Tag:** `v1.0.0` (annotated, peeled to commit `1311f81`)
**Architecture SHA-256:** `1e79049d9ae5a328556378ff8235525cd0f692bfa317fd7da6dc2bcdb1f27610` (single-locked, byte-identical across the document, the lock file, and the gate-E test)

---

## Purpose

OperatorOS Platform exists to make Workspace OS Missions **runnable, durable, observable, and recoverable** at the local-first level. It provides:

- A canonical execution surface for Missions (Runs with checkpoints, leases, fencing).
- An evidence ledger (append-only, WAL-backed, integrity-verified) for every mutation.
- A 4-operation public surface (`interface.run`, `interface.explain`, `interface.inspect`, `interface.cancel`) reachable through CLI, with future Surface reachability (HTTP API, SDK, Dashboard) reserved but not bundled.
- A recovery model with fencing-token preemption and dual-contender resolution.
- A 13-package decomposition that maps 1:1 onto the 4-component architecture.

The platform does **not** exist to provide hosted SaaS, multi-host distributed deployment, npm-published SDKs, container images, or a marketplace. These are explicitly out of v1.0 scope.

---

## Ecosystem Position

```
Human operator (final authority)
        │
        ▼
Workspace OS (frozen architecture; identity + constitution + authority model)
        │
        ├── OperatorOS v0.8 (frozen compatibility line; optional; read-only)
        │
        ├── OperatorOS Platform v1.0.0 (LTS; this document)   ← durable execution
        │      │
        │      ├── 13 packages + 2 apps + 2 spikes
        │      ├── 4 implementation components
        │      ├── 14 entities, 5 envelopes, 32 invariants
        │      ├── 4 canonical interface operations
        │      └── 154 tests / 22 files / 80-80-80-70 coverage
        │
        ├── Knowledge OS (parallel durable knowledge substrate)
        │
        └── AI Factory / Career OS / HomeLab / CCP / products (consumers)
```

**OperatorOS Platform is shared S4 infrastructure, not a seventh Workspace OS Subsystem.** It implements Workspace OS Missions as durable Runs; it references Workspace OS primitives; it never redefines them. Workspace OS is the upstream architectural authority. Platform is the implementation authority within its frozen contract. Consumers are products that integrate against Platform's public surface.

---

## Responsibilities

OperatorOS Platform is responsible for:

| Responsibility                       | Mechanism                                                                          |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| Activating Missions as durable Runs  | `interface.run` + Execution Service state machine (8 states)                       |
| Maintaining the evidence ledger      | SQLite WAL + Event Record append + Mission Record sealing + integrity verification |
| Authenticated public surface         | Interface Host with 4 canonical operations                                         |
| Capability-scoped agent invocation   | Capability Grant model + agent-execution package                                   |
| Workspace-scoped persistence         | Workspace Service + Artifact aggregate + snapshots                                 |
| Recovery from crashes                | Recovery leases + fencing tokens + dual-contender resolution                       |
| Operator authority                   | Operator Profile + Configuration Revision + grants                                 |
| v0.8 → v1.0 import                   | v08-importer (read-only; content-preserving)                                       |
| Extension lifecycle                  | Manifest + boundary checks + uninstall                                             |
| Secret references (never raw values) | Secrets Service (preview-only; OS keyring deferred)                                |

---

## Non-Responsibilities (out of v1.0 scope)

| Non-responsibility                | Where it would live (if ever)                                         |
| --------------------------------- | --------------------------------------------------------------------- |
| Hosted multi-tenant runtime       | `hosted-runtime` is in-memory contract shape only; v1.3+              |
| Distributed multi-host deployment | `distributed-coordination` is single-process SQLite simulation; v2.0+ |
| HTTP API                          | Reserved Surface; not bundled                                         |
| SDK package                       | Reserved Surface; not bundled                                         |
| Dashboard UI                      | Reserved Surface; not bundled                                         |
| Telemetry / OpenTelemetry         | v1.1 backlog                                                          |
| npm publication                   | Deferred per `docs/RELEASE-PUBLICATION.md`; requires successor ADR    |
| Container image                   | Explicitly "not produced"                                             |
| Marketplace / extension registry  | Not designed; extensions install via `extension-runtime`              |

**These are not missing. They are explicitly out of v1.0 by design.**

---

## Lifecycle

| Phase             | Status                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| Architecture      | **CLOSED** — frozen at SHA `1e79049d…`                                                          |
| Implementation    | **CLOSED** — M0..M4 milestones completed; 13 packages at v1.0.0                                 |
| Validation        | **CLOSED** — 4/4 release gates (E, G, H, K) PASS; 8/8 authorities verified; 5/5 invariants PASS |
| Release           | **CLOSED** — GitHub Release `v1.0.0` published 2026-07-25T14:07:00Z                             |
| Engineering Audit | **CLOSED** — verdict B (Minor Improvements exist but optional; none block production)           |
| LTS Certification | **CLOSED** — verdict A (CERTIFIED FOR LONG-TERM MAINTENANCE)                                    |
| Lifecycle         | **CLOSED** — v1.0 program officially completed 2026-07-25                                       |

**Future evolution is consumer-driven.** No additional architecture, engineering, release-readiness, or production-readiness review is performed on v1.0. New engineering work belongs in v1.1+ (gated by successor-ADR + operator decision).

---

## Engineering Philosophy

OperatorOS Platform embodies these enduring principles (extracted from the implementation; not invented):

1. **Architecture frozen, SHA-locked.** The architecture SHA is the contract. Any change requires a successor-ADR.
2. **One Authority per Concept.** Components receive command responsibility, not Domain ownership.
3. **Local-first canonical.** The local profile has no required network authority or telemetry.
4. **Runtime owns nothing durable.** Processes, queues, caches, indexes, databases are replaceable mechanisms/projections.
5. **Evidence over inference.** Unknown state remains unresolved; no projection invents success.
6. **Default-deny capabilities.** Every Capability Grant is explicit; no implicit access.
7. **Secret References only.** Persistent storage carries references, never raw values.
8. **Recovery is designed.** Every acknowledged mutation has durability/reconstruction evidence.
9. **Simplicity default.** Four components; one extension model; one authorization primitive; one evidence contract.
10. **Claim discipline.** Public surface claims match implementation; release notes match reality; NFR numbers match observed runs.

---

## Architecture Status

**FROZEN.**

| Field                  | Value                                                                                                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SHA-256                | `1e79049d9ae5a328556378ff8235525cd0f692bfa317fd7da6dc2bcdb1f27610`                                                                                                                                    |
| Lock file              | `authority-lock.json` (8 authorities)                                                                                                                                                                 |
| Components             | 4 (Workspace, Execution, Evidence, Interface Host)                                                                                                                                                    |
| Cross-cutting packages | 4 (governance-service, recovery-service, secrets-service, hosted-runtime are conceptual cross-cuts)                                                                                                   |
| Entities               | 14                                                                                                                                                                                                    |
| Envelopes              | 5 (`command`, `query`, `event`, `error`, `mutation`)                                                                                                                                                  |
| Invariants             | 32                                                                                                                                                                                                    |
| Normative IDs          | 101 (89 functional + 12 non-functional)                                                                                                                                                               |
| Public surface         | 4 canonical operations                                                                                                                                                                                |
| CLI subcommands        | 7 (`init`, `explain`, `version`, `help`, `mission run`, `mission inspect`, `mission cancel`)                                                                                                          |
| Frozen authorities     | 8 (`domain-model.md`, `functional-spec.md`, `architecture.md`, `architecture-validation.md`, `implementation-roadmap.md`, `test-strategy.md`, `final-consistency-audit.md`, `final-design-report.md`) |

**The architecture cannot drift by accident.** `pnpm contracts:verify` (8/8 PASS) and `pnpm architecture:check` (5/5 PASS) enforce consistency on every commit and tag.

---

## Maintenance Policy

**v1.0.x is in Long-Term Maintenance.**

**Allowed in v1.0.x:**

- Bug fixes (reproducible, tested, gates green)
- Security fixes (CVE-driven or canary-driven, private disclosure route)
- Documentation (link fixes, FAQ clarifications, runbook additions)
- Dependency maintenance (patch version bumps of devDeps)
- CI fixes (cache, timeout, action pin, runner image)
- Release tooling (tag template, manifest script, candidate-validation workflow)
- Test additions (edge-case tests for documented branches)
- Operational scripts (backup, restore, demo improvements)

**Forbidden in v1.0.x:**

- Architectural redesign
- New subsystems or components
- Public API expansion (new interface operations)
- Conceptual changes (Domain Model changes)
- Responsibility shifts (cross-component authority changes)
- `entity_schema_version` bumps
- npm publication
- Hosted profile productionization
- Distributed profile productionization
- HTTP API / SDK / Dashboard / Telemetry addition
- Architecture SHA lock removal
- Removing closed product-completion items
- Capability downgrade

**LTS exit criteria:** critical defect; security issue; incompatible platform evolution (e.g. Node major version); deliberate v1.1 development (successor-ADR); architecture successor (new SHA).

---

## Future Evolution Policy

**Consumer-driven only.**

Platform changes occur only when real consumer products expose real needs. Speculative platform development is not authorized.

**v1.0.x (LTS, current):** bug/security fixes, dependency maintenance, docs, CI, release tooling. No new capabilities.

**v1.1+:** new engineering work belongs here. The 16-item v1.1 backlog is published at `artifacts/release-candidates/v1.0/v1.1-backlog.md` and covers Storage (stable SQLite), Distributed (quorum consensus), Security (OS keyring, HSM-bound signing), Observability (OpenTelemetry), Tooling (offline CI, standalone CLI, v0.8 round-trip), and Documentation.

**v2.0+:** distributed profile; multi-host deployment; years out.

A v1.1 release requires: (1) a new architecture SHA ratified via successor-ADR; (2) re-locked authorities under a new `authority-lock.json`; (3) a new public contract version; (4) re-run all 4 release gates; (5) new GitHub Release. Until then, no v1.1 work is performed on v1.0.x.

---

## Repository Location

| Item                     | Value                                                                           |
| ------------------------ | ------------------------------------------------------------------------------- |
| Public repository        | `https://github.com/taras-polishchuk/operatoros-platform`                       |
| Release URL              | `https://github.com/taras-polishchuk/operatoros-platform/releases/tag/v1.0.0`   |
| Local checkout           | `/home/taras/projects/operatoros-platform/`                                     |
| Canonical context        | `OPERATOROS-PLATFORM-v1.0.0-CANONICAL-CONTEXT.md` (in repo root)                |
| Frozen authorities       | `docs/authorities/*.md` (8 documents)                                           |
| Public documentation     | `docs/*.md`, `homepage/index.html`                                              |
| Per-package docs         | `packages/*/README.md` (13 files)                                               |
| Release bundle           | `artifacts/release-candidates/v1.0/`                                            |
| Permanent closing record | `/home/taras/projects/.project-state/operatoros-platform-*/` (6 mission states) |

---

## Important Documents

For long-term understanding, read these in order:

1. **`OPERATOROS-PLATFORM-v1.0.0-CANONICAL-CONTEXT.md`** (in repo root, ~70 KB, 16 sections) — the comprehensive long-term reference.
2. **`CHANGELOG.md`** — what was done, when, and why.
3. **`docs/ARCHITECTURE.md`** — the 4-component model with Mermaid diagram.
4. **`docs/sequence-mission-run.md`** — what happens during a Mission run.
5. **`docs/RELEASE-PUBLICATION.md`** — what is and is not published.
6. **`SECURITY.md`** — security defaults, disclosure route, supported versions.
7. **`SUPPORT.md`** — support window, response expectations.
8. **`authority-lock.json`** — the SHA-256 contract for the 8 frozen authorities.
9. **`docs/authorities/architecture.md`** — the canonical architecture document, single-locked at SHA `1e79049d…`.
10. **`README.md`** — the public overview.

For the permanent closing record (lifecycle graduation):

- `FINAL-MISSION-REPORT.md` (45 KB) — product completion summary.
- `RELEASE-REPORT.md` (13 KB) — release execution report.
- `ENGINEERING-AUDIT-REPORT.md` (49 KB) — engineering audit verdict B.
- `LTS-CERTIFICATION.md` (33 KB) — LTS verdict A.
- `V1.0-LIFECYCLE-CLOSURE.md` (36 KB) — lifecycle closed (YES).

---

## Mental Model

Think of OperatorOS Platform as:

- **A platform, not a product.** Consumers integrate against the public surface.
- **A contract, not a description.** The architecture SHA is the binding contract; changes require successor-ADR.
- **A local-first evidence ledger.** Missions are Runs; mutations are Events; the ledger is append-only and integrity-verified.
- **A 4-component, 13-package decomposition.** The architecture is clean; the implementation is bounded; the public surface is 4 operations.
- **A frozen LTS product.** Future work is consumer-driven; the v1.0.x line is bounded; v1.1+ is gated.

**What it is NOT:** a hosted SaaS, a distributed deployment platform, a package registry, a marketplace, an HTTP API / SDK / Dashboard bundle, a container image, or a candidate for further architecture review.

**The correct question for a future AI agent to ask is not "what should we add to OperatorOS Platform v1.0?" but "what real product needs does OperatorOS Platform v1.0 fail to meet, and how do we express that need as a v1.1 backlog candidate?"**

---

_End of AI context. OperatorOS Platform v1.0.0 is a closed, released, validated, certified LTS platform. Future evolution is consumer-driven. The next engineering milestone is v1.1._
