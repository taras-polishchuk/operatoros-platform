# OperatorOS Platform - Implementation Roadmap

> **Phase:** 6 - Implementation Planning
> **Status:** CANDIDATE FOR GATE G
> **Date:** 2026-07-19
> **Architecture:** `OPERATOROS-PLATFORM-ARCHITECTURE-2026-07-19.md` SHA `880ba39a9e00e138f343d12f3f8a7a8f93b87d44a0b1a7c5c64f61925836afbd`
> **Architecture Validation:** SHA `a2ff530baf89fb15c619e6c88725e6a0862c5a436975c8d8352f44f4bb8804e3`
> **Gate F:** PASS
> **Scope:** Implementation program only. No production code is created by this document.

## Document contract

**Inputs**

- Current Domain/Gate C, Functional Specification/Gate D, Architecture/Gate E, Architecture Validation/Gate F, ADR-001.

**Outputs**

- M0-M4 independently releasable program, executable work packages, dependency DAG, exact 101-ID ownership, AV/risk destinations, release and migration gates.

**Authorities**

- Frozen current Architecture and higher Domain/Functional contracts.

**Consumers**

- Gate G, Test Strategy/Gate H, Stress Review, Production Readiness, Competitive Review.

**Dependencies**

- Current C-F chain only.

**Reverse dependencies**

- Every active artifact from Gate G through Final Report.

---

## 1. Program rules

1. M0-M4 are additive release slices. Each closes its own gate and leaves prior gates green.
2. Local is canonical. M0-M2 require no network for authoritative Workspace behavior.
3. M3/M4 are optional profiles and cannot block Local releases.
4. Every task has one primary output owner, explicit dependencies, verifiable acceptance, and exact requirement ownership.
5. Every acknowledged architecture risk remains open until executable evidence closes it.
6. A spike may select an implementation mechanism but cannot change Domain/Architecture contracts.
7. No marketplace, auto-update, schema-less configuration, multi-tenant SaaS, or cloud-owned canonical authority.
8. Every release reruns all earlier milestone gates.

## 2. Implementation boundary and stack decision

The implementation begins in a separate `operatoros-platform` repository/package boundary. It may share published contracts and migration adapters with OperatorOS v0.8, but it does not edit the v0.8 source tree as part of Platform implementation.

Baseline implementation direction:

- TypeScript-first packages and generated schemas/bindings, matching the operator stack and current OperatorOS ecosystem.
- Runtime validation at every external boundary.
- Local authority adapter selected by IP-003 from crash-tested mechanisms, not by document preference.
- Operator-hosted/distributed adapters remain optional packages behind the same contracts.
- Technology selection ADRs are implementation ADRs; they cannot redefine entities, authority, lifecycle, or observable requirements.

## 3. Milestone overview

| Milestone | Name | Independently releasable outcome | Release candidate | Depends on |
|---|---|---|---|---|
| M0 | Local Bedrock | Offline Workspace/Mission/Run core with evidence, security, recovery, CLI, v0.8 import and measured local release gates | `v1.0.0-local` | None |
| M1 | Agent Execution | Agents, schedules, model routing, memory and knowledge workflows on the M0 local core | `v1.1.0-agent` | M0 |
| M2 | Extensibility | Unified extensions, integrations, HTTP API and SDK with security/compatibility evidence | `v1.2.0-extensible` | M1 |
| M3 | Operator-hosted | Optional Dashboard, telemetry, and one operator-hosted remote-client profile | `v1.3.0-hosted` | M2 |
| M4 | Distributed operator-controlled | Optional distributed adapters with partition-safe recovery and measured chaos evidence | `v2.0.0-distributed` | M3 |

## 4. Work packages

### 4.1 M0 - Local Bedrock

**Release outcome:** Offline Workspace/Mission/Run core with evidence, security, recovery, CLI, v0.8 import and measured local release gates.

| Task | Work package | Dependencies | Primary requirement IDs | Deliverables | Acceptance |
|---|---|---|---|---|---|
| IP-001 | Bootstrap isolated Platform repository and contract toolchain | None | NFR-COMP-1 | Repository skeleton; lint/type/test/build commands; architecture hash lock; generated contract index | Clean clone runs all empty-suite commands; no OperatorOS v0.8 source is modified |
| IP-002 | Compile Domain, command, query, event, error, and Surface schemas | IP-001 | Validation/control only | Versioned schema package; runtime validators; compatibility metadata; contract generation | All current entities/envelopes compile; invalid corpus rejected; Surface bindings derive from one source |
| IP-003 | Prove local authoritative persistence and Mutation Envelope mechanism | IP-002 | NFR-REL-1 | Two bounded spikes; ADR selecting local mechanism; crash harness; reconciliation prototype | Every envelope crash point returns committed/uncommitted/conflict/evidence-gap; no acknowledged loss |
| IP-004 | Implement Evidence Service and Mission Record lifecycle | IP-003 | FR-OBS-1, FR-OBS-2, FR-OBS-3, FR-OBS-4 | Event append; envelope coordinator; evidence index; sealing/integrity/rebuild APIs | Aggregate ordering, correlation, idempotency, sealing, correction successor, and evidence-gap tests pass |
| IP-005 | Implement Workspace Service Artifact/Workspace core and projections | IP-004 | FR-WE-1, FR-WE-2, FR-WE-3, FR-WE-4, NFR-MIG-1 | Workspace/Artifact commands; active pointers; Catalog rebuild; import/export Snapshot | Projection deletion/rebuild equivalent; source preserved on migration/restore |
| IP-006 | Implement Operator Profile, Capability Grant, Configuration Revision, and Model-neutral policy foundation | IP-005 | FR-ADM-1, FR-ADM-2, FR-ADM-3, FR-ADM-4, FR-CFG-1, FR-CFG-2, FR-CFG-3, FR-CFG-4 | Profile/grant/config commands; Effective Configuration projection; human approval hooks; dual-operator review policy for irreversible authority changes | One active profile rule; default deny; deterministic precedence; rollback successor tests pass; irreversible actions require specific dual-operator approval |
| IP-007 | Implement Mission Execution Specification, Run state machine, and Execution Service core | IP-004, IP-006 | FR-RT-1, FR-RT-2, FR-RT-3, FR-RT-4, FR-ME-1, FR-ME-2, FR-ME-3, FR-ME-4 | Specification validation/activation; Run create/transition; Mission State enforcement; command coordinator | Eight Mission artifacts enforced; every Run edge and illegal edge tested; one record per Run |
| IP-008 | Implement Secret Reference boundary and security enforcement baseline | IP-006, IP-007 | FR-SEC-1, FR-SEC-2, FR-SEC-3, FR-SEC-4, FR-SRY-1, FR-SRY-2, FR-SRY-3, FR-SRY-4, FR-SRY-5, NFR-SEC-1, NFR-SEC-2 | Secret adapter contract; identity attribution; isolation interface; canary scanner | Zero canary leakage across complete baseline corpus; no ambient credential path |
| IP-009 | Implement canonical local CLI through Interface Host | IP-005, IP-007, IP-008 | FR-CLI-1, FR-CLI-2, FR-CLI-3, FR-CLI-4 | Shared command/query handlers; deterministic JSON; pagination/streaming/idempotency; offline commands | CLI contract tests pass offline; no transport-owned behavior |
| IP-010 | Implement checkpoint, interruption, recovery, Snapshot restore, and unresolved-state workflow | IP-007, IP-009 | FR-REC-1, FR-REC-2, FR-REC-3, FR-REC-4 | Checkpoint Artifact; recovery lease local implementation; restore; recovery inspection; dual-contender test | Crash/restart scenarios never infer success; dual contenders produce one safe continuation or explicit unresolved state; failure-isolation tests cover process kill, disk-full, and secret-outage |
| IP-011 | Implement v0.8 import and Local Deployment Profile packaging | IP-005, IP-009, IP-010 | FR-DEP-1, FR-DEP-4 | Non-destructive importer; verification report; local package/install/backup/restore docs | Golden v0.8 corpus imports without source mutation; fresh offline acceptance passes |
| IP-012 | Close local release performance, admission, durability, and operability gates | IP-004 through IP-011 | NFR-PERF-1, NFR-PERF-2, NFR-PERF-3, NFR-REL-2, NFR-OPS-1, NFR-OPS-2, NFR-USE-1 | Admission policy; resource budgets; 100k/10k benchmark; evidence throughput; timed recovery usability | All NFR budgets and AV-O1/O2/O3/O4/O6 pass on named reference profile |
| IP-V0 | Release gate: Local Bedrock | IP-012 | Validation/control only | M0 verification report and immutable evidence bundle | All M0 requirements mapped and tested; architecture hash current; no open M0 blocker |

### 4.2 M1 - Agent Execution

**Release outcome:** Agents, schedules, model routing, memory and knowledge workflows on the M0 local core.

| Task | Work package | Dependencies | Primary requirement IDs | Deliverables | Acceptance |
|---|---|---|---|---|---|
| IP-101 | Implement Agent Registration, dispatch, isolation selection, and grant-bound invocation | IP-V0 | FR-AR-1, FR-AR-2, FR-AR-3, FR-AR-4 | Agent registration/enable/disable/retire; invocation host; isolation adapters | No invocation without pinned registration, grant, boundary, input/output schema |
| IP-102 | Implement durable scheduling and trigger idempotency | IP-V0, IP-007 | FR-SCH-1, FR-SCH-2, FR-SCH-3, FR-SCH-4 | Schedule lifecycle/evaluator; trigger identity; missed/overlap/timezone policies | Restart/clock/duplicate tests produce intended Run requests exactly once by identity |
| IP-103 | Implement Model Route evaluation and model adapters | IP-101 | FR-MR-1, FR-MR-2, FR-MR-3, FR-MR-4 | Route versioning/evaluation trace; declared fallback; availability evidence | Fixed evidence reproduces selection; no undeclared fallback or model-authored policy |
| IP-104 | Implement Memory Artifact and context-routing contracts | IP-005, IP-101 | FR-MEM-1, FR-MEM-2, FR-MEM-3, FR-MEM-4 | Memory metadata/retention; scoped loader; context budget; promotion guard | Cross-Workspace/subject leaks denied; expired/unpromoted memory behavior passes |
| IP-105 | Implement Knowledge Article candidate workflow | IP-004, IP-104 | FR-KN-1, FR-KN-2, FR-KN-3, FR-KN-4 | ADR/IR/LL candidate creation; evidence links; duplicate/pattern gates; human promotion hook | Direct AI promotion denied; IR escaped-failure and LL two-Mission criteria tested |
| IP-106 | Close autonomous execution load, failure, and knowledge-noise gates | IP-101 through IP-105 | Validation/control only | Agent/model/scheduler/memory load suite; failure isolation; knowledge throttle metrics | Thousands-of-registrations load scenario bounded; failures isolated; knowledge candidates controlled |
| IP-V1 | Release gate: Agent Execution | IP-106 | Validation/control only | M1 verification report | M1 requirements pass on Local profile without regressing M0 |

### 4.3 M2 - Extensibility

**Release outcome:** Unified extensions, integrations, HTTP API and SDK with security/compatibility evidence.

| Task | Work package | Dependencies | Primary requirement IDs | Deliverables | Acceptance |
|---|---|---|---|---|---|
| IP-201 | Implement unified Extension API and manifest compiler | IP-V1, IP-002 | FR-EXT-1, FR-EXT-2, FR-EXT-3, FR-EXT-4 | Manifest grammar; capability/compatibility/isolation validation; host service interfaces | All extension kinds validate under one grammar; undeclared access denied |
| IP-202 | Implement extension install/enable/disable/upgrade/uninstall lifecycle | IP-201 | FR-PL-1, FR-PL-2, FR-PL-3, FR-PL-4 | Staging, active pointer, successor migration, kind-specific uninstall verification | Failed upgrade keeps predecessor; remote/local uninstall obligations pass |
| IP-203 | Implement Integration and adapter failure contracts | IP-202, IP-008 | FR-INT-1, FR-INT-2, FR-INT-3, FR-INT-4 | Credential/grant binding; hard/optional dependency behavior; retries/circuits/fallbacks | Provider outage/rate-limit tests isolate unrelated integrations |
| IP-204 | Implement public HTTP API and typed SDK from shared contracts | IP-201, IP-009 | FR-SDK-1, FR-SDK-2, FR-SDK-3, FR-SDK-4 | HTTP transport; SDK generation/binding; parity/compatibility/cancellation/streaming | CLI/API/SDK semantic parity and version-range tests pass |
| IP-205 | Close extension security, compatibility, migration, and supply-chain gates | IP-202 through IP-204 | Validation/control only | Adversarial extension corpus; digest/source verification; migration/rollback evidence | Tamper/downgrade/excess-capability/leak/crash scenarios deny safely |
| IP-V2 | Release gate: Extensibility | IP-205 | Validation/control only | M2 verification report | M2 requirements pass; no marketplace/auto-update implied |

### 4.4 M3 - Operator-hosted

**Release outcome:** Optional Dashboard, telemetry, and one operator-hosted remote-client profile.

| Task | Work package | Dependencies | Primary requirement IDs | Deliverables | Acceptance |
|---|---|---|---|---|---|
| IP-301 | Implement optional Dashboard as replaceable extension | IP-V2, IP-204 | FR-DSH-1, FR-DSH-2, FR-DSH-3, FR-DSH-4 | Dashboard extension using API/SDK; command/query parity; cache deletion/rebuild | No Dashboard-only state/behavior; removal leaves complete non-UI product |
| IP-302 | Implement opt-in telemetry exporter extensions | IP-V2, IP-004 | FR-TEL-1, FR-TEL-2, FR-TEL-3, FR-TEL-4 | OTel-compatible adapter contract; redaction; loss/backpressure isolation | Fresh profile emits no network telemetry; exporter failure cannot alter Run truth |
| IP-303 | Package and validate Operator-hosted Deployment Profile | IP-301, IP-302 | FR-DEP-2 | Remote client/auth configuration; operator-controlled durable service adapter; closed-loop rollback runbook; backup/restore/upgrade runbook | Cross-profile semantic suite passes; one deployment authority boundary preserved; closed-loop rollback from M3 to M2 contract is exercised |
| IP-304 | Close operator-hosted operational and security gates | IP-303 | Validation/control only | E2E, backup/restore, extension/telemetry failure, remote auth, upgrade evidence | All M0-M3 requirements pass on operator-hosted profile; Local remains green |
| IP-V3 | Release gate: Operator-hosted | IP-304 | Validation/control only | M3 verification report | Profile is deployable/operable without changing Domain or local authority |

### 4.5 M4 - Distributed operator-controlled

**Release outcome:** Optional distributed adapters with partition-safe recovery and measured chaos evidence.

| Task | Work package | Dependencies | Primary requirement IDs | Deliverables | Acceptance |
|---|---|---|---|---|---|
| IP-401 | Implement operator-controlled distributed persistence/coordination adapters | IP-V3, IP-003 | Validation/control only | Replicated authority adapter; worker lease/queue adapter; idempotent dispatch | No coordination mechanism becomes authority; profile contract parity holds |
| IP-402 | Implement partition-safe recovery lease and reconciliation | IP-401, IP-010 | Validation/control only | Split-brain prevention/detection; partition reconciliation; duplicate continuation fencing | Chaos tests prove one safe continuation or explicit unresolved state |
| IP-403 | Close distributed scale, failover, backup, and upgrade gates | IP-402 | FR-DEP-3 | Multi-worker load/chaos; rolling compatibility; backup/restore; RPO/RTO report | AV-O5 and distributed AR risks pass measured criteria |
| IP-V4 | Release gate: Distributed operator-controlled profile | IP-403 | Validation/control only | M4 verification report | Distributed profile passes all shared requirements and profile-only chaos gates |

## 5. Exact normative requirement ownership

Each current normative requirement has exactly one primary work package. Supporting tasks/tests may reference it, but primary implementation ownership is unique.

| Requirement | Primary task | Milestone | Requirement summary |
|---|---|---|---|
| FR-RT-1 | IP-007 | M0 | The Platform shall create each Run with an immutable Run ID, one Workspace OS Mission reference, one Mission Execution Specification version, and one open Mission Record. |
| FR-RT-2 | IP-007 | M0 | The Platform shall permit only Run transitions defined by the Domain Model and shall record each accepted or rejected transition. |
| FR-RT-3 | IP-007 | M0 | The Platform shall support pause, resume, cancel, interrupt, recover, succeed, and fail semantics without treating checkpoints as Run states. |
| FR-RT-4 | IP-007 | M0 | The Platform shall reconstruct current Run status from operator-controlled durable records after process restart. |
| FR-WE-1 | IP-005 | M0 | The Platform shall initialize a Workspace only in an operator-controlled git-tracked directory and shall reference, never copy, Workspace OS Identity. |
| FR-WE-2 | IP-005 | M0 | The Platform shall create, validate, activate, supersede, and archive Artifacts using explicit versions and provenance. |
| FR-WE-3 | IP-005 | M0 | The Platform shall rebuild Catalog and search projections from Workspace Artifacts and detect projection drift. |
| FR-WE-4 | IP-005 | M0 | The Platform shall export and import a Workspace without requiring Platform-owned cloud state. |
| FR-ME-1 | IP-007 | M0 | The Platform shall validate and version Mission Execution Specifications independently from Workspace OS Mission intent. |
| FR-ME-2 | IP-007 | M0 | The Platform shall enforce the eight-artifact Mission State contract for every Platform-managed Mission. |
| FR-ME-3 | IP-007 | M0 | The Platform shall create exactly one Mission Record per Run and seal it only after terminal outcome evidence is complete. |
| FR-ME-4 | IP-007 | M0 | The Platform shall require explicit operator approval or an operator-authored pre-authorization policy before starting or materially changing a Mission execution. |
| FR-KN-1 | IP-105 | M1 | The Platform shall support ADR, IR, and LL as Workspace OS-governed Artifact kinds with provenance and lifecycle metadata. |
| FR-KN-2 | IP-105 | M1 | The Platform shall prevent observations, Event Records, Memory Artifacts, and model output from being promoted to Knowledge without the Workspace OS evidence-to-governance process. |
| FR-KN-3 | IP-105 | M1 | The Platform shall create an Incident Report candidate when a failure escapes a declared runtime, security, recovery, or durability contract. |
| FR-KN-4 | IP-105 | M1 | The Platform shall create a Lesson Learned candidate only when the same validated pattern is evidenced across at least two independent Missions. |
| FR-AR-1 | IP-101 | M1 | The Platform shall register an Agent only with one typed responsibility, declared Capability Definitions, identity class, and Security Boundary. |
| FR-AR-2 | IP-101 | M1 | The Platform shall enable an Agent Registration only after compatibility, isolation, and required capability checks pass. |
| FR-AR-3 | IP-101 | M1 | The Platform shall authorize every Agent action through an active Capability Grant matching subject, action, scope, and operation. |
| FR-AR-4 | IP-101 | M1 | The Platform shall stop new work from disabled or retired Agent Registrations while preserving in-flight recovery evidence. |
| FR-PL-1 | IP-202 | M2 | The Platform shall stage an Extension Installation only from a manifest declaring kind, version, compatibility, capabilities, isolation, entry points, and uninstall contract. |
| FR-PL-2 | IP-202 | M2 | The Platform shall enable an Extension Installation only when its Capability Grants and Security Boundary satisfy its manifest. |
| FR-PL-3 | IP-202 | M2 | The Platform shall perform extension upgrade by installing and validating a successor, migrating compatible state, switching the active pointer, and preserving the predecessor. |
| FR-PL-4 | IP-202 | M2 | The Platform shall uninstall an Extension Installation by disabling execution, removing executable material, verifying removal, and preserving audit evidence. |
| FR-CLI-1 | IP-009 | M0 | The CLI shall expose the same domain commands and authorization semantics as every other Surface. |
| FR-CLI-2 | IP-009 | M0 | The CLI shall provide deterministic machine-readable output and typed errors for every command. |
| FR-CLI-3 | IP-009 | M0 | The CLI shall make mutating commands idempotent or require an explicit request key. |
| FR-CLI-4 | IP-009 | M0 | The CLI shall support all local-authority operations without a network dependency in the local Deployment Profile. |
| FR-DSH-1 | IP-301 | M3 | The optional Dashboard shall be a rebuildable Surface over canonical domain queries and commands. |
| FR-DSH-2 | IP-301 | M3 | The Dashboard shall enforce the same Capability Grants and approval rules as CLI and HTTP API. |
| FR-DSH-3 | IP-301 | M3 | The Dashboard shall never display Secret values or unredacted sensitive Event fields. |
| FR-DSH-4 | IP-301 | M3 | The Platform shall allow Dashboard removal without loss of domain behavior or evidence. |
| FR-SEC-1 | IP-008 | M0 | The Platform shall store and transmit only Secret References in Platform entities, evidence, projections, logs, and telemetry. |
| FR-SEC-2 | IP-008 | M0 | The Platform shall resolve a Secret Reference only for a subject with an active matching Capability Grant at point of use. |
| FR-SEC-3 | IP-008 | M0 | The Platform shall support secret version rotation without silently changing a pinned Run dependency. |
| FR-SEC-4 | IP-008 | M0 | The Platform shall isolate secret backend failure from unrelated Runs and local Workspace access. |
| FR-SCH-1 | IP-102 | M1 | The Platform shall persist Schedule policy and lifecycle independently from scheduler process state. |
| FR-SCH-2 | IP-102 | M1 | A Schedule firing shall create an idempotent Run request linked to the active Mission Execution Specification. |
| FR-SCH-3 | IP-102 | M1 | A one-shot Schedule shall retire only after its Run request is durably recorded. |
| FR-SCH-4 | IP-102 | M1 | The Platform shall define timezone, missed-trigger, overlap, backfill, and clock-change policy for every Schedule. |
| FR-TEL-1 | IP-302 | M3 | Telemetry export shall be disabled by default and require explicit operator configuration. |
| FR-TEL-2 | IP-302 | M3 | Telemetry signals shall be derived from Run and Event evidence and shall not be required to reconstruct authoritative state. |
| FR-TEL-3 | IP-302 | M3 | Telemetry exporters shall be replaceable Extension Installations with isolated failure behavior. |
| FR-TEL-4 | IP-302 | M3 | Telemetry shall redact secrets, sensitive attributes, model payloads, and operator identity according to policy before export. |
| FR-MEM-1 | IP-104 | M1 | The Platform shall store cross-Run memory only as a Memory Artifact with scope, provenance, sensitivity, retention, owner, and expiration. |
| FR-MEM-2 | IP-104 | M1 | The Platform shall load Memory Artifacts only when subject, Workspace, Mission, and sensitivity policy authorize them. |
| FR-MEM-3 | IP-104 | M1 | The Platform shall expire or archive Memory Artifacts according to declared retention without deleting referenced evidence. |
| FR-MEM-4 | IP-104 | M1 | The Platform shall never treat a Memory Artifact as Workspace OS Knowledge without authorized promotion. |
| FR-INT-1 | IP-203 | M2 | An Integration shall use the Extension Installation lifecycle and declare external authority, capabilities, data classes, and replaceability. |
| FR-INT-2 | IP-203 | M2 | The Platform shall execute an Integration only with active grants and configured external credentials or declared credential-less mode. |
| FR-INT-3 | IP-203 | M2 | The Platform shall distinguish optional from hard Integration dependencies in each Mission Execution Specification. |
| FR-INT-4 | IP-203 | M2 | The Platform shall isolate provider retries, rate limits, and circuit state per Integration. |
| FR-MR-1 | IP-103 | M1 | The Platform shall version and validate each Model Route before activation. |
| FR-MR-2 | IP-103 | M1 | The Platform shall reproduce model selection from route version, request requirements, endpoint availability evidence, and evaluation trace. |
| FR-MR-3 | IP-103 | M1 | The Platform shall apply fallback only in declared order and within operator-configured capability, cost, latency, and data-boundary constraints. |
| FR-MR-4 | IP-103 | M1 | A model or Agent shall never alter its Model Route, Capability Grant, approval policy, or security boundary. |
| FR-SDK-1 | IP-204 | M2 | The SDK shall expose typed representations of all public entity commands, queries, events, and errors without creating SDK-only behavior. |
| FR-SDK-2 | IP-204 | M2 | The SDK shall propagate authorization context, request identity, idempotency key, and correlation identity explicitly. |
| FR-SDK-3 | IP-204 | M2 | The SDK shall provide stable pagination, streaming, cancellation, and retry semantics for long operations. |
| FR-SDK-4 | IP-204 | M2 | The SDK shall publish deprecation and compatibility metadata before removing or changing a public contract. |
| FR-EXT-1 | IP-201 | M2 | The Extension API shall define one versioned manifest and Capability Definition grammar for all Extension Installation kinds. |
| FR-EXT-2 | IP-201 | M2 | The Extension API shall expose only declared host services and shall deny filesystem, network, process, secret, model, and identity access unless granted. |
| FR-EXT-3 | IP-201 | M2 | The Extension API shall require compatibility negotiation before install, enable, and upgrade. |
| FR-EXT-4 | IP-201 | M2 | The Extension API shall provide bounded health, shutdown, checkpoint, and error contracts without granting domain authority. |
| FR-ADM-1 | IP-006 | M0 | The Platform shall let an authorized operator create, activate, suspend, and archive Operator Profiles without modifying Workspace OS Identity. |
| FR-ADM-2 | IP-006 | M0 | The Platform shall let authorized administrators grant, deny, revoke, and inspect Capability Grants with least-privilege scope and expiry. |
| FR-ADM-3 | IP-006 | M0 | Administrative commands shall create successor Configuration Revisions rather than edit Effective Configuration directly. |
| FR-ADM-4 | IP-006 | M0 | The Platform shall require explicit human approval for irreversible authority, identity, credential issuance, evidence deletion, and external publication actions. |
| FR-CFG-1 | IP-006 | M0 | The Platform shall store configuration only as validated immutable Configuration Revisions with explicit scope. |
| FR-CFG-2 | IP-006 | M0 | The Platform shall resolve Effective Configuration with one documented precedence order and include provenance for every value. |
| FR-CFG-3 | IP-006 | M0 | The Platform shall never allow direct mutation of Effective Configuration or projection caches. |
| FR-CFG-4 | IP-006 | M0 | The Platform shall support rollback by activating a validated predecessor through a new successor decision while retaining full history. |
| FR-DEP-1 | IP-011 | M0 | The Platform shall provide a canonical local Deployment Profile whose authoritative Workspace operations require no network service. |
| FR-DEP-2 | IP-303 | M3 | The Platform may provide opt-in networked Deployment Profiles only when they preserve the same Domain, requirements, authorization, and evidence contracts. |
| FR-DEP-3 | IP-403 | M4 | Every Deployment Profile shall keep canonical state under operator control and document backup, restore, upgrade, observability, and failure ownership. |
| FR-DEP-4 | IP-011 | M0 | The v1 Platform shall operate as one operator-controlled deployment boundary and shall not expose multi-tenant SaaS organization semantics. |
| FR-REC-1 | IP-010 | M0 | The Platform shall create verified Checkpoint Artifacts at declared synchronization points without changing Run state solely because a checkpoint exists. |
| FR-REC-2 | IP-010 | M0 | After interruption the Platform shall reconstruct evidence, select the newest compatible verified checkpoint, and transition `interrupted -> recovering -> running` or `failed`. |
| FR-REC-3 | IP-010 | M0 | The Platform shall create, verify, restore, and supersede Snapshot Artifacts without making a Snapshot the Workspace authority. |
| FR-REC-4 | IP-010 | M0 | The Platform shall preserve an explicit unresolved recovery obligation when automatic recovery cannot prove a safe outcome. |
| FR-OBS-1 | IP-004 | M0 | The Platform shall query Run state, transitions, evidence, subjects, capabilities, models, extensions, and artifacts through stable domain queries. |
| FR-OBS-2 | IP-004 | M0 | The Platform shall produce an Audit View as a rebuildable actor- and security-focused projection. |
| FR-OBS-3 | IP-004 | M0 | The Platform shall expose Catalog drift, projection freshness, exporter health, recovery status, and unresolved evidence gaps. |
| FR-OBS-4 | IP-004 | M0 | The Platform shall correlate commands, Runs, Events, extension calls, model selections, and external requests without using operator identity as a correlation key. |
| FR-SRY-1 | IP-008 | M0 | The Platform shall deny every action not allowed by an active matching Capability Grant. |
| FR-SRY-2 | IP-008 | M0 | The Platform shall enforce the declared Security Boundary for every enabled Agent Registration and Extension Installation. |
| FR-SRY-3 | IP-008 | M0 | The Platform shall attribute every administrative, capability, external, and evidence-mutating action to an authoritative user, service, or machine identity source. |
| FR-SRY-4 | IP-008 | M0 | The Platform shall redact secret values and policy-sensitive content from all evidence projections, errors, diagnostics, telemetry, and exports. |
| FR-SRY-5 | IP-008 | M0 | The Platform shall verify extension source identity, content digest, compatibility, manifest, requested capabilities, and isolation before enablement. |
| NFR-PERF-1 | IP-012 | M0 | Local command/query latency |
| NFR-PERF-2 | IP-012 | M0 | Run control latency |
| NFR-PERF-3 | IP-012 | M0 | Resource bounds |
| NFR-SEC-1 | IP-008 | M0 | Security defaults |
| NFR-SEC-2 | IP-008 | M0 | Sensitive-data leakage |
| NFR-REL-1 | IP-003 | M0 | Durability |
| NFR-REL-2 | IP-012 | M0 | Recovery objectives |
| NFR-COMP-1 | IP-001 | M0 | Contract compatibility |
| NFR-MIG-1 | IP-005 | M0 | Migration safety |
| NFR-OPS-1 | IP-012 | M0 | Operability |
| NFR-OPS-2 | IP-012 | M0 | Evidence retention |
| NFR-USE-1 | IP-012 | M0 | First recovery usability |

## 6. Architecture Validation obligation mapping

| Obligation | Primary task/gate | Secondary validation | Release effect |
|---|---|---|---|
| AV-O1 Mutation Envelope spike/crash matrix | IP-003, IP-004 | IP-012, Test Strategy crash suite | Blocks M0 |
| AV-O2 aggregate ordering/correlation/sealing | IP-004 | IP-012 | Blocks M0 |
| AV-O3 Evidence throughput/admission | IP-012 | Phase 8 stress | Blocks M0 |
| AV-O4 100k/10k benchmark | IP-012 | Test Strategy performance suite | Blocks M0 |
| AV-O5 split-brain/recovery lease/partition | IP-402, IP-403 | Phase 8 chaos | Blocks M4 only |
| AV-O6 zero secret leakage | IP-008, IP-012 | every release security regression | Blocks every milestone |
| AV-O7 exact 101-ID mappings | §5 + Gate G; Test Strategy + Gate H | Final Consistency Audit | Blocks Gates G/H |

## 7. Architecture risk ownership

| Risk | Primary work packages | Required evidence |
|---|---|---|
| AR-R01 | IP-003/IP-004 | crash-point envelope matrix |
| AR-R02 | IP-012 | throughput/admission benchmark |
| AR-R03 | Gate G/Competitive Review | component responsibility review |
| AR-R04 | IP-201/IP-202 | all-kind manifest/lifecycle conformance |
| AR-R05 | IP-011/IP-303/IP-403 | cross-profile semantics |
| AR-R06 | IP-303/IP-403 | operational pilot/chaos |
| AR-R07 | IP-004/IP-012 | concurrent causality replay |
| AR-R08 | IP-402/IP-403 | split-brain chaos |
| AR-R09 | IP-010/IP-202 | checkpoint compatibility corpus |
| AR-R10 | IP-005/IP-012 | delete/rebuild equivalence |
| AR-R11 | IP-006/IP-101 | grant graph/usability audit |
| AR-R12 | IP-008/IP-205 | canary/adversarial extension suite |
| AR-R13 | IP-103/IP-106 | availability replay |
| AR-R14 | IP-104/IP-106 | context privacy/load |
| AR-R15 | IP-007/IP-304 | approval policy/timed scenarios |
| AR-R16 | IP-011 | v0.8 golden migration corpus |
| AR-R17 | IP-204/IP-304 | Surface contract parity |
| AR-R18 | IP-105/IP-106 | knowledge dedup/throttle metrics |
| AR-R19 | IP-012 | 100k/10k benchmark |
| AR-R20 | IP-012/IP-403 | retention/restore cost study |

## 8. Critical path and dependency DAG

```text
IP-001 -> IP-002 -> IP-003 -> IP-004 -> IP-005 -> IP-006 -> IP-007
                                      |                    |
                                      +-> IP-008 -> IP-009 -> IP-010 -> IP-011 -> IP-012 -> IP-V0
IP-V0 -> {IP-101, IP-102} -> IP-103 -> {IP-104 -> IP-105} -> IP-106 -> IP-V1
IP-V1 -> IP-201 -> IP-202 -> {IP-203, IP-204} -> IP-205 -> IP-V2
IP-V2 -> {IP-301, IP-302} -> IP-303 -> IP-304 -> IP-V3
IP-V3 -> IP-401 -> IP-402 -> IP-403 -> IP-V4
```

Critical path to first usable release: IP-001 -> IP-V0 (see §8 DAG).

Parallel work is permitted only where tasks do not write the same package/contract file. Contract package and shared manifests have single-task ownership per batch.

## 9. Milestone gates

| Gate | Required evidence | Cannot be waived by |
|---|---|---|
| IP-V0 Local Bedrock | build/type/test; architecture hash; 101-ID subset; AV-O1/O2/O3/O4/O6 each with explicit PASS evidence; v0.8 migration; offline E2E; backup/restore; zero secret canary leakage | later profile promise; informal review |
| IP-V1 Agent Execution | agent/scheduler/model/memory/knowledge integration, load and failure evidence; all M0 green | extension work |
| IP-V2 Extensibility | manifest/lifecycle/security/compatibility/API/SDK parity; all prior green | trusted-source assumption |
| IP-V3 Operator-hosted | cross-profile semantics, remote auth, backup/restore, observability and upgrade; Local green | UI demo |
| IP-V4 Distributed | split-brain, partition, recovery lease, scale, failover, rolling compatibility, RPO/RTO; all prior green | local-profile PASS |

## 10. Migration strategy

1. Preserve v0.8 source Workspace and CLI behavior.
2. Analyze and report before mutation.
3. Import to a staging destination using versioned adapters.
4. Validate Artifact, Mission, Identity reference, configuration and evidence mapping.
5. Produce human-readable and machine-readable migration report.
6. Activate only after verification PASS.
7. Keep source usable until explicit operator retirement.
8. Migration failure is resumable/idempotent and never auto-upgrades the source.

## 11. Release strategy

- Each milestone emits a signed/hashed evidence bundle, compatibility matrix, migration note, recovery runbook, and current risk report.
- Counts are observations; release decisions rerun machine checks.
- M0 is the first production-implementation candidate but not production-ready until code/evidence exists.
- M3/M4 are profile-specific releases. Their failure cannot revoke a green Local release.
- Breaking public/extension/schema changes require successor contracts and migration windows.
- No implementation release begins from this design mission.

## 12. Day-one execution checklist

- [ ] Create isolated target repository after operator confirms implementation mission scope.
- [ ] Copy frozen input hashes into implementation Mission State.
- [ ] Implement IP-001 contract toolchain only.
- [ ] Generate schema inventory from current Domain/FR, not historical docs.
- [ ] Run IP-003 spike before choosing durable mechanism.
- [ ] Reject any spike result that changes Domain or Architecture semantics.
- [ ] Create per-task branch/batch ownership with no shared-file concurrent writers.
- [ ] Persist test/benchmark/crash evidence under implementation Mission State.
- [ ] Do not start M1 until IP-V0 passes.

## 13. Stress Review integration record

Stress Review 2026-07-19 returned ACCEPT WITH TARGETED TIGHTENINGS and routed five items to this Roadmap. All five are integrated:

- **ST-4 integrated:** IP-010 acceptance now requires dual-contender and failure-isolation tests.
- **ST-6 integrated:** §9 IP-V0 Local Bedrock release gate now requires explicit PASS evidence for AV-O1/O2/O3/O4/O6 plus zero secret canary leakage.
- **ST-9 integrated:** IP-303 acceptance now requires a closed-loop rollback runbook.
- **ST-11 integrated:** IP-006 acceptance now requires dual-operator review for irreversible authority changes.
- **ST-2/ST-3 partial:** cross-aggregate causality and dual-contender test case enumeration delegated to Test Strategy §X-AGG/§X-RECOV, where they are integrated.

Roadmap §7 risk ownership remains unchanged. Only current Roadmap hash and downstream Gate G reference are regenerated.

## 15. Gate G entry condition

Gate G must verify:

1. all 101 normative requirement IDs appear exactly once in §5;
2. all task dependencies resolve and form a DAG;
3. no task depends on a later milestone;
4. every milestone has one release gate and independently releasable outcome;
5. AV-O1 through AV-O7 and AR-R01 through AR-R20 have owners;
6. every acceptance criterion is measurable;
7. no code implementation or frozen-authority modification occurred;
8. Test Strategy can derive complete coverage without new architecture decisions.

Until Gate G PASS, Phase 7 may not begin.
