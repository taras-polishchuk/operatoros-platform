# OperatorOS Platform v1.0.0 — Canonical Context

> **Purpose.** This document is the single long-term reference for understanding OperatorOS Platform v1.0.0. It is optimized for future AI agents (or future humans) that have never seen the repository. Every claim is evidence-backed from the released source. Nothing here is aspirational; nothing is invented.
>
> **Authority precedence.** When this document and any other source disagree, the **released source** (tag `v1.0.0`, commit `1311f81`) wins. When the released source and the frozen `docs/authorities/architecture.md` (SHA-256 `1e79049d9ae5a328556378ff8235525cd0f692bfa317fd7da6dc2bcdb1f27610`) disagree, **the frozen authority wins** for the parts of the system that it covers; the released source wins for runtime structure that emerged during M0..M4 implementation.
>
> **Version of record.** `v1.0.0` — published 2026-07-25, repository <https://github.com/taras-polishchuk/operatoros-platform>, MIT license, public.

---

## 1. Executive Summary

OperatorOS Platform is a local-first, operator-controlled, evidence-ledged **Mission execution platform**. It runs consequential automation on behalf of a human operator, records an immutable evidence trail, and recovers from interruption without guessing.

It is a **TypeScript monorepo** organized as 13 private workspace packages, 2 applications (the local CLI and the smoke integration test), and 3 optional operational packages (`hosted-runtime`, `distributed-coordination`, `v08-importer`). It is currently at version `1.0.0`; the architecture is **frozen** at SHA-256 `1e79049d…` and verified by `pnpm contracts:verify` (8 of 8 frozen authorities match).

The product is **not** a workflow engine. It is a **mission ledger** — comparable in scope to a workflow engine's execution layer, but with three properties that distinguish it:

1. **Evidence is durable and authoritative.** Every acknowledged mutation produces an Event Record and a Mission Record. State is never inferred; if evidence is missing, the platform reports an explicit unresolved state rather than guessing.
2. **Authority is explicit and operator-scoped.** A `Capability Grant` is required for any action. The operator is the final authority; AI/extension output cannot widen its own grants.
3. **Recovery is a first-class contract, not a runtime hope.** Acknowledged mutations survive process death via Mutation Envelopes; competing workers are fenced; crashes are reconciled from durable records.

A senior engineer should think of it as: a **single-host, local-first event sourcing platform with explicit human authority, capability-based access, and deterministic recovery** — designed for the case where the work matters and "the dashboard said done" is not an acceptable answer.

The canonical local-first entry point is the **CLI**:

```sh
node apps/cli/dist/index.js --workspace /tmp/operatoros-demo init
node apps/cli/dist/index.js --workspace /tmp/operatoros-demo mission run \
  --workspace-ref workspace_local:audit \
  --mission-ref mission_local:m1 \
  --specification-ref spec_local:s1 \
  --identity identity://audit --correlation audit-1
```

It returns a `run_ref` and a `mission_record_ref`. The `mission_record_ref` is the durable evidence; everything else can be reconstructed from it.

---

## 2. Why OperatorOS Exists

### Motivation

Automation without trustworthy state leaves operators unable to answer four questions:

- **What ran?** — not the dashboard, not the log, but the authoritative record.
- **Under whose authority?** — which operator, which grant, which model version.
- **What changed?** — what was the before/after, and who authorized the change.
- **Is recovery safe?** — can the platform prove it knows the state it claims to recover to?

OperatorOS exists to make all four questions answerable from durable records, not from process state, log scraping, or operator trust.

### Design goals (from the frozen `domain-model.md` §2 authority hierarchy)

| Rank | Authority                             | Platform's relationship                                                                            |
| ---: | ------------------------------------- | -------------------------------------------------------------------------------------------------- |
|    1 | Human operator                        | Platform executes only explicit or policy-pre-authorized actions and records attribution.          |
|    2 | Workspace OS (the upstream system)    | Platform references Identity / Mission / Knowledge / Subsystem semantics and never redefines them. |
|    3 | OperatorOS v0.8 release line (frozen) | Platform is a successor product, not a v0.8 module. The `v08-importer` reads v0.8 read-only.       |
|    4 | Platform Domain Model (this product)  | Functional and Architecture conform to it.                                                         |

These are not soft rules. The frozen architecture and the release gates enforce them.

### Problems solved

- **Replay survivability.** Acknowledged mutations survive process death. A crashed Run is reconciled from durable records, not from in-memory state.
- **Multi-worker safety.** When two workers contend for the same Run, fencing tokens and a deterministic tie-breaker (lexicographic on the contender identity) prevent both from advancing.
- **Capability-bounded execution.** An agent cannot exceed its grant; a grant cannot be widened by the agent itself. Authorization is enforced at the command handler, not at the client.
- **Evidence as a product surface.** Mission Records are the product's primary user-facing artifact; dashboards, catalogs, and audit views are replaceable projections over them.
- **Local-first canonical state.** The Workspace and its evidence live in operator-controlled files; no cloud authority is required to read or write authoritative state.

### Non-goals (explicit, from `functional-spec.md` §9 and the published home page)

- **No hosted SaaS.** v1.0 ships the Local profile. `hosted-runtime` is a contract shape, not a production deployment.
- **No multi-host distributed deployment.** `distributed-coordination` is single-process SQLite peer simulation.
- **No HTTP API, no SDK, no Dashboard, no telemetry bundled.** Architecture reserves the Surface contract for them; v1.0 ships only the in-process and CLI surfaces.
- **No npm publication.** All 13 workspace packages are `private: true`. There is no standalone SDK or registry package.
- **No marketplace, no auto-update, no schema-less configuration, no multi-tenant SaaS organization.** All of these are explicitly forbidden by the Domain Model and the release gates.
- **No promotion of AI output to authority.** AI is never the authority — it proposes; humans or policy authorize.

---

## 3. Position Inside the Ecosystem

The OperatorOS Platform sits in a small but deliberate ecosystem. Each of these has a different role; confusing them is a common error.

| System                                 | Role                                                                                                                                                         | Relationship to OperatorOS Platform                                                                                                                                                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Workspace OS**                       | The upstream operator-facing operating system. Owns Identity, Principle, Authority, Knowledge, Mission, Subsystem, Specialization, constitutional lifecycle. | OperatorOS is **shared execution infrastructure, not a 7th Subsystem**. It references Workspace OS primitives and never writes them. It is primarily S4 Automation Infrastructure; it serves S6 Knowledge integration. It never absorbs the authority of S1, S2, S3, S5. |
| **OperatorOS Platform** (this product) | A local-first TypeScript monorepo implementing durable Mission execution with explicit evidence.                                                             | The product this document describes.                                                                                                                                                                                                                                     |
| **OperatorOS v0.8.x**                  | The prior, frozen release line. A separate code line with its own Core and module model.                                                                     | Treated as a compatibility input. The Platform is a successor, not a v0.8 module. Migration is one-way via `v08-importer` (read-only on v0.8, content-preserving).                                                                                                       |
| **Knowledge OS**                       | A knowledge graph and decision-derivation framework.                                                                                                         | OperatorOS can produce Knowledge candidates (ADR / IR / LL) as Workspace OS-governed Artifact kinds (FR-KN-1..4 in the functional spec), but the platform itself is not a knowledge graph. Knowledge promotion authority belongs to Workspace OS.                        |
| **AI Factory / products built on top** | Concrete OperatorOS-powered applications.                                                                                                                    | These consume OperatorOS as a library; they are not part of the v1.0 release.                                                                                                                                                                                            |

### Distinguishing architecture from implementation

The **architecture** is the frozen `docs/authorities/architecture.md` (the four-component model: Interface Host → Workspace Service → Evidence Service ← Execution Service). It defines _responsibility boundaries_ and _envelopes_.

The **implementation** is the 13-package monorepo. Several of the 13 packages (notably `recovery-service`, `governance-service`, `secrets-service`, `extension-runtime`, `agent-execution`, `hosted-runtime`, `distributed-coordination`, `v08-importer`) **post-date or augment the frozen four-component model** — they were added during M1/M2/M3 to satisfy the Functional Specification while keeping the four core components' responsibilities intact. The four components are still the authority model; the additional packages are mechanisms that live behind one of the four.

---

## 4. Core Concepts

These are the concepts a future agent must keep straight. Each is independent; the glossary at `docs/authorities/domain-model.md` §4 is the canonical source.

**Operator (Workspace OS reference).** A human — the final authority for Platform use. AI is never an operator.

**Operator Profile.** A Platform record that links one Workspace OS Identity to deployment-local preferences and authorization subjects. At most one active profile per Identity per deployment. Lifecycle: `draft → active ↔ suspended → archived`.

**Workspace.** A Git-tracked operator-controlled directory. The Platform stores authoritative artifacts and Mission State here. Initialization requires version control; the Platform refuses ambiguous roots. Lifecycle: `initialized → active ↔ archived → superseded`.

**Artifact.** A versioned, content-addressed Workspace-owned record. Every transition names actor, predecessor (where applicable), schema result, and content-history reference. Silent overwrite is rejected. Lifecycle: `draft → validated → active → superseded → archived`. Kinds include: Checkpoint, Snapshot, Memory, and Knowledge Article (ADR / IR / LL) — the last governed by Workspace OS.

**Mission (Workspace OS reference).** Authored intent. Not authored by the Platform. The Platform _references_ it. The Platform never redefines Mission intent.

**Mission Execution Specification (Platform entity).** A versioned Platform configuration that binds a Workspace OS Mission to executable subjects, policies, schedules, and acceptance conditions, _without owning Mission intent_. Activation retires the prior version. Existing Runs pin the version they started with. Lifecycle: `draft → validated → active ↔ paused → retired`.

**Run.** One attempt to execute one active Mission Execution Specification. Has 8 `RUN_STATES`: `queued → running ↔ paused`, with edges to `interrupted → recovering → running/failed`, `succeeded`, `failed`, `cancelling → cancelled`. Terminal states are `succeeded`, `failed`, `cancelled`. `checkpointed` is **not** a state; it is a Checkpoint Artifact + Event Record. Lifecycle is in `domain-model.md` §6.5.

**Mission Record.** Durable evidence index for one Run, created atomically with Run identity. References evidence produced before, during, and after interruption. `sealed` is terminal and append-closed; correction creates a successor record with explicit supersession. Lifecycle: `open → sealing → sealed`.

**Agent Registration.** A Platform record that registers an AI or deterministic executor. Declares typed responsibility, Capability Definitions, identity class, and Security Boundary. Lifecycle: `proposed → registered → enabled ↔ disabled → retired`.

**Extension Installation.** An installed replaceable extension. Kinds: `plugin`, `integration`, `dashboard`, `telemetry-exporter`, `adapter`. One manifest grammar for all kinds. Lifecycle: `staged → installed → enabled ↔ disabled → uninstalled`.

**Capability Definition.** A typed action identifier + input/output contract + risk class. Immutable.

**Capability Grant.** Time- and scope-bounded authorization for one subject to use one Capability Definition. Subject is Operator Profile, Agent Registration, or Extension Installation. Identity is immutable; a changed scope, capability, subject, or expiry creates a successor grant. Lifecycle: `requested → granted → revoked | expired` (alternative: `requested → denied`).

**Schedule.** Durable trigger policy. Lifecycle: `draft → armed ↔ suspended → retired`. A firing creates a Run request and Event Record but does not consume the Schedule.

**Secret Reference.** Typed pointer to a value owned by an external authority. Never the value. Lifecycle: `declared → bound ↔ unbound → revoked`. Resolution is an Event Record, not a state. The `secrets-service` package's enum covers `env-file`, `keyring`, `memory-env`, `os-secret-service`; v1.0 implements `env-file` and `memory-env`.

**Model Route.** Versioned deterministic policy that selects among operator-configured model endpoints. Lifecycle: `draft → validated → active → superseded → retired`. Reproducible for fixed inputs and availability evidence.

**Configuration Revision.** Validated version of Platform configuration. Exactly one active revision per configuration scope. Lifecycle: `draft → validated → active → superseded → archived`. The **Effective Configuration** is a _projection_ (rebuildable) — never edited directly.

**Event Record.** Immutable evidence fact attributed to a subject and Run or administrative operation. Secret values are forbidden in payloads. Lifecycle: `recorded → archived`. Projection retention may discard derived copies, but authoritative evidence referenced by an unarchived Mission Record remains reconstructable.

**Checkpoint (Artifact kind).** Recoverable Run-state artifact; creation is an _event_, not a Run lifecycle state. Includes Run and specification versions, execution cursor, deterministic replay inputs, referenced artifact/extension/route versions, integrity digest, and compatibility range.

**Snapshot (Artifact kind).** Point-in-time export for recovery or migration. **Never a second Workspace authority.** Restoration verifies integrity before activation and preserves the source.

**Deployment Profile.** Named operational defaults. `Local` is canonical; any networked profile is explicit opt-in.

**Security Boundary.** Isolation and enforcement contract applied to Agent Registrations and Extension Installations. Default-deny on undeclared access.

**Surface.** A projection/interface — CLI, HTTP API, SDK, optional UI — that exposes the _same_ domain command/query contract. No Surface has authority; the Interface Host is the dispatch boundary.

**Identity classes.** User identity reference (operator/client context), Service identity reference (configured platform/vendor account), Machine identity reference (host/runtime). Stored as references, not invented.

**Stores (the implementation surface).** In v1.0, the SQLite-backed local profile uses one adapter per store: `evidence.sqlite`, `workspace.sqlite`, `governance.sqlite`, `execution.sqlite`. Snapshots live in a `snapshots/` directory. The `node:sqlite` binding is experimental; the architecture permits alternatives that prove the same outcomes.

---

## 5. Internal Architecture

### 5.1 The four-component model (frozen)

From `docs/authorities/architecture.md` §3:

| Component             | Responsibility                                                                                                                                                                                                                                           | Must not own                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Workspace Service** | Validate/commit Workspace-scoped mutations; rebuild projections. Owns commands for Operator Profile, Workspace, Artifact, Agent Registration, Extension Installation, Capability Grant, Schedule, Secret Reference, Model Route, Configuration Revision. | Workspace OS Identity/Mission/Knowledge; external secret values; projection truth. |
| **Execution Service** | Execute Mission Execution Specifications as recoverable Runs; coordinate extension/model calls. Owns Mission Execution Specification activation, Run, Mission Record, Checkpoint/Snapshot operations.                                                    | Policy, grants, Workspace artifacts outside command contracts.                     |
| **Evidence Service**  | Atomically append Event Records; maintain Mission Record evidence indexes; seal; verify integrity; feed rebuildable projections.                                                                                                                         | Business policy, user identity, Artifact content, projection authority.            |
| **Interface Host**    | Authenticate/attribute requests; expose shared commands/queries to Surfaces.                                                                                                                                                                             | Domain-specific alternative behavior, cached authority, grant decisions.           |

Dependency direction (architecture §3.3, enforced by the test suite):

```
Surfaces / Extensions
        |
        v
Interface Host
        |
        +-------> Workspace Service -------> Evidence Service
        |
        +-------> Execution Service -------> Evidence Service
                         |
                         +---- command/query calls ----> Workspace Service

Projection Builders <---------------------- Evidence + Workspace artifacts
External Adapters <------------------------ Execution Service (grant-scoped)
```

Rules (architecture §3.3):

1. Interface Host never calls storage or adapters directly.
2. Execution Service mutates Workspace-scoped entities only through Workspace Service commands.
3. Workspace Service and Execution Service acknowledge mutations only after Evidence Service confirms the required evidence append or atomic mutation envelope.
4. Evidence Service never invokes domain commands.
5. Projection builders are asynchronous consumers and cannot authorize commands.
6. No component depends on a Surface.

### 5.2 The 13-package monorepo (the implementation)

The architecture's four components are realized through 13 workspace packages, all `private: true` (no npm publication). The mapping is:

| Package                                         | Component / role              | One-line purpose                                                                                                                                                     |
| ----------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@operatoros-platform/contracts`                | Shared vocabulary             | Schemas and contract vocabulary for the 14 entities, 5 envelopes, and the extension manifest.                                                                        |
| `@operatoros-platform/workspace-service`        | Workspace Service             | Validates and commits Workspace and Artifact mutations; snapshots; configuration; grants.                                                                            |
| `@operatoros-platform/execution-service`        | Execution Service             | Runs Mission Execution Specifications as Runs; owns the 8 `RUN_STATES` machine; checkpoints.                                                                         |
| `@operatoros-platform/evidence-service`         | Evidence Service              | Append-only Event Records; Mission Record sealing; integrity verification; projections.                                                                              |
| `@operatoros-platform/interface-host`           | Interface Host                | Attributes requests; dispatches the shared interface contract; one boundary for all Surfaces.                                                                        |
| `@operatoros-platform/governance-service`       | Cross-cutting (governance)    | Operator Profiles, Capability Grants, Configuration Revisions, Effective Configuration projection.                                                                   |
| `@operatoros-platform/recovery-service`         | Cross-cutting (recovery)      | Recovery leases, fencing-token preemption, deterministic dual-contender resolution, checkpoints, snapshots.                                                          |
| `@operatoros-platform/secrets-service`          | Cross-cutting (security)      | Secret References; 4-character previews; memory-only secret material in v1.0.                                                                                        |
| `@operatoros-platform/agent-execution`          | Cross-cutting (agent)         | Agent registration; capability matching; idempotent invocation.                                                                                                      |
| `@operatoros-platform/extension-runtime`        | Cross-cutting (extensibility) | Extension lifecycle: stage, validate, enable, suspend, retire, uninstall. Default-deny.                                                                              |
| `@operatoros-platform/hosted-runtime`           | Optional profile              | In-memory multi-tenant routing contract shape. **Not** a production hosted service.                                                                                  |
| `@operatoros-platform/distributed-coordination` | Optional profile              | Peer registration, checkpoint anchoring, fencing-token sequencing, cross-peer reconciliation, payload-digest divergence detection. Single-process SQLite simulation. |
| `@operatoros-platform/v08-importer`             | Optional adapter              | Reads OperatorOS v0.8.x read-only and produces OperatorOS Platform artifacts. Content-preserving.                                                                    |

There are also two applications:

- `apps/cli` — the executable local CLI (`operatoros` bin). Built with `pnpm --filter @operatoros-platform/cli build` → `apps/cli/dist/index.js`.
- `apps/smoke` — the golden-path integration test (`pnpm test apps/smoke`); not a public surface.

### 5.3 Envelopes (the wire contracts)

From `packages/contracts/src/index.ts`, there are **five** envelope schemas, all under `envelope.*`:

- `envelope.command` — every mutation's input.
- `envelope.query` — every read.
- `envelope.event` — every acknowledged fact (Event Record).
- `envelope.error` — every typed error.
- `envelope.mutation` — the Mutation Envelope state machine: `prepared → committing → committed → acknowledged`, with transitions to `aborted`, `unresolved`, `acknowledged-on-retry`. The Mutation Envelope is the implementation-level reconciliation surface; the Domain is authoritative for entities, and this envelope is the mechanism that makes acknowledgement deterministic.

A Mutation Envelope is the mechanism that makes `committed` mean "the authoritative record, required Event Records, and idempotency result are durable and mutually referenced". A crash during `prepared` or `committing` is reconciled from durable evidence, not from coordination memory.

### 5.4 The canonical interface

The Interface Host exposes exactly four canonical operations (in `packages/interface-host/src/index.ts`):

- `interface.run` — start a Run.
- `interface.explain` — surface supported operations (no mutation).
- `interface.inspect` — read a workspace/run/mission record by ref.
- `interface.cancel` — cancel a Run by entity_id.

Every Surface (CLI, in-process dispatcher, future HTTP/SDK) routes through these four. No Surface has its own command type. This is the single source of the "one command/query contract" claim in the architecture.

### 5.5 Runtime model

- **Process model.** Single Node.js process per Workspace. v1.0 has no worker pool and no multi-process model. SQLite WAL with `BEGIN IMMEDIATE` and `synchronous=FULL` is the canonical evidence storage. The `node:sqlite` binding is experimental in Node 22; the architecture permits alternatives that prove the same outcomes (Architecture Validation, AV-O1).
- **Reconstruction model.** Process restart is not a recovery event. State is reconstructed from authoritative records (`FR-RT-4`).
- **Worker contention.** When two workers race for the same Run, recovery fencing tokens and a lexicographic tie-breaker on the contender identity resolve to exactly one safe continuation. The other is denied as a zombie (architecture §6.4; `recovery-service` README).
- **Network.** Local profile has no required network authority. No telemetry is emitted on a fresh Local profile (`FR-TEL-1`).

---

## 6. Repository Structure

A future agent that has only this document needs to know where to look. The repository top level is:

| Path                                                                                                                                                               | Role                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                                                                                                                                                     | Root manifest. Node ≥ 22, pnpm 9.15.9, `pnpm.overrides` pin for `brace-expansion@>=5.0.8` (devDep CVE fix). 13 private workspace packages and 2 apps.                                                                             |
| `pnpm-workspace.yaml`                                                                                                                                              | Workspace member glob: `apps`, `packages`, `spikes`.                                                                                                                                                                              |
| `turbo.json`                                                                                                                                                       | Turbo pipeline for build, lint, typecheck, test, format.                                                                                                                                                                          |
| `vitest.config.ts`                                                                                                                                                 | Vitest configuration with coverage thresholds `80/80/80/70`.                                                                                                                                                                      |
| `tsconfig.base.json`, `tsconfig.json`                                                                                                                              | TypeScript strict-mode configuration.                                                                                                                                                                                             |
| `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.editorconfig`, `.gitattributes`, `.gitignore`                                                         | Style and tooling.                                                                                                                                                                                                                |
| `authority-lock.json`                                                                                                                                              | Pins 8 frozen authority documents with their SHA-256 hashes. The architecture SHA is `1e79049d9ae5a328556378ff8235525cd0f692bfa317fd7da6dc2bcdb1f27610`. Do not edit casually.                                                    |
| `OPERATOROS-PLATFORM-v1.0.0-CANONICAL-CONTEXT.md`                                                                                                                  | This document.                                                                                                                                                                                                                    |
| `README.md`                                                                                                                                                        | Public overview (129 lines); one-screen entry point.                                                                                                                                                                              |
| `CHANGELOG.md`                                                                                                                                                     | `[Unreleased]`, `[1.0.0] - publication pending`, `[1.0.0-rc1] - 2026-07-20`.                                                                                                                                                      |
| `LICENSE`                                                                                                                                                          | MIT, © 2026 Taras Polishchuk.                                                                                                                                                                                                     |
| `CITATION.cff`                                                                                                                                                     | Citation metadata, version 1.0.0, 2026-07-24.                                                                                                                                                                                     |
| `CODE_OF_CONDUCT.md`                                                                                                                                               | Contributor Covenant 2.1.                                                                                                                                                                                                         |
| `CONTRIBUTING.md`                                                                                                                                                  | Contribution conventions and the architecture lock rules.                                                                                                                                                                         |
| `SECURITY.md`                                                                                                                                                      | Private vulnerability disclosure route and security defaults.                                                                                                                                                                     |
| `SUPPORT.md`                                                                                                                                                       | GitHub Issues as the support channel; no general public discussion channel.                                                                                                                                                       |
| `CURRENT-PROJECT-STATE-AND-ROADMAP.md`                                                                                                                             | Long-form state-of-truth assessment; section 14 is the 2026-07-25 audit pass.                                                                                                                                                     |
| `CLEANUP-REPORT-2026-07-24.md`                                                                                                                                     | Per-pass cleanup report (M-D13, M-D16 prior patterns).                                                                                                                                                                            |
| `apps/cli/`                                                                                                                                                        | The executable local CLI. Built output is at `apps/cli/dist/index.js`.                                                                                                                                                            |
| `apps/smoke/`                                                                                                                                                      | The golden-path integration test. Not a public surface.                                                                                                                                                                           |
| `packages/`                                                                                                                                                        | The 13 private workspace packages (see §5.2).                                                                                                                                                                                     |
| `spikes/persistence/`, `spikes/nfr/`                                                                                                                               | Crash-matrix and NFR performance evidence. `spikes/nfr/package.json` is intentionally `0.0.0-development` (a private spike, not a public package).                                                                                |
| `docs/`                                                                                                                                                            | Public documentation. See §6.1.                                                                                                                                                                                                   |
| `docs/authorities/`                                                                                                                                                | 8 frozen authority documents. See §6.2.                                                                                                                                                                                           |
| `docs/api/`                                                                                                                                                        | Generated TypeDoc output (gitignored).                                                                                                                                                                                            |
| `docs/screenshots/`                                                                                                                                                | Generated preview screenshots.                                                                                                                                                                                                    |
| `docs/runbooks/`                                                                                                                                                   | Operational runbooks: `REPO-CURATION-AND-RELEASE-HYGIENE.md`, `WORKSPACE-SNAPSHOT-BACKUP-RESTORE.md`.                                                                                                                             |
| `docs/adr/`                                                                                                                                                        | Architecture Decision Records (public subset).                                                                                                                                                                                    |
| `docs/architecture.svg`, `docs/logo.svg`, `docs/logo-light.svg`, `docs/roadmap.md`, `docs/comparison.md`, `docs/class-evidence.md`, `docs/sequence-mission-run.md` | Visual + structured public documentation assets.                                                                                                                                                                                  |
| `homepage/`                                                                                                                                                        | The static landing page (`index.html`, `script.js`, `styles.css`, `assets/`).                                                                                                                                                     |
| `artifacts/release-candidates/v1.0/`                                                                                                                               | The release-candidate evidence bundle (final report, MANIFEST, QUALITY-GATE, INDEPENDENT-AUDIT v1 and v2, FINAL-V1.0-MISSION-REPORT, architecture-deltas, technical-debt, v1.1-backlog, migration-from-v08, verify-manifest.mjs). |
| `artifacts/release-candidates/rc1/`                                                                                                                                | Historical RC1 evidence. Retained as historical record.                                                                                                                                                                           |
| `artifacts/reports/`                                                                                                                                               | Generated gate evidence (intentionally gitignored, only `.gitkeep` is tracked).                                                                                                                                                   |
| `archive/`                                                                                                                                                         | Historical duplicate RC1 manifest, retained per the archive retention policy in `archive/README.md`.                                                                                                                              |
| `scripts/`                                                                                                                                                         | `demo.sh`, `demo.py`, `_demo_driver.mjs`, `create-tag.sh` — the operator-facing scripts.                                                                                                                                          |
| `tooling/`                                                                                                                                                         | `verify-authorities.ts`, `check-architecture.ts`, `verify-clean-tree.mjs`, `license-report.mjs`, `security-scan.mjs`, `sbom.mjs`.                                                                                                 |
| `landing-page-preview.html`                                                                                                                                        | Marketing preview (gitignored from prettier by `.prettierignore`).                                                                                                                                                                |
| `.github/`                                                                                                                                                         | CI, CodeQL, Pages, release-candidate, release workflows; issue templates; PR template; CODEOWNERS; dependabot.yml.                                                                                                                |

### 6.1 The `docs/` directory

```
docs/
├── GETTING-STARTED.md       # five-minute flow
├── INSTALLATION.md          # Node 22+, pnpm 9, 2 GB RAM
├── ARCHITECTURE.md          # four-component model + Mermaid diagrams
├── DEPLOYMENT.md            # Local + hosted contract shape, NFR observations
├── FAQ.md                   # short operator Q&A
├── RELEASE-PROCESS.md       # versioning, gates, clean-tree verification
├── RELEASE-PUBLICATION.md   # publication boundary (no npm, no remote by default)
├── sequence-mission-run.md  # Mermaid sequence for one Run
├── architecture.svg         # visual architecture
├── adr/                     # public ADRs
├── api/                     # generated TypeDoc (gitignored)
├── authorities/             # 8 frozen authorities (see §6.2)
├── runbooks/                # REPO-CURATION-..., WORKSPACE-SNAPSHOT-...
├── screenshots/             # generated previews
├── comparison.md            # positioning (not marketing claims)
├── class-evidence.md        # requirement-to-test class evidence
├── roadmap.md, logo*.svg    # visual assets
```

### 6.2 The 8 frozen authorities

Pinned by `authority-lock.json` (paths are repository-relative):

| Authority                                            | File                                          | SHA-256                                                            |
| ---------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------ |
| Domain Model                                         | `docs/authorities/domain-model.md`            | `14a99bff255ab54b9ed62165f976b365dbc3cf5969f64561674d5634e8ba71ab` |
| Functional Specification                             | `docs/authorities/functional-spec.md`         | `5225023e2ac4e93d16ba37d437beb0bb3f0fd76da5f71c6472c58cf6d48d6005` |
| Architecture (the one that pins the v1.0.0 codebase) | `docs/authorities/architecture.md`            | `1e79049d9ae5a328556378ff8235525cd0f692bfa317fd7da6dc2bcdb1f27610` |
| Architecture Validation                              | `docs/authorities/architecture-validation.md` | `a2ff530baf89fb15c619e6c88725e6a0862c5a436975c8d8352f44f4bb8804e3` |
| Implementation Roadmap                               | `docs/authorities/implementation-roadmap.md`  | `add6035997d57639ca0c6b89dbd79ff57109a9e72053ce2ac3b7263103b547e1` |
| Test Strategy                                        | `docs/authorities/test-strategy.md`           | `07087550ba32857c6b5e0e5eb3504aaa22d42eabfe717ea169bfbca7be37afbc` |
| Final Consistency Audit                              | `docs/authorities/final-consistency-audit.md` | `3004153bf175025a022c9d33607c4d63b13750085b823c7201a31d9b5ad3e795` |
| Final Design Report                                  | `docs/authorities/final-design-report.md`     | `a40301e4419ca104e25304319b25a15240330b6440bf234da61117fb0a3c7ad1` |

The architecture SHA is the one a future agent must NOT change casually. The `pnpm contracts:verify` command checks all eight on every CI run. The v1.0 implementation, the 154 tests, and the 14 quality-gate steps all assume the architecture authority at this SHA.

Note: the `architecture-validation.md` authority header reports a different SHA (`880ba39a…`). That is the pre-final-simplification architecture that the validation document was written against; the _frozen_ architecture used by the codebase is `1e79049d…`. Always cross-check against `authority-lock.json`.

---

## 7. Runtime Flow

A canonical OperatorOS Platform session walks through these steps. The numbers reference the source files where the work happens.

### 7.1 Workspace initialization

1. **Operator chooses a directory.** The directory must be a Git working tree (`FR-WE-1`).
2. **Operator invokes `init`.** `apps/cli/src/index.ts:init` (or library composition via `createWorkspaceService({databasePath, snapshotsDirectory})`) creates four SQLite files: `evidence.sqlite`, `workspace.sqlite`, `governance.sqlite`, `execution.sqlite`, plus a `snapshots/` directory.
3. **CLI returns the schema version and the list of stores.** The response is JSON-stable, suitable for automation (`FR-CLI-2`).

### 7.2 Mission execution

1. **Operator issues an attributed command** through the CLI or in-process dispatcher (`interface.run`). The Interface Host attributes the request — operator profile, correlation id, request key.
2. **Interface Host routes to Execution Service** via `startRunWithMissionRecord(mission_id, grant_ref)`.
3. **Execution Service reads active specification and grants** from Workspace Service. The Run is pinned to one Mission Execution Specification version and one Mission reference; both are immutable for the lifetime of the Run.
4. **Execution Service opens a Mission Record** atomically with Run identity. The Mutation Envelope coordinates the record, the required Event Records, and the idempotency result.
5. **Workspace Service and Execution Service acknowledge only after Evidence Service confirms the required evidence append or atomic mutation envelope.** This is the "evidence over inference" rule.
6. **During execution, checkpoints may be created.** A checkpoint is an Artifact, not a state; it does not change Run lifecycle. Checkpoint creation itself emits an Event Record.
7. **The Run reaches a terminal state** (`succeeded`, `failed`, or `cancelled`). The Mission Record is sealed. A sealed Mission Record is append-closed; correction creates a successor record with an explicit supersession link.
8. **Operator receives the response with `run_ref` and `mission_record_ref`.** Post-hoc audit starts from `mission_record_ref`; nothing else needs to be trusted.

The Mermaid sequence in `docs/sequence-mission-run.md` shows the wire-level flow for one Mission run.

### 7.3 Persistence

- **Local default.** SQLite WAL with `BEGIN IMMEDIATE` and `synchronous=FULL`. One adapter per package. Single store per Workspace.
- **Why WAL + IMMEDIATE + FULL.** The Mutation Envelope is safe only if its three required parts (record, events, idempotency result) commit atomically. The architecture is store-agnostic (architecture §5.4 "two valid implementation families"), but the v1.0 choice is WAL+IMMEDIATE+FULL.
- **Snapshots.** Application-level export/restore (not live SQLite copy). `docs/runbooks/WORKSPACE-SNAPSHOT-BACKUP-RESTORE.md` documents the operator workflow.
- **No host store.** No cloud authority, no marketplace, no auto-update. The Workspace and its evidence are operator-controlled.

### 7.4 Evidence generation

- **Atomic append.** Every acknowledged mutation produces an Event Record. The Evidence Service holds the contract that the append happens, the record is durable, and the payload is digest-bearing.
- **Mission Record sealing.** Requires: (a) Run terminal state durable, (b) required start, transition, and terminal evidence exists, (c) referenced Artifacts resolve or are explicitly marked unavailable with an unresolved finding, (d) grant/model/extension/configuration versions are recorded, (e) result digest and verification summary exist.
- **Mutation Envelope.** The reconciliation surface. `committed`, `uncommitted`, `conflict`, `evidence-gap` are the caller-visible outcomes. `evidence-gap` is a stop signal: do not invent the missing evidence.

### 7.5 Recovery

Recovery is a deterministic protocol, not a runtime behavior:

- **Crash during `prepared` or `committing`:** reconciled from durable record / Event / idempotency evidence. Coordination memory is not trusted.
- **Two contenders:** fencing tokens preempt; the lexicographically smaller contender identity wins; the other is denied as a zombie (`recovery-service` README + architecture §6.4).
- **`committed` but response lost:** retry with the same request key; the original result is reproduced.
- **New `request_key` to bypass idempotency:** denied and recorded as an attempted bypass.
- **Unresolved recovery obligation:** Mission State and Mission Record identify missing evidence, impact, attempted actions, owner, and the next safe action. The platform never reports "succeeded" from inference (FR-REC-4).

### 7.6 Shutdown

There is no formal shutdown command in v1.0. Closing the CLI or the host process simply stops accepting commands. The next process restart reconstructs state from authoritative records. Snapshots and Mission Records survive a `kill -9`. The cold-start scenario observed in v1.0 release evidence is 88 ms.

---

## 8. CLI

`apps/cli` is the only public Surface shipped in v1.0. It is a thin wrapper around the Interface Host. There is no HTTP API, no SDK, no Dashboard.

### 8.1 Subcommands

| Subcommand        | Maps to                 | Purpose                                                                                                                                                          |
| ----------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init`            | local Workspace factory | Initialize a SQLite Workspace at `--workspace <path>`. Creates `evidence.sqlite`, `workspace.sqlite`, `governance.sqlite`, `execution.sqlite`, and `snapshots/`. |
| `explain`         | `interface.explain`     | Surface the supported interface operations as JSON.                                                                                                              |
| `version`         | (static)                | Print the CLI version (1.0.0).                                                                                                                                   |
| `help`            | (static)                | Print usage.                                                                                                                                                     |
| `mission run`     | `interface.run`         | Start a Run. Requires `--workspace-ref`, `--mission-ref`, `--specification-ref`, `--identity`, `--correlation`.                                                  |
| `mission inspect` | `interface.inspect`     | Inspect a workspace record by ref. Requires `--workspace-ref`.                                                                                                   |
| `mission cancel`  | `interface.cancel`      | Cancel a Run. Requires `--entity-id`.                                                                                                                            |

The CLI binary is `operatoros` (declared in `apps/cli/package.json` as `"bin": {"operatoros": "./dist/index.js"}`). Within the monorepo it is invoked as `node apps/cli/dist/index.js ...`.

### 8.2 Output conventions

- `--json` emits a deterministic JSON payload to stdout; progress text never mixes with data output (`FR-CLI-2`).
- Errors are typed and human-readable; machine-readable form is the typed-error envelope.
- Mutating commands are idempotent: repeated invocation with the same `--correlation` returns the original result without duplicate mutation (`FR-CLI-3`).
- All local-authority operations work without a network dependency (`FR-CLI-4`).

### 8.3 Intended usage

A canonical session is:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @operatoros-platform/cli build
node apps/cli/dist/index.js --workspace /tmp/operatoros-demo init
node apps/cli/dist/index.js --workspace /tmp/operatoros-demo explain --json
node apps/cli/dist/index.js --workspace /tmp/operatoros-demo mission run \
  --workspace-ref workspace_local:demo \
  --mission-ref mission_local:m1 \
  --specification-ref spec_local:s1 \
  --identity identity://demo --correlation demo-1
```

`docs/GETTING-STARTED.md` and `apps/cli/README.md` are the full user-facing references. The `scripts/demo.sh` script runs the same flow with the smoke test in place of the manual mission run.

---

## 9. Release Model

### 9.1 Versioning

Semantic Versioning. v1.0.0 is the current public release. Pre-1.0 versions (`v1.0.0-rc1`, 2026-07-20) are historical and are not security-supported. v0.8.x is not security-supported either; migration is one-way via `v08-importer`.

The current tag is `v1.0.0` (annotated; peeled to commit `1311f81`).

### 9.2 Frozen authorities

Eight authority documents are pinned in `authority-lock.json` (see §6.2). On every CI run, `pnpm contracts:verify` checks that each on-disk authority matches the pinned SHA-256. Three-way match is enforced: disk + lock + `pnpm contracts:verify` output. Any drift is a release-blocker (P-1 in the release-candidate-public-readiness-audit skill).

The architecture authority is the only one whose change requires a successor-ADR process plus owner approval plus a re-validation cycle. The others can be revised by a regular roadmap amendment when scope is contained.

### 9.3 Architecture lock

`docs/authorities/architecture.md` is byte-locked at `1e79049d9ae5a328556378ff8235525cd0f692bfa317fd7da6dc2bcdb1f27610`. Any change to this SHA-256 invalidates the v1.0.0 release contract. Future architecture changes must follow the formal successor-ADR process described in `docs/RELEASE-PROCESS.md` and `CONTRIBUTING.md`.

### 9.4 Release process

The four release gates (E / G / H / K) are:

- **E — architecture consistency.** `pnpm contracts:verify` (8/8 authorities) and `pnpm architecture:check` (5/5 invariants) agree; architecture SHA matches.
- **G — implementation readiness.** Same gates as E, plus test counts and coverage.
- **H — production hardening.** `pnpm security:scan` (no high-severity vulnerabilities), `pnpm licenses:report`, `pnpm sbom`.
- **K — release readiness.** `pnpm test` (full suite green), `pnpm test:coverage` (≥ 80/80/80/70), `pnpm build`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm docs:build`.

The canonical acceptance command is `pnpm clean-tree:verify` (`tooling/verify-clean-tree.mjs`). It runs the full repository-only sequence (install → quality → smoke → docs → security → licenses → sbom → manifest-verify) and short-circuits on the first failure.

### 9.5 Release philosophy

- **Architecture is the immutable contract.** Code conforms to the architecture, not the reverse. Any new feature that requires changing the architecture must be a successor ADR, not a patch.
- **Evidence is the product surface.** A green test suite is necessary but not sufficient; a release must include evidence that the system produces correct Mission Records under the canonical scenarios.
- **Reproducible clean-clone is the gate.** The release is only real when a fresh checkout (with no local caches, no untracked files, no uncommitted changes) produces the same outcome as the source-of-truth tree.
- **Local is canonical.** Networked and distributed profiles are explicit opt-in; they cannot move canonical state outside operator control.
- **No marketing over statement.** Every public claim must be evidence-backed; the docs are descriptive, not aspirational. The current NFR observations (3,602–4,009 ops/sec throughput, 40 ms RTO, 88 ms cold start, zero secret leakage) are stated as observations on the recorded test host, not capacity or latency guarantees.
- **Owner-gated publication.** `git push`, `git tag v1.0.0`, and GitHub Release creation are operator-authorized. The product state is intentionally committed-and-staged before those gates; the operator's job is to perform the final publication.

---

## 10. Engineering Principles (extracted from the source)

These are not aspirations. They are the principles the repository _demonstrates_, derived from the documents and the released code.

1. **Evidence over inference.** "Unknown state remains unresolved; no projection invents success." (Architecture §2.) The v1.0 codebase honors this in `packages/evidence-service`: a Mission Record cannot be sealed without terminal evidence; the Mutation Envelope emits an explicit `evidence-gap` outcome rather than synthesizing missing evidence.

2. **Architecture freeze, then implementation.** The architecture was frozen _before_ implementation (the v1.0 release verifies that the architecture SHA at release equals the SHA at freeze). The release gates E and F are the canonical enforcement of this principle. The frozen authorities in `docs/authorities/` are the proof of the freeze.

3. **One authority per concept.** No row in the Domain-to-component responsibility map (Architecture §4) gives two components command authority over the same mutation. Composite operations have one coordinator and explicit called commands. The 13 packages implement this: each has a single responsibility that maps to exactly one component or one cross-cutting concern.

4. **Default-deny everywhere.** Capability Grants are explicit; no implicit access. Extensions cannot access undeclared host services. Configuration is built by validated revisions, not edited in place. The Domain's `DM-I15..I19` invariants are the formalization of this principle.

5. **Claim discipline.** Every public statement has evidence. The README, the home page, the CHANGELOG, the NFR matrix — none of them claim production deployment, hosted service availability, SDK publication, or multi-host deployment beyond what the source demonstrates. Where the source is in tension with the documentation, the source wins, and the documentation is updated (this happened in the 2026-07-25 audit pass — the v1.0.0 CHANGELOG entry was updated from 146/21 to 154/22 to match the actual `pnpm test` output).

6. **Release discipline.** The repository has a single canonical acceptance command (`pnpm clean-tree:verify`) that exercises the full quality pipeline, short-circuits on the first failure, and produces reproducible evidence. The 14-step quality gate is the formal definition of "release-ready". The independent audit (`artifacts/release-candidates/v1.0/INDEPENDENT-AUDIT-v2.md`) is the second-look that catches defects the first implementation missed.

7. **Reconciliation from authority, not from memory.** A crash is recovered from durable record / Event / idempotency evidence, never from in-memory coordination state. This is the test that distinguishes the Mutation Envelope from optimistic-concurrency-lite; it is the AV-O1 obligation in the architecture validation.

8. **Operator as final authority.** AI is never the authority. Capability Grants cannot be widened by extension output. Irreversible actions require explicit human authorization. This is `DM-I28`, FR-ADM-4, and the security defaults in `SECURITY.md`.

9. **One canonical interface.** All Surfaces route through `interface.run`, `interface.explain`, `interface.inspect`, `interface.cancel`. No Surface has its own command type. This is what "Surfaces are equivalent" (Architecture §2) means in code.

10. **No silent replacement.** Workspace OS Identity is referenced, never copied. Supersession is explicit. Sealed records are append-closed. Effective Configuration is a projection, never edited directly. A Schema's `.strict()` is on every entity schema (Security defaults). This is the _byte-for-byte_ discipline that the architecture expects and the implementation enforces.

---

## 11. Current Capabilities (v1.0.0)

This section enumerates what the released code does. It is split into three categories by the brief: implemented, intentionally deferred, future backlog.

### 11.1 Implemented in v1.0.0 (verified at tag `v1.0.0`)

**Local-first execution.**

- Single-host Local Deployment Profile (canonical).
- SQLite WAL evidence persistence with `BEGIN IMMEDIATE` and `synchronous=FULL`.
- One adapter per store; four stores per Workspace: evidence, workspace, governance, execution.

**Mission execution.**

- 8 `RUN_STATES` state machine with optimistic concurrency.
- Mission Record creation, sealing, and supersession.
- Mission Execution Specification versioning (Run pins one version).
- Checkpoint and Snapshot creation and restoration.
- Cancellation, interruption, recovery.

**Evidence.**

- Atomic Event Record append.
- Mutation Envelope state machine (`prepared → committing → committed → acknowledged` with `aborted`, `unresolved`, `acknowledged-on-retry`).
- Mission Record sealing with all required evidence.
- Integrity verification and projection rebuild.
- Idempotency via `request_key`; no bypass via new key.

**Authorization and identity.**

- Operator Profile (one active per Identity per deployment).
- Capability Definition + Capability Grant (subject, action, scope, expiry).
- Identity classes: user, service, machine.
- Default-deny; grant widening requires operator action.

**Recovery.**

- Recovery leases with fencing-token preemption.
- Deterministic dual-contender resolution (lexicographic tie-breaker).
- Crash reconciliation from durable evidence.

**Extensions (capability-scoped, not autonomous).**

- Extension Installation lifecycle (staged → installed → enabled → disabled → uninstalled).
- Five extension kinds under one manifest: plugin, integration, dashboard, telemetry-exporter, adapter.
- Default-deny on undeclared access.

**v0.8 migration.**

- `v08-importer` reads v0.8.x workspaces read-only.
- Content-preserving: source `parsed.id`, real `sha256(sourceContent)`, `writeFile` of the source bytes. No synthesis.
- Verification-gated activation per `NFR-MIG-1`.

**CLI Surface (in v1.0).**

- `init`, `explain`, `version`, `help`, `mission run`, `mission inspect`, `mission cancel`.
- `--json` deterministic output; typed errors; idempotency via `--correlation`.

**Quality gates (in v1.0).**

- 14/14 quality-gate steps green: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`, `pnpm build`, `pnpm contracts:verify`, `pnpm architecture:check`, `pnpm security:scan`, `pnpm licenses:report`, `pnpm sbom`, `pnpm docs:build`, `pnpm spike:persistence`, `node tooling/verify-clean-tree.mjs`.
- 154/154 tests across 22 test files; coverage 85.89/93.36/85.89/73.71 (statements/functions/lines/branches) — all above the 80/80/80/70 thresholds.
- Reproducible clean-clone verification (11/11) from a fresh tar snapshot.
- `pnpm audit` clean for the production dependency tree (the `brace-expansion@1.1.16` advisory in the devDeps is resolved via `pnpm.overrides` pinning `>=5.0.8`).

**Observability (in v1.0).**

- Structured logs only.
- The evidence ledger is the canonical observability surface; the home page explicitly says "the evidence ledger, not logs or telemetry, is canonical" (Local deployment).

### 11.2 Intentionally deferred in v1.0.0 (deferred, not abandoned)

These are not "missing" — they are explicitly out of scope per the architecture and the home page. Each has a stated v1.1 target.

- **OS keyring integration for the secrets service.** The package's enum already supports `keyring` and `os-secret-service` backends. v1.0 implements `env-file` and `memory-env`. Tracked in v1.1 backlog (TD-005).
- **OpenTelemetry traces and metrics.** Currently structured logs only. v1.0 ships no OTel exporter.
- **Stable SQLite binding.** `node:sqlite` is experimental in Node 22. The architecture permits alternatives (architecture-validation AV-O1); v1.1 backlog tracks replacement with `better-sqlite3` or `libsql` (TD-001).
- **HTTP API, SDK, Dashboard, telemetry exporter applications.** The architecture reserves the Surface contract for them; v1.0 ships only the in-process and CLI surfaces. The M2/M3 work is a roadmap-level commitment, not a v1.0 deliverable.
- **v0.8 round-trip export.** v0.8 → v1.0 import is implemented; v1.0 → v0.8 export is deferred.
- **Multi-host distributed deployment.** `distributed-coordination` is single-process SQLite peer simulation. No sockets, RPC, replication, partition handling, or cross-host fencing in v1.0.

### 11.3 Future backlog (from `artifacts/release-candidates/v1.0/v1.1-backlog.md`)

The v1.1 backlog is a published file with explicit items. A future agent should consult it directly for the current list, not infer from this document. The categories are: Storage, Distributed, Security, Observability, Tooling, Documentation. The README's roadmap, the home page, and the FAQ all cross-reference it consistently.

---

## 12. Known Limitations (current boundaries)

These are the boundaries the v1.0 codebase _acknowledges_ explicitly. None of them is a defect; each is a deliberate scope decision backed by the architecture or the functional specification.

**Local profile is the only fully credible production surface.** The home page, the deployment doc, and the architecture all say this in the same words. A future agent must not represent the hosted or distributed profiles as production-ready.

**Hosted runtime is a contract shape, not a service.** `packages/hosted-runtime` is 204 source + 152 test lines. It provides an in-memory multi-tenant routing and isolation contract shape. There is no authenticated ingress, no durable tenant-isolated storage, no operational controls, and no realistic deployment path. A future hosted adapter must preserve the four-component authority model while adding these capabilities. Do not present the package as a hosted service in any context.

**Distributed coordination is a single-process simulation.** `packages/distributed-coordination` is 340 source + 255 test lines. There is no network transport, no replication, no partition handling, no cross-host fencing. It exercises peer/anchor/reconciliation primitives in one SQLite database. Do not present it as a multi-host deployment.

**No HTTP API, no SDK, no Dashboard, no telemetry exporter application.** All four are reserved for future Surfaces; v1.0 ships only the in-process and CLI Surfaces. The `interface-host` package reserves the four canonical operations for them; the runtime does not.

**No npm publication.** All 13 workspace packages and 2 apps declare `"private": true`. The `docs/RELEASE-PUBLICATION.md` document explicitly defers package publication to a successor ADR plus owner action. The README's "First Mission" instructions build from source via pnpm; no `npm install @operatoros-platform/*` workflow exists.

**No standalone SDK or HTTP API application.** The architecture reserves the SDK as a "convenience interface, not authority" and the HTTP API as "same contract; no hidden API-only entity." Neither is shipped in v1.0.

**SQLite is experimental.** `node:sqlite` is experimental in Node 22. A "SQLite experimental" warning is expected on every CLI invocation. TD-001 tracks the v1.1 work to replace it with a stable binding. The architecture permits alternatives that prove the same Mutation Envelope outcomes; v1.0 chose SQLite WAL+IMMEDIATE+FULL because that is the simplest mechanism that proved the contract.

**Secrets service has no persistent backend.** v1.0 stores secret material in memory at resolution time and persists only 4-character previews. The package's enum supports `keyring` and `os-secret-service` backends; v1.0 implements `env-file` and `memory-env`. v1.1 adds the OS keyring adapter.

**No observability beyond structured logs.** The Platform has no OTel exporter, no metrics endpoint, no traces. The home page says it explicitly: "the evidence ledger, not logs or telemetry, is canonical" (Local deployment).

**Recovery lease is local.** The recovery-service provides fencing-token preemption and dual-contender resolution for a single host. There is no cross-host lease service. Multi-worker on the same host is supported; multi-host is not.

**No marketplace, no auto-update, no schema-less configuration.** All of these are explicitly forbidden by the Domain Model and the release gates. A future agent must not propose adding them without re-opening the architecture.

**No multi-tenant SaaS organization semantics.** v1.0 operates as one operator-controlled deployment boundary. There is no `Organization` or `Tenant` entity; FR-DEP-4 explicitly forbids it.

**No bootstrap of a host tenant or organization.** The Platform assumes a single Workspace per operator-controlled directory. There is no on-boarding service, no signup, no self-service namespace.

**Run is local to the Workspace that opened it.** A Run pinned to one Mission Execution Specification version and one Mission reference is local to the Workspace where it was opened. There is no cross-Workspace Run; the architecture forbids it.

**`architecture-validation.md` reports a stale architecture SHA.** Its header says `880ba39a…`; the frozen architecture in `authority-lock.json` is `1e79049d…`. Always cross-check `authority-lock.json` first; the validation document is historical.

---

## 13. Development Workflow

A future agent that wants to _work_ with this repository (read-only or write) needs to know the contract. The full rules are in `CONTRIBUTING.md`; this section is the operational summary.

### 13.1 Validation pipeline

A single canonical acceptance command:

```sh
pnpm clean-tree:verify
```

This runs, in order, on failure-stop:

1. `pnpm install --frozen-lockfile`
2. `pnpm quality` — which is `format:check && lint && typecheck && test:coverage && build && contracts:verify && architecture:check`
3. `pnpm test apps/smoke`
4. `pnpm docs:build`
5. `pnpm security:scan`
6. `pnpm licenses:report`
7. `pnpm sbom`
8. `node artifacts/release-candidates/v1.0/verify-manifest.mjs` (release-manifest verification)

Iteration is via `pnpm test`, `pnpm test <package>`, `pnpm test:watch`, `pnpm format`, `pnpm lint`, `pnpm typecheck`.

### 13.2 Testing

- Tests live in `__tests__/` directories within each package.
- Vitest, with V8 coverage. Coverage thresholds: lines 80, functions 80, statements 80, branches 70 (`vitest.config.ts`).
- The smoke test (`apps/smoke`) is the canonical integration test.
- NFR performance and persistence matrices live in `spikes/nfr/` and `spikes/persistence/`.
- Tests must be deterministic and must not depend on the network or real customer data (CONTRIBUTING §Testing conventions).

### 13.3 Release expectations

- Conventional Commits. JS methods/types camelCase; wire fields snake_case. Never commit secrets.
- Branch from `main`; short-lived branches like `fix/evidence-retry` or `docs/mission-guide`. Keep PRs focused.
- A PR explains: the problem, the authority/requirement IDs it maps to, the tests and quality commands run, the compatibility impact, and any documentation or security implications.
- The architecture SHA must not change without a successor ADR. The frozen authority documents must not change without a roadmap amendment (or successor ADR for the architecture itself).

### 13.4 Quality requirements (release-gate)

For any change intended to ship:

- `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm build` must pass.
- `pnpm contracts:verify && pnpm architecture:check` must pass.
- New behavior must map to a Functional Specification ID (`FR-*`, `AV-*`, or `NFR-*`).
- A new RED-GREEN-REFACTOR test is required for any fix or feature.
- If a change adds a domain entity, lifecycle, or boundary, it must be a successor ADR — not a code change.

### 13.5 Repository-only acceptance

`pnpm clean-tree:verify` is the gate. The full pipeline runs in under 2 minutes on warm caches. It does not create a tag, push, publish a package, or create a GitHub Release. Owner-gated actions are separate.

---

## 14. Mental Model

The correct way to think about OperatorOS Platform v1.0.0:

**It is a single-host, local-first event-sourced mission execution platform with explicit human authority and capability-based access control.**

- **Single-host.** All Workpaces and their evidence live in operator-controlled files on one host. Multi-worker on that host is supported. Multi-host is not in v1.0.
- **Local-first.** The Local profile requires no network. No telemetry is emitted on a fresh Local profile. The Workspace can be reconstructed from operator-controlled content and content history.
- **Event-sourced.** Every acknowledged mutation produces an Event Record and updates a Mission Record. The evidence ledger is the canonical source of truth, not the database tables, not the in-memory state, not the dashboard.
- **Mission execution.** A Mission is named intent. A Mission Execution Specification is the versioned Platform configuration that binds Mission to executables. A Run is one execution. A Mission Record is the durable evidence for one Run.
- **Explicit human authority.** Every action requires a Capability Grant. AI is never the authority. Irreversible actions require explicit human authorization. Grant widening requires operator action.
- **Capability-based access control.** Subjects (Operator, Agent, Extension) hold Capability Grants; grants are explicit, time- and scope-bounded, default-deny on missing or expired.
- **Platform.** The Platform is the implementation mechanism. The Platform is replaceable; the Domain is not. Architecture and Domain are immutable contracts; the Platform conforms to them.

To a senior engineer: think **a small, single-host Temporal-like execution layer that takes Workspace OS identity as its operator and writes to a SQLite WAL with sealed Mission Records**. The Platform is not a workflow engine; it is a **mission ledger**. Every Mission Record is the receipt; everything else is a projection.

To a product manager: think **"we cannot make this mistake twice"** as the dominant product principle. The Platform is built so that if a Run goes wrong, there is a `mission_record_ref` that explains what happened, who authorized it, and what was supposed to happen. If the run can be replayed, the record says so. If it cannot, the record says so. The system never reports success from inference.

To a security reviewer: think **default-deny, four-component authority, evidence-as-authority**. Capability Grants are the access control. Mission Records are the audit log. Event Records are the immutable fact ledger. The Platform does not invent identities; it references authoritative ones. Secrets are not persisted; only references and 4-character previews are.

To a release engineer: think **frozen architecture, byte-locked authorities, evidence-backed claims, single canonical acceptance command**. The release is reproducible from a fresh checkout; the gate is `pnpm clean-tree:verify`; the release branch is `main`; the public tag is `v1.0.0`.

---

## 15. Frequently Misunderstood Things

The following are common misconceptions. Each is corrected in one or two sentences.

**Misconception 1: "OperatorOS Platform is a workflow engine."**

It is not. A workflow engine orchestrates tasks. OperatorOS Platform executes Missions with a durable evidence ledger and an operator-controlled authorization boundary. The home page and the FAQ make this distinction explicit: "OperatorOS is not a workflow engine; it is a mission ledger."

**Misconception 2: "OperatorOS Platform supersedes Workspace OS."**

It does not. The Domain Model explicitly states that Platform is "shared execution infrastructure, not a seventh Workspace OS Subsystem." It references Workspace OS primitives and never redefines them. The Platform cannot mutate Identity, Mission intent, Knowledge taxonomy, S1-S6 Subsystems, or Specialization. (DM-I01.)

**Misconception 3: "OperatorOS Platform has a hosted production service."**

It does not. `packages/hosted-runtime` is an in-memory multi-tenant routing and isolation contract shape. It is testable repository code; it is not a deployed, durable, or operationally verified hosted service. The home page, the deployment doc, and the package README all say this in the same words.

**Misconception 4: "OperatorOS Platform has a multi-host distributed deployment."**

It does not. `packages/distributed-coordination` is a single-process SQLite peer simulation. There is no network transport, no replication, no partition handling, no cross-host fencing. The home page, the deployment doc, and the package README all say this in the same words.

**Misconception 5: "OperatorOS Platform has an HTTP API or an SDK."**

It does not, in v1.0. The architecture reserves the Surface contract for them. v1.0 ships only the in-process and CLI Surfaces. Any public claim to "OperatorOS Platform HTTP API" or "OperatorOS Platform SDK" in v1.0 is unsupported.

**Misconception 6: "OperatorOS Platform publishes packages to npm."**

It does not. All 13 workspace packages and 2 apps declare `"private": true`. There is no registry installation workflow. The `docs/RELEASE-PUBLICATION.md` document defers package publication to a successor ADR plus owner action. Until then, do not document `npm install @operatoros-platform/*`.

**Misconception 7: "Sealed evidence means the system reports succeeded from inference."**

It does not. Sealed means the required evidence is durable and verifiable, the Run is in a terminal state, and the Mission Record's append-closed contract is honored. A `committed` Mutation Envelope that loses its response can be safely retried with the same request key; the original result is reproduced. An `evidence-gap` outcome is an explicit unresolved state, not a guess.

**Misconception 8: "Recovery is a runtime hope; a crash is a real problem."**

Recovery is a contract. The Mutation Envelope distinguishes `prepared`, `committing`, `committed`, `acknowledged`, `aborted`, `unresolved`, and `acknowledged-on-retry`. The recovery service provides fencing tokens and a deterministic dual-contender resolution. A crashed Run is reconciled from durable evidence, never from in-memory state. The platform never reports succeeded from inference.

**Misconception 9: "The architecture-validation document pins the architecture SHA."**

It does not. The validation document's header reports a _historical_ architecture SHA (`880ba39a…`); the _frozen_ architecture in `authority-lock.json` is `1e79049d…`. The codebase uses the lock file. Always cross-check `authority-lock.json`; the validation document is historical.

**Misconception 10: "There is a current test count for v1.0.0."**

There is not a fixed count. The README and the CHANGELOG are explicit: "use the totals printed by the current `pnpm quality` run; do not rely on a stale fixed total in documentation." At the v1.0.0 tag the count is 154 tests across 22 files; the next test addition will make this number stale, by design.

**Misconception 11: "The home page is the source of truth for capabilities."**

It is not. The home page is a marketing surface that honestly bounds its claims (it says "Implementation closed · in-memory contract" for M3 and "tested primitives" for M4). The Domain Model, the Functional Specification, the Architecture, and the released source are the source of truth. The home page is a rendering of that truth for operators, not a replacement for it.

**Misconception 12: "Telemetry, metrics, and traces are part of v1.0."**

They are not. v1.0 provides structured logs only. The home page says it explicitly: "v1.0 provides structured logs only. v1.1 backlog work includes OpenTelemetry (OTel). In Local, the evidence ledger—not logs or telemetry—is canonical."

---

## 16. AI Context Summary (for use as long-term context)

The following facts are stable, evidence-backed, and useful across future conversations. They are intentionally compressed for use in AI conversation contexts that have a token budget.

**OperatorOS Platform v1.0.0 is a published, MIT-licensed, local-first Mission execution platform with an evidence ledger.** Released 2026-07-25 at tag `v1.0.0` (commit `1311f81`); repository `github.com/taras-polishchuk/operatoros-platform`; architecture frozen at SHA-256 `1e79049d9ae5a328556378ff8235525cd0f692bfa317fd7da6dc2bcdb1f27610`.

**It is a TypeScript monorepo.** 13 private workspace packages, 2 applications (CLI + smoke test), 2 spikes (persistence crash matrix + NFR performance), one operational scripts directory, one tooling directory. No npm publication. Source installation via `pnpm install --frozen-lockfile`.

**It is local-first.** The Local profile is the only fully credible production surface. No network is required for canonical Workspace operations. Fresh Local profiles emit no telemetry. SQLite WAL is the canonical evidence storage.

**It is not a workflow engine; it is a mission ledger.** A Mission is named intent; a Run is one execution; a Mission Record is the durable evidence for one Run. The Platform never redefines Workspace OS Mission intent.

**Authority is explicit.** Four frozen components implement the Domain: Workspace Service, Execution Service, Evidence Service, Interface Host. The Interface Host is the only dispatch boundary. Every action requires a Capability Grant. The operator is the final authority; AI cannot widen its own grants.

**Recovery is a contract, not a hope.** The Mutation Envelope state machine (`prepared → committing → committed → acknowledged` with explicit `aborted`, `unresolved`, `acknowledged-on-retry` outcomes) makes acknowledgement deterministic. The recovery service provides fencing-token preemption and dual-contender resolution. Crashes are reconciled from durable evidence, never from coordination memory.

**The four-component model is augmented, not replaced, by the 13 packages.** `recovery-service`, `governance-service`, `secrets-service`, `agent-execution`, `extension-runtime`, `hosted-runtime`, `distributed-coordination`, and `v08-importer` are cross-cutting concerns or optional profiles that live behind the four core components' responsibility boundaries. The four components' responsibilities do not change.

**v1.0 ships no HTTP API, no SDK, no Dashboard, no telemetry exporter application, no npm publication, no hosted service, no multi-host deployment.** The architecture reserves the Surface contract for them; v1.0 implements only the in-process and CLI Surfaces. Each of these absences is documented consistently across the README, the home page, the deployment doc, the package READMEs, the FAQ, and the security policy.

**Claim discipline is structural.** The 14-step quality gate (`pnpm clean-tree:verify`) is the canonical acceptance. Two independent release-readiness audits were performed (v1 NOT READY with 4 defects, v2 PUBLIC RELEASE READY after fixes). The 2026-07-25 cold-path re-verification added 9 dispositions (D-05..D-13) including a `pnpm.overrides` fix for the `brace-expansion@1.1.16` devDep advisory. The home page, the README, the CHANGELOG, the NFR matrix, and the release notes are aligned: "evidence-backed observations on the recorded test host, not capacity or latency guarantees."

**The architecture SHA is the only one that requires a successor-ADR process to change.** The other seven frozen authorities (Domain Model, Functional Specification, Architecture Validation, Implementation Roadmap, Test Strategy, Final Consistency Audit, Final Design Report) can be revised by a regular roadmap amendment when scope is contained.

**The canonical acceptance command is `pnpm clean-tree:verify`.** It runs the full repository-only sequence (install → quality → smoke → docs → security → licenses → sbom → manifest-verify) and short-circuits on the first failure. Owner-gated actions (commit, tag, push, GitHub Release, npm publish) are not part of the gate.

**Local evidence on the v1.0.0 tag:** 154/154 tests across 22 test files; coverage 85.89/93.36/85.89/73.71 (statements/functions/lines/branches) — all above the 80/80/80/70 thresholds; 14/14 quality-gate steps green; reproducible clean-clone verification 11/11 PASS; 8/8 frozen authorities verified; 5/5 architecture invariants PASS; `pnpm audit` clean (the `brace-expansion` advisory is resolved via `pnpm.overrides`); 3,602–4,009 ops/sec throughput on three 5,000-mutation runs; 40 ms recovery time; 88 ms cold start; zero secret leakage.

**How to reason about future work.** New features map to a Functional Specification ID (`FR-*`, `AV-*`, or `NFR-*`) and a Roadmap work package (`IP-*` or `IP-V*`). Domain changes require a successor ADR. Architecture changes require the formal successor-ADR process plus owner approval. The canonical interface for any new Surface is the Interface Host's four operations: `interface.run`, `interface.explain`, `interface.inspect`, `interface.cancel`. The canonical acceptance command is `pnpm clean-tree:verify`. The canonical authority reference is `authority-lock.json`. The canonical sequence of evidence is in `artifacts/release-candidates/v1.0/INDEPENDENT-AUDIT-v2.md` and this document.

**Stable identifiers and cross-references (for future use):**

- Architecture SHA-256: `1e79049d9ae5a328556378ff8235525cd0f692bfa317fd7da6dc2bcdb1f27610`
- Frozen authorities file: `authority-lock.json` (paths and SHA-256s of 8 authorities)
- Test command: `pnpm test` (current count, not a fixed number)
- Coverage thresholds: 80/80/80/70
- Release tag: `v1.0.0` (annotated; peeled to `1311f81`)
- Architecture authorities directory: `docs/authorities/`
- Release candidate bundle: `artifacts/release-candidates/v1.0/`
- Home page source: `homepage/index.html`
- Workspace OS integration: not bundled; integration is by reference to Workspace OS identity and mission, not by inclusion
- Migration from v0.8: `v08-importer` is read-only and content-preserving
- Future backlog: `artifacts/release-candidates/v1.0/v1.1-backlog.md`

**Do not assume OperatorOS Platform is a Temporal clone.** It is a mission ledger, not a workflow engine. The product framing and the language in the home page, the FAQ, and the security policy are explicit and consistent on this point.

**Do not assume Workspace OS is bundled.** It is upstream; OperatorOS references its primitives.

**Do not assume hosted or distributed profiles are production-ready.** They are contract shapes and test primitives.

**Do not assume the architecture SHA in the validation document is current.** It is historical; use `authority-lock.json` as the source.

**Do not assume the test count is fixed.** It is the live output of `pnpm test`. The CHANGELOG and the README both make this explicit.

---

_End of canonical context. The implementation is authoritative. The architecture is frozen. The evidence is the product. The operator is the final authority._
