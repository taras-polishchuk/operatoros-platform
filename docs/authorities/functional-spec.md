# OperatorOS Platform - Functional Specification

> **Phase:** 3 - Functional Requirements
> **Status:** CANDIDATE FOR GATE D
> **Version:** 1.0-recovery.1
> **Date:** 2026-07-19
> **Supersedes in active chain:** `OPERATOROS-PLATFORM-FUNCTIONAL-SPEC-2026-07-18.md`

## Document contract

**Inputs**

- `OPERATOROS-PLATFORM-PRODUCT-VISION-2026-07-18.md`
- `OPERATOROS-PLATFORM-DOMAIN-MODEL-2026-07-19.md`
- `OPERATOROS-PLATFORM-DOMAIN-MODEL-GATE-C-2026-07-19.md`
- `OPERATOROS-PLATFORM-RESEARCH-2026-07-18.md`
- ADR-001 and recovery-control artifacts

**Outputs**

- Atomic observable requirements for all 22 Product Vision capability categories.
- Non-functional budgets and complete Domain traceability.
- Gate D input contract.

**Authorities**

- Workspace OS > Product Vision > Domain Model > this Functional Specification.
- OperatorOS v0.8 remains the unchanged compatibility authority for its release line.

**Consumers**

- Gate D, Architecture, Architecture Validation, Implementation Roadmap, Test Strategy, Stress Review, Production Readiness, Competitive Review, final artifacts.

**Dependencies**

- Product Vision, current Gate-C Domain Model, Research obligations, ADR-001.

**Reverse dependencies**

- Every active artifact from Gate D through Final Report.

---

## 1. Requirement grammar

Every `FR-*` row is atomic and normative. Columns are mandatory:

- **Statement:** one externally observable SHALL.
- **Acceptance:** reproducible success criterion.
- **Failure:** typed error/denial behavior with no silent partial success.
- **Recovery:** safe next action.
- **Expectation:** measurable security, performance, compatibility, migration, or operability constraint.
- **Domain trace:** owning entity/value/projection and relevant Domain invariants.

`NFR-*` rows are cross-cutting measurable constraints. They do not replace acceptance criteria in functional rows.

## 2. Functional requirements by Product Vision category

### 2.1 Runtime

| ID | Statement | Acceptance | Failure | Recovery | Expectation | Domain trace |
|---|---|---|---|---|---|---|
| FR-RT-1 | The Platform shall create each Run with an immutable Run ID, one Workspace OS Mission reference, one Mission Execution Specification version, and one open Mission Record. | Creation succeeds atomically and all four references are queryable before execution begins. | Any missing or stale reference rejects Run creation without a partial Run. | Retry after correcting the reference set; no cleanup is required. | O: creation is idempotent for one client request key. | Run; Mission Record; DM-I09, DM-I10 |
| FR-RT-2 | The Platform shall permit only Run transitions defined by the Domain Model and shall record each accepted or rejected transition. | A transition matrix test covers every legal edge and rejects every other edge. | Illegal or concurrent transitions return the current state and a typed conflict. | Caller reloads current state and retries only a still-legal transition. | S/O: transition attribution and request identity are retained. | Run; Event Record; DM-I11 |
| FR-RT-3 | The Platform shall support pause, resume, cancel, interrupt, recover, succeed, and fail semantics without treating checkpoints as Run states. | Each operation reaches the specified Domain state and emits linked evidence. | Unsupported operation for current state is rejected without mutation. | Resume or recovery starts from the newest verified compatible Checkpoint. | O: cancel is bounded and reports work that could not be interrupted. | Run; Checkpoint; DM-I12, DM-I13 |
| FR-RT-4 | The Platform shall reconstruct current Run status from operator-controlled durable records after process restart. | A clean process reconstructs state and evidence with no runtime cache. | Missing or corrupt evidence marks the Run unresolved rather than guessing state. | Invoke recovery inspection and restore from verified evidence or Snapshot. | P/O: reconstruction progress is observable and resumable. | Run; Mission Record; DM-I03, DM-I06 |

### 2.2 Workspace Engine

| ID | Statement | Acceptance | Failure | Recovery | Expectation | Domain trace |
|---|---|---|---|---|---|---|
| FR-WE-1 | The Platform shall initialize a Workspace only in an operator-controlled git-tracked directory and shall reference, never copy, Workspace OS Identity. | Initialization verifies version control, creates required Platform metadata, and stores only an Identity reference. | Non-versioned or ambiguous roots are rejected with no partial authority record. | Operator initializes version control or selects the correct root and retries. | S/C: existing v0.8.x workspace content is preserved. | Workspace; Operator Profile; DM-I01, DM-I04, DM-I05 |
| FR-WE-2 | The Platform shall create, validate, activate, supersede, and archive Artifacts using explicit versions and provenance. | Every Artifact transition names actor, predecessor where applicable, schema result, and content-history reference. | Silent overwrite and missing predecessor are rejected. | Create a corrected successor or archive the invalid draft. | O: active-to-successor traversal is deterministic. | Artifact; DM-I07 |
| FR-WE-3 | The Platform shall rebuild Catalog and search projections from Workspace Artifacts and detect projection drift. | Deleting projections and rebuilding produces equivalent inventory and identifies injected drift. | Projection failure does not block authoritative Artifact reads. | Discard and rebuild the projection from Workspace evidence. | P: incremental rebuild has bounded memory; full rebuild reports progress. | Catalog projection; DM-I03, DM-I08 |
| FR-WE-4 | The Platform shall export and import a Workspace without requiring Platform-owned cloud state. | A fresh local environment restores active Artifact pointers, Mission references, and validation state from operator-controlled export and history. | Incomplete or tampered export is rejected before activation. | Resume verified transfer or restore the last valid Snapshot. | M/C: source remains usable until destination verification passes. | Workspace; Snapshot; DM-I06, DM-I29 |

### 2.3 Mission Engine

| ID | Statement | Acceptance | Failure | Recovery | Expectation | Domain trace |
|---|---|---|---|---|---|---|
| FR-ME-1 | The Platform shall validate and version Mission Execution Specifications independently from Workspace OS Mission intent. | Activation requires a valid Mission reference, acceptance conditions, subjects, capability needs, and policy declarations. | Invalid specification remains draft and cannot start a Run. | Create a corrected successor draft and revalidate. | C: existing Runs retain their pinned specification version. | Mission Execution Specification; DM-I09 |
| FR-ME-2 | The Platform shall enforce the eight-artifact Mission State contract for every Platform-managed Mission. | Before Run execution, source-task, progress, decisions, blockers, artifacts, environment, execution-log, and final-report paths exist and are registered. | Missing shape blocks execution and lists exact missing artifacts. | Create missing artifacts from canonical templates, then retry validation. | O: updates are append-safe and attributable. | Mission Execution Specification; Artifact; DM-I14 |
| FR-ME-3 | The Platform shall create exactly one Mission Record per Run and seal it only after terminal outcome evidence is complete. | Concurrent completion paths result in one sealed record with one terminal outcome. | Incomplete evidence prevents sealing and sets an explicit unresolved finding. | Recover missing evidence or seal a superseding correction record after authorization. | S/O: sealed records are append-closed. | Run; Mission Record; DM-I10, DM-I13 |
| FR-ME-4 | The Platform shall require explicit operator approval or an operator-authored pre-authorization policy before starting or materially changing a Mission execution. | Every start, scope change, or irreversible action resolves an approval record and actor. | Absent or ambiguous authorization denies the action. | Operator supplies approval or narrows the action to a pre-authorized reversible scope. | S: AI-generated policy is never accepted as authority. | Mission Execution Specification; Capability Grant; DM-I28 |

### 2.4 Knowledge integration

| ID | Statement | Acceptance | Failure | Recovery | Expectation | Domain trace |
|---|---|---|---|---|---|---|
| FR-KN-1 | The Platform shall support ADR, IR, and LL as Workspace OS-governed Artifact kinds with provenance and lifecycle metadata. | Each created article declares kind, evidence links, status, owner, and Workspace location. | Unknown kind or missing evidence remains a temporary Artifact. | Complete governance metadata and revalidate. | C: the Platform does not redefine Workspace OS knowledge taxonomy. | Artifact; Knowledge Article; DM-I27 |
| FR-KN-2 | The Platform shall prevent observations, Event Records, Memory Artifacts, and model output from being promoted to Knowledge without the Workspace OS evidence-to-governance process. | Promotion tests require Observation, Evidence, Pattern, Knowledge, and authorized Governance transitions. | Direct promotion is denied and recorded. | Route the candidate through the missing lifecycle stages. | S: AI is never promotion authority. | Artifact; Memory Artifact; DM-I26, DM-I28 |
| FR-KN-3 | The Platform shall create an Incident Report candidate when a failure escapes a declared runtime, security, recovery, or durability contract. | Escaped failure creates a linked IR draft with Run, evidence, impact, and recovery references. | IR creation failure does not hide the original incident. | Persist an unresolved IR obligation in Mission State and retry independently. | O: duplicate incident keys converge on one candidate. | Mission Record; Artifact; DM-I27 |
| FR-KN-4 | The Platform shall create a Lesson Learned candidate only when the same validated pattern is evidenced across at least two independent Missions. | Candidate cites at least two Mission Records and states the reusable pattern and falsification boundary. | Single-instance lessons remain observations. | Accumulate additional evidence or archive the candidate. | O: pattern counts are mechanically reproducible. | Artifact; Mission Record; DM-I27 |

### 2.5 Agent Runtime

| ID | Statement | Acceptance | Failure | Recovery | Expectation | Domain trace |
|---|---|---|---|---|---|---|
| FR-AR-1 | The Platform shall register an Agent only with one typed responsibility, declared Capability Definitions, identity class, and Security Boundary. | Registration validation rejects missing, conflicting, or unbounded declarations. | Invalid registration remains proposed and cannot be enabled. | Correct the registration and re-run validation. | S: executor identity is distinct from operator identity. | Agent Registration; DM-I04, DM-I15 |
| FR-AR-2 | The Platform shall enable an Agent Registration only after compatibility, isolation, and required capability checks pass. | Enablement stores the verified contract version and check evidence. | Any failed check denies enablement without executable side effects. | Resolve the failed check or use a compatible registration version. | C/S: enabled version is pinned per Run. | Agent Registration; Security Boundary; DM-I15 |
| FR-AR-3 | The Platform shall authorize every Agent action through an active Capability Grant matching subject, action, scope, and operation. | Allow and deny cases are covered for scope, expiry, revocation, and Run binding. | Missing or mismatched grant denies before action execution. | Request a new operator-authorized grant; never widen implicitly. | S: declaration and grant remain separate. | Agent Registration; Capability Grant; DM-I16, DM-I17, DM-I18 |
| FR-AR-4 | The Platform shall stop new work from disabled or retired Agent Registrations while preserving in-flight recovery evidence. | Disable prevents new dispatch; retirement is terminal for that registration version. | In-flight non-interruptible work is marked and bounded. | Cancel, checkpoint, or complete according to Run policy, then verify no new dispatch. | O: status change propagates within a documented bound. | Agent Registration; Run; DM-I13 |

### 2.6 Plugin System

| ID | Statement | Acceptance | Failure | Recovery | Expectation | Domain trace |
|---|---|---|---|---|---|---|
| FR-PL-1 | The Platform shall stage an Extension Installation only from a manifest declaring kind, version, compatibility, capabilities, isolation, entry points, and uninstall contract. | Schema and compatibility validation cover plugin, integration, dashboard, telemetry-exporter, and adapter kinds. | Unknown or incomplete manifest remains staged and non-executable. | Supply a corrected signed or operator-trusted manifest. | S/C: install source and digest are retained as evidence. | Extension Installation; DM-I15, DM-I22 |
| FR-PL-2 | The Platform shall enable an Extension Installation only when its Capability Grants and Security Boundary satisfy its manifest. | Enablement fails for excess requested capability, stale grant, or weaker isolation. | Denied enablement produces no executable registration. | Narrow the manifest, strengthen isolation, or obtain explicit grants. | S: default deny applies to undeclared behavior. | Extension Installation; Capability Grant; DM-I16 |
| FR-PL-3 | The Platform shall perform extension upgrade by installing and validating a successor, migrating compatible state, switching the active pointer, and preserving the predecessor. | Failure at any step leaves the predecessor active and usable. | Incompatible or partial migration cannot activate successor. | Rollback active pointer and resume or restart migration from verified checkpoint. | M/C: no in-place identity mutation. | Extension Installation; Artifact; DM-I23 |
| FR-PL-4 | The Platform shall uninstall an Extension Installation by disabling execution, removing executable material, verifying removal, and preserving audit evidence. | Verification proves no executable entry point remains while historical records resolve. | Partial removal leaves installation disabled with an unresolved cleanup finding. | Retry cleanup from manifest or operator-approved manual procedure. | S/O: uninstall cannot delete Workspace artifacts it does not own. | Extension Installation; DM-I22, DM-I24 |

### 2.7 CLI

| ID | Statement | Acceptance | Failure | Recovery | Expectation | Domain trace |
|---|---|---|---|---|---|---|
| FR-CLI-1 | The CLI shall expose the same domain commands and authorization semantics as every other Surface. | Contract tests produce equivalent outcomes through CLI and HTTP for shared operations. | CLI-specific behavior cannot bypass validation or grants. | Route through the canonical command contract. | C: command deprecations follow version policy. | Surface; Capability Grant |
| FR-CLI-2 | The CLI shall provide deterministic machine-readable output and typed errors for every command. | JSON mode validates against published schemas and never mixes progress text into data output. | Serialization failure returns non-zero with a typed diagnostic. | Retry in human mode only for diagnosis; correct schema before automation use. | P: streaming output uses bounded memory. | Surface; Event Record |
| FR-CLI-3 | The CLI shall make mutating commands idempotent or require an explicit request key. | Repeated command with same key returns the original result without duplicate mutation. | Conflicting reuse of a key is rejected. | Use a new key only for a new intended mutation. | O: result includes authoritative resource identity. | Surface; entities |
| FR-CLI-4 | The CLI shall support all local-authority operations without a network dependency in the local Deployment Profile. | An offline acceptance suite covers Workspace, Mission, Run inspection, configuration, and recovery commands. | Remote-only adapter failure does not disable local commands. | Operate locally and reconcile optional integrations later. | P/C: startup remains bounded on absent network. | Deployment Profile; DM-I29, DM-I30 |

### 2.8 Dashboard

| ID | Statement | Acceptance | Failure | Recovery | Expectation | Domain trace |
|---|---|---|---|---|---|---|
| FR-DSH-1 | The optional Dashboard shall be a rebuildable Surface over canonical domain queries and commands. | Deleting Dashboard state and reconnecting reproduces current views from authoritative records. | Dashboard unavailability does not affect Runs or CLI/API operation. | Restart or replace Dashboard independently. | O: no dashboard-only state exists. | Surface; DM-I03, DM-I24 |
| FR-DSH-2 | The Dashboard shall enforce the same Capability Grants and approval rules as CLI and HTTP API. | Cross-surface authorization tests return equivalent allow/deny outcomes. | Client-side state cannot authorize a command. | Reload authoritative authorization and retry if still valid. | S: server-side enforcement is mandatory. | Surface; Capability Grant; DM-I16 |
| FR-DSH-3 | The Dashboard shall never display Secret values or unredacted sensitive Event fields. | Security tests cover HTML, network payload, cache, export, and error paths. | Sensitive projection is denied and a security Event Record is created. | Revoke affected grant, invalidate cache, and execute incident procedure. | S: references and redaction metadata only. | Secret Reference; Event Record; DM-I19 |
| FR-DSH-4 | The Platform shall allow Dashboard removal without loss of domain behavior or evidence. | A no-Dashboard deployment passes the same non-UI acceptance and recovery suites. | Removal cannot orphan a command or authority. | Use CLI/API/SDK Surface or install a compatible successor Dashboard. | C: Dashboard contract is replaceable. | Extension Installation; Surface; DM-I24 |

### 2.9 Secrets

| ID | Statement | Acceptance | Failure | Recovery | Expectation | Domain trace |
|---|---|---|---|---|---|---|
| FR-SEC-1 | The Platform shall store and transmit only Secret References in Platform entities, evidence, projections, logs, and telemetry. | Automated scans of success and failure paths find no configured test secret value. | Detected value leakage hard-fails the operation and opens a security incident obligation. | Revoke/rotate exposed secret, redact non-authoritative projections, preserve incident evidence. | S: zero secret-value persistence is mandatory. | Secret Reference; DM-I19 |
| FR-SEC-2 | The Platform shall resolve a Secret Reference only for a subject with an active matching Capability Grant at point of use. | Resolution tests cover subject, Workspace, Run, version, purpose, expiry, and revocation. | Denied resolution reveals no existence or value detail beyond policy-safe diagnostics. | Obtain a narrow grant or correct the reference. | S: resolution is attributed as an Event Record. | Secret Reference; Capability Grant; DM-I16, DM-I18 |
| FR-SEC-3 | The Platform shall support secret version rotation without silently changing a pinned Run dependency. | New Runs follow configured active version; pinned Runs follow policy and record any authorized rebind. | Revoked pinned version pauses or fails safely. | Operator rebinds to a permitted version or restores the dependency. | C/O: old reference metadata remains auditable. | Secret Reference |
| FR-SEC-4 | The Platform shall isolate secret backend failure from unrelated Runs and local Workspace access. | Fault injection shows only dependent operations fail or pause. | Backend timeout never falls back to plaintext or unapproved source. | Retry with bounded backoff, use operator-configured backend fallback, or pause. | P/S: no indefinite wait and no insecure fallback. | Secret Reference; Run; DM-I22 |

### 2.10 Scheduler

| ID | Statement | Acceptance | Failure | Recovery | Expectation | Domain trace |
|---|---|---|---|---|---|---|
| FR-SCH-1 | The Platform shall persist Schedule policy and lifecycle independently from scheduler process state. | Restart preserves armed/suspended/retired status and next trigger calculation. | Corrupt policy prevents firing and identifies the Schedule. | Restore last validated version or create a successor. | O: schedule evaluation is queryable. | Schedule; DM-I03 |
| FR-SCH-2 | A Schedule firing shall create an idempotent Run request linked to the active Mission Execution Specification. | Duplicate delivery produces one Run request for the same trigger identity. | Invalid target or missing grants creates no Run. | Correct target/grants and explicitly replay the trigger if policy permits. | O: trigger and resulting Run are correlated. | Schedule; Run; DM-I09 |
| FR-SCH-3 | A one-shot Schedule shall retire only after its Run request is durably recorded. | Crash between request and retirement recovers to one request and retired schedule. | Ambiguous state is reconciled from request identity. | Replay reconciliation, not the business action. | O: exactly-once request identity, at-least-once evaluation. | Schedule; Event Record |
| FR-SCH-4 | The Platform shall define timezone, missed-trigger, overlap, backfill, and clock-change policy for every Schedule. | Validation rejects schedules missing any policy dimension. | Ambiguous local time or clock reversal cannot silently duplicate work. | Apply declared skip, coalesce, or bounded backfill policy. | C/O: calculation is deterministic for fixed clock evidence. | Schedule |

### 2.11 Telemetry

| ID | Statement | Acceptance | Failure | Recovery | Expectation | Domain trace |
|---|---|---|---|---|---|---|
| FR-TEL-1 | Telemetry export shall be disabled by default and require explicit operator configuration. | Fresh local deployment emits no network telemetry and passes Local-First checks. | Exporter configuration without approval remains inactive. | Enable with explicit destination, scope, retention, and redaction policy. | S: opt-in evidence is retained. | Telemetry projection; DM-I29, DM-I30 |
| FR-TEL-2 | Telemetry signals shall be derived from Run and Event evidence and shall not be required to reconstruct authoritative state. | Deleting telemetry leaves Mission Record and Run reconstruction unchanged. | Signal loss increments an operational health finding only. | Restart or replace exporter and resume from current evidence where supported. | O: loss is visible but non-authoritative. | Telemetry; DM-I03, DM-I24 |
| FR-TEL-3 | Telemetry exporters shall be replaceable Extension Installations with isolated failure behavior. | Exporter crash, timeout, or invalid payload does not fail unrelated Run work. | Backpressure is bounded and drops only according to declared signal policy. | Disable exporter, retain local evidence, install a compatible successor. | P: queue/cardinality budgets are enforced. | Extension Installation; DM-I22, DM-I24 |
| FR-TEL-4 | Telemetry shall redact secrets, sensitive attributes, model payloads, and operator identity according to policy before export. | Redaction tests cover spans, metrics, logs, errors, retries, and exporter diagnostics. | Unredactable signal is dropped and recorded locally. | Correct policy/schema and re-enable; never export first and redact later. | S: no secret values or unauthorized content cross boundary. | Telemetry; Secret Reference; DM-I19 |

### 2.12 Memory

| ID | Statement | Acceptance | Failure | Recovery | Expectation | Domain trace |
|---|---|---|---|---|---|---|
| FR-MEM-1 | The Platform shall store cross-Run memory only as a Memory Artifact with scope, provenance, sensitivity, retention, owner, and expiration. | Validation rejects memory missing any required metadata. | Invalid memory is not loaded into agent context. | Correct metadata or archive the Artifact. | S/O: scope resolution is deterministic. | Artifact; Memory Artifact; DM-I25 |
| FR-MEM-2 | The Platform shall load Memory Artifacts only when subject, Workspace, Mission, and sensitivity policy authorize them. | Positive and negative context-routing tests cover cross-Workspace and cross-subject access. | Unauthorized memory is omitted without revealing content. | Request authorized scope or continue without memory. | S/P: minimum sufficient context is loaded. | Memory Artifact; Capability Grant; DM-I16, DM-I25 |
| FR-MEM-3 | The Platform shall expire or archive Memory Artifacts according to declared retention without deleting referenced evidence. | Retention evaluation distinguishes temporary memory from evidence linked by sealed Mission Records. | Referenced evidence cannot be removed by memory cleanup. | Detach non-authoritative cache copy or supersede retention policy. | O: cleanup produces an attributable report. | Memory Artifact; Mission Record; DM-I25 |
| FR-MEM-4 | The Platform shall never treat a Memory Artifact as Workspace OS Knowledge without authorized promotion. | Knowledge queries exclude unpromoted memory; promotion requires evidence lifecycle. | Direct flag change is denied. | Create a Knowledge Article candidate with required evidence. | S: AI cannot self-promote memory. | Memory Artifact; Artifact; DM-I26, DM-I28 |

### 2.13 Integrations

| ID | Statement | Acceptance | Failure | Recovery | Expectation | Domain trace |
|---|---|---|---|---|---|---|
| FR-INT-1 | An Integration shall use the Extension Installation lifecycle and declare external authority, capabilities, data classes, and replaceability. | Manifest validation rejects connectors that claim external data ownership or hidden capabilities. | Invalid integration remains staged. | Correct manifest or use a compliant adapter. | C/S: provider-specific logic stays behind the contract. | Extension Installation; DM-I22 |
| FR-INT-2 | The Platform shall execute an Integration only with active grants and configured external credentials or declared credential-less mode. | Tests cover absent, invalid, revoked, and least-privilege credentials. | Failure denies only dependent action and records policy-safe evidence. | Reconfigure credential/grant and retry under Mission policy. | S: no implicit ambient credentials. | Extension Installation; Secret Reference; Capability Grant |
| FR-INT-3 | The Platform shall distinguish optional from hard Integration dependencies in each Mission Execution Specification. | Optional failure degrades declared output; hard failure pauses/fails according to policy. | Undeclared dependency is rejected at specification validation. | Declare dependency semantics in a successor specification. | O: dependency status is visible before Run start. | Mission Execution Specification; Extension Installation; DM-I22 |
| FR-INT-4 | The Platform shall isolate provider retries, rate limits, and circuit state per Integration. | Fault injection proves one provider outage does not propagate to unrelated integrations. | Retry exhaustion returns typed failure and residual work status. | Resume after circuit recovery or use operator-configured compatible fallback. | P/O: retries are bounded and jittered. | Extension Installation; DM-I22 |

### 2.14 Model Routing

| ID | Statement | Acceptance | Failure | Recovery | Expectation | Domain trace |
|---|---|---|---|---|---|---|
| FR-MR-1 | The Platform shall version and validate each Model Route before activation. | Validation covers ordered criteria, required capabilities, endpoint references, budget and fallback termination. | Invalid or cyclic route remains draft. | Correct and activate a successor route. | C: active Runs pin route version. | Model Route; DM-I21 |
| FR-MR-2 | The Platform shall reproduce model selection from route version, request requirements, endpoint availability evidence, and evaluation trace. | Replaying fixed inputs yields the same selection and explanation. | Missing availability evidence marks the decision non-reproducible. | Record evidence and retry selection; do not invent availability. | O: route evaluation is queryable. | Model Route; Event Record; DM-I21 |
| FR-MR-3 | The Platform shall apply fallback only in declared order and within operator-configured capability, cost, latency, and data-boundary constraints. | Tests cover every fallback edge and terminal exhaustion. | No eligible endpoint returns typed route exhaustion. | Pause/fail Run or request operator policy change. | S: fallback cannot widen data or capability scope. | Model Route; Capability Grant |
| FR-MR-4 | A model or Agent shall never alter its Model Route, Capability Grant, approval policy, or security boundary. | Attempted self-modification is denied and recorded. | No model output is interpreted as policy authority. | Operator creates a validated successor policy if desired. | S: AI is never authority. | Model Route; Agent Registration; DM-I28 |

### 2.15 SDK

| ID | Statement | Acceptance | Failure | Recovery | Expectation | Domain trace |
|---|---|---|---|---|---|---|
| FR-SDK-1 | The SDK shall expose typed representations of all public entity commands, queries, events, and errors without creating SDK-only behavior. | Contract parity tests compare SDK and HTTP/embedded outcomes. | Unsupported contract version fails before mutation. | Use a compatible SDK or negotiated contract version. | C: version compatibility is machine-readable. | Surface; entities |
| FR-SDK-2 | The SDK shall propagate authorization context, request identity, idempotency key, and correlation identity explicitly. | Tests prove no ambient operator identity or hidden credential path is used. | Missing context rejects mutating calls. | Supply context from authoritative configured source. | S/O: attribution follows Article XI. | Surface; Capability Grant; DM-I04 |
| FR-SDK-3 | The SDK shall provide stable pagination, streaming, cancellation, and retry semantics for long operations. | Large result and long Run tests remain bounded and cancellable. | Client retry cannot duplicate mutation. | Resume using cursor/request key or query authoritative result. | P: client memory and retry budgets are documented. | Surface; Run |
| FR-SDK-4 | The SDK shall publish deprecation and compatibility metadata before removing or changing a public contract. | Compatibility tests cover supported version range and migration path. | Breaking use returns actionable typed incompatibility. | Pin supported version or migrate via published successor contract. | C/M: no silent breakage. | Surface; Configuration Revision |

### 2.16 Extension API

| ID | Statement | Acceptance | Failure | Recovery | Expectation | Domain trace |
|---|---|---|---|---|---|---|
| FR-EXT-1 | The Extension API shall define one versioned manifest and Capability Definition grammar for all Extension Installation kinds. | Schema validates plugin, integration, dashboard, exporter, and adapter manifests. | Unknown fields/capabilities follow explicit reject policy. | Target a supported grammar version. | C: grammar evolution has migration rules. | Extension Installation; Capability Definition |
| FR-EXT-2 | The Extension API shall expose only declared host services and shall deny filesystem, network, process, secret, model, and identity access unless granted. | Isolation tests attempt every undeclared access class. | Denied access cannot be bypassed by alternate entry point. | Request explicit capability and stronger review/isolation. | S: default deny and complete mediation. | Extension Installation; Capability Grant; Security Boundary; DM-I15-17 |
| FR-EXT-3 | The Extension API shall require compatibility negotiation before install, enable, and upgrade. | Host and extension ranges produce deterministic compatible/incompatible result. | Incompatible extension remains staged or predecessor remains active. | Install a compatible version or upgrade host through operator process. | C/M: no forced auto-update. | Extension Installation; DM-I23 |
| FR-EXT-4 | The Extension API shall provide bounded health, shutdown, checkpoint, and error contracts without granting domain authority. | Fault tests verify timeout and malformed health behavior. | Unhealthy extension is isolated and cannot report authoritative Platform state. | Disable/restart/replace extension according to policy. | O: health is a projection, not authority. | Extension Installation; DM-I22, DM-I24 |

### 2.17 Administration

| ID | Statement | Acceptance | Failure | Recovery | Expectation | Domain trace |
|---|---|---|---|---|---|---|
| FR-ADM-1 | The Platform shall let an authorized operator create, activate, suspend, and archive Operator Profiles without modifying Workspace OS Identity. | Lifecycle tests verify one active profile per Identity/deployment and immutable Identity reference. | Duplicate active profile is rejected. | Suspend/archive predecessor or select existing profile. | S: profile operations require human authority. | Operator Profile; DM-I01, DM-I04 |
| FR-ADM-2 | The Platform shall let authorized administrators grant, deny, revoke, and inspect Capability Grants with least-privilege scope and expiry. | Every mutation records actor, reason, subject, action, scope, time, and predecessor. | Privilege escalation outside administrator grant is denied. | Obtain explicit higher-authority approval or narrow request. | S/O: complete grant history is queryable. | Capability Grant; DM-I16-18 |
| FR-ADM-3 | Administrative commands shall create successor Configuration Revisions rather than edit Effective Configuration directly. | Change preview shows diff and validation before activation. | Invalid revision cannot become active. | Correct draft or reactivate validated predecessor by successor pointer. | O: rollback is one explicit revision activation. | Configuration Revision; DM-I20 |
| FR-ADM-4 | The Platform shall require explicit human approval for irreversible authority, identity, credential issuance, evidence deletion, and external publication actions. | Policy tests distinguish pre-authorizable reversible actions from mandatory human actions. | AI or service approval is insufficient. | Wait for specific auditable human authorization; independent work may continue. | S: Article VIII/XI is enforced. | Operator Profile; Capability Grant; DM-I04, DM-I28 |

### 2.18 Configuration

| ID | Statement | Acceptance | Failure | Recovery | Expectation | Domain trace |
|---|---|---|---|---|---|---|
| FR-CFG-1 | The Platform shall store configuration only as validated immutable Configuration Revisions with explicit scope. | Schema, semantic, reference, and authority validation precede activation. | Invalid revision remains draft. | Create corrected successor draft. | C: schema version and migration path are declared. | Configuration Revision |
| FR-CFG-2 | The Platform shall resolve Effective Configuration with one documented precedence order and include provenance for every value. | Fixed revisions and overrides yield deterministic value/provenance results. | Equal-precedence conflict is rejected, not guessed. | Remove conflict or create explicit higher-scope revision. | O: secret values remain references. | Configuration Revision; Effective Configuration; DM-I20 |
| FR-CFG-3 | The Platform shall never allow direct mutation of Effective Configuration or projection caches. | All mutation interfaces require a Configuration Revision command. | Direct write is denied and recorded. | Rebuild projection and submit a valid revision. | S: projection cannot become authority. | Effective Configuration; DM-I03, DM-I20 |
| FR-CFG-4 | The Platform shall support rollback by activating a validated predecessor through a new successor decision while retaining full history. | Rollback reproduces predecessor semantics and records reason/actor. | Unavailable/incompatible predecessor blocks activation. | Migrate or create a corrected successor. | M/O: no history deletion or silent pointer change. | Configuration Revision; DM-I07 |

### 2.19 Deployment

| ID | Statement | Acceptance | Failure | Recovery | Expectation | Domain trace |
|---|---|---|---|---|---|---|
| FR-DEP-1 | The Platform shall provide a canonical local Deployment Profile whose authoritative Workspace operations require no network service. | Offline clean-machine acceptance covers init, validate, run, inspect, recover, and export. | Absent network cannot prevent local authoritative operations. | Continue locally and reconcile optional services later. | P/C: local startup and core queries have budgets. | Deployment Profile; DM-I29 |
| FR-DEP-2 | The Platform may provide opt-in networked Deployment Profiles only when they preserve the same Domain, requirements, authorization, and evidence contracts. | Cross-profile contract suite returns equivalent semantic outcomes. | Profile-specific hidden entity or authority fails validation. | Remove divergence or treat it as a new reviewed product contract. | C: local remains canonical reference. | Deployment Profile; DM-I30, DM-I32 |
| FR-DEP-3 | Every Deployment Profile shall keep canonical state under operator control and document backup, restore, upgrade, observability, and failure ownership. | Readiness check resolves every authority and recovery path. | Cloud-owned or inaccessible canonical state is rejected. | Move authority to operator-controlled store or disable profile. | S/O: credentials remain operator-authorized. | Deployment Profile; DM-I06, DM-I30 |
| FR-DEP-4 | The v1 Platform shall operate as one operator-controlled deployment boundary and shall not expose multi-tenant SaaS organization semantics. | Schema/API review finds no Organization/Tenant authority entity or cross-customer routing. | Attempted shared-tenant configuration is rejected. | Use separate deployments/Workspaces or open a future architecture cycle. | S: Workspace-scoped isolation remains explicit. | Deployment Profile; DM-I31 |

### 2.20 Recovery

| ID | Statement | Acceptance | Failure | Recovery | Expectation | Domain trace |
|---|---|---|---|---|---|---|
| FR-REC-1 | The Platform shall create verified Checkpoint Artifacts at declared synchronization points without changing Run state solely because a checkpoint exists. | Checkpoint includes Run/spec versions, integrity, provenance, compatibility, and resume cursor. | Incomplete checkpoint is not eligible for recovery. | Use earlier verified checkpoint or restart according to policy. | O: checkpoint creation is bounded and observable. | Checkpoint Artifact; Run; DM-I12 |
| FR-REC-2 | After interruption the Platform shall reconstruct evidence, select the newest compatible verified checkpoint, and transition `interrupted -> recovering -> running` or `failed`. | Crash tests cover each boundary and never create two active continuations. | Ambiguous ownership or corrupt evidence prevents resume. | Acquire recovery lease, repair/restore evidence, or fail with unresolved finding. | S/O: recovery actions are attributed. | Run; Mission Record; DM-I11-13 |
| FR-REC-3 | The Platform shall create, verify, restore, and supersede Snapshot Artifacts without making a Snapshot the Workspace authority. | Restore into an empty location verifies integrity before activation and preserves source. | Failed verification leaves destination inactive. | Retry transfer or restore earlier valid Snapshot. | M/O: restore is resumable and reports progress. | Snapshot Artifact; Workspace; DM-I06 |
| FR-REC-4 | The Platform shall preserve an explicit unresolved recovery obligation when automatic recovery cannot prove a safe outcome. | Mission State and Mission Record identify missing evidence, impact, attempted actions, owner, and next safe action. | System never reports succeeded/completed from inference. | Human or authorized process supplies evidence and resumes recovery. | S: reality wins; no guessed state. | Mission Record; DM-I13, DM-I28 |

### 2.21 Observability

| ID | Statement | Acceptance | Failure | Recovery | Expectation | Domain trace |
|---|---|---|---|---|---|---|
| FR-OBS-1 | The Platform shall query Run state, transitions, evidence, subjects, capabilities, models, extensions, and artifacts through stable domain queries. | A Run timeline is reconstructable from Mission Record and referenced Event Records. | Missing evidence is shown as a gap, not synthesized. | Repair projection or invoke recovery inspection. | P: local recent-run query p95 budget is defined by NFR. | Mission Record; Event Record |
| FR-OBS-2 | The Platform shall produce an Audit View as a rebuildable actor- and security-focused projection. | Rebuild from grants, identity references, Mission Records, and Event Records yields equivalent entries. | Projection loss does not erase evidence. | Discard/rebuild and report unreconstructable gaps. | S: secret and sensitive fields are redacted. | Audit View; DM-I03, DM-I04 |
| FR-OBS-3 | The Platform shall expose Catalog drift, projection freshness, exporter health, recovery status, and unresolved evidence gaps. | Health query distinguishes authoritative failure from projection/export degradation. | A green projection cannot mask an unresolved Mission Record. | Rebuild projection or resolve source evidence. | O: every status names deciding source. | Catalog; Telemetry; Mission Record; DM-I08 |
| FR-OBS-4 | The Platform shall correlate commands, Runs, Events, extension calls, model selections, and external requests without using operator identity as a correlation key. | Trace from request key to Run and evidence is complete across supported profiles. | Missing correlation creates an explicit observability finding. | Reconcile from authoritative identities or preserve the gap. | S/P: opaque correlation identifiers avoid identity leakage. | Event Record; DM-I04 |

### 2.22 Security

| ID | Statement | Acceptance | Failure | Recovery | Expectation | Domain trace |
|---|---|---|---|---|---|---|
| FR-SRY-1 | The Platform shall deny every action not allowed by an active matching Capability Grant. | Complete allow/deny matrix covers all subjects, scopes, expiries, revocations, and Surfaces. | Unknown action or subject is denied before side effect. | Obtain explicit narrow authorization. | S: default deny and complete mediation. | Capability Grant; DM-I16-18 |
| FR-SRY-2 | The Platform shall enforce the declared Security Boundary for every enabled Agent Registration and Extension Installation. | Isolation tests cover filesystem, network, process, secret, model, identity, and host-service access. | Boundary setup failure prevents execution. | Strengthen boundary or disable subject. | S: policy cannot be weakened by subject output. | Agent Registration; Extension Installation; DM-I15 |
| FR-SRY-3 | The Platform shall attribute every administrative, capability, external, and evidence-mutating action to an authoritative user, service, or machine identity source. | Audit tests find no anonymous or automation-invented user identity. | Unresolved attribution denies the action. | Configure authoritative identity source or obtain human authorization. | S: Article XI effect test is applied. | Operator Profile; Event Record; DM-I04 |
| FR-SRY-4 | The Platform shall redact secret values and policy-sensitive content from all evidence projections, errors, diagnostics, telemetry, and exports. | Canary scans cover success/failure/retry/recovery paths with zero value disclosure. | Leak detection stops propagation and creates incident obligation. | Rotate/revoke, contain projections, preserve incident evidence. | S: references only. | Secret Reference; DM-I19 |
| FR-SRY-5 | The Platform shall verify extension source identity, content digest, compatibility, manifest, requested capabilities, and isolation before enablement. | Tamper, substitution, downgrade, and excess-capability tests deny enablement. | Unverifiable source remains staged and non-executable. | Use operator-trusted source or verified successor. | S/C: marketplace/auto-update is not implied. | Extension Installation; DM-I15, DM-I23 |

## 3. Cross-cutting non-functional requirements

| ID | Concern | Requirement | Verification |
|---|---|---|---|
| NFR-PERF-1 | Local command/query latency | For local datasets up to 100k Artifacts and 10k Runs, non-streaming read queries shall achieve p95 <= 200 ms and p99 <= 500 ms on the reference hardware profile. | Performance test report with dataset and hardware fingerprint. |
| NFR-PERF-2 | Run control latency | Pause, cancel, grant revocation, and extension disable requests shall be durably acknowledged within 2 s p95, excluding non-interruptible external work that is reported separately. | Fault-injected control-latency suite. |
| NFR-PERF-3 | Resource bounds | Every rebuild, export, import, recovery, and large query operation shall publish bounded-memory or streaming behavior and an operator-visible progress contract. | Peak-memory and progress assertions on reference large dataset. |
| NFR-SEC-1 | Security defaults | Fresh installation shall have no network telemetry, no enabled untrusted extension, no ambient secret access, and default-deny capability policy. | Clean-profile security baseline suite. |
| NFR-SEC-2 | Sensitive-data leakage | Configured canary secret values shall appear zero times in Platform-owned evidence, projections, errors, telemetry, exports, and UI payloads. | Automated canary scan across success/failure/recovery corpus. |
| NFR-REL-1 | Durability | Acknowledged authoritative mutation shall survive process termination and host restart or be reported as uncommitted; no acknowledged mutation may disappear silently. | Crash-point durability matrix. |
| NFR-REL-2 | Recovery objectives | Reference local profile shall declare and test RPO=0 for acknowledged metadata and an RTO target per operation class; optional profiles shall publish their own measured targets. | Recovery benchmark and exception report. |
| NFR-COMP-1 | Contract compatibility | Public API, SDK, Extension API, manifest, Artifact, and configuration contracts shall declare version ranges and fail explicitly outside them. | Version compatibility matrix. |
| NFR-MIG-1 | Migration safety | v0.8.x import and every Platform schema migration shall preserve source, produce a verification report, and activate destination only after PASS. | Golden migration corpus plus rollback verification. |
| NFR-OPS-1 | Operability | Every long-running operation shall expose identity, state, progress, current deciding source, cancellation semantics, and recovery action. | Operational scenario checklist. |
| NFR-OPS-2 | Evidence retention | Retention policy shall distinguish authoritative evidence, Workspace artifacts, projections, telemetry, and temporary memory; deletion shall require the authority appropriate to the class. | Retention-policy enforcement suite. |
| NFR-USE-1 | First recovery usability | An engineer with only canonical docs and local evidence shall identify a failed Run, deciding source, recovery option, and unresolved risk in <= 10 minutes in a timed scenario. | Timed fresh-engineer exercise. |

## 4. Domain entity coverage

| Domain entity | Functional requirement coverage |
|---|---|
| Operator Profile | FR-ADM-1, FR-ADM-4, FR-WE-1 |
| Workspace | FR-WE-1, FR-WE-4, FR-DEP-1 |
| Artifact | FR-WE-2, FR-KN-1, FR-MEM-1 |
| Mission Execution Specification | FR-ME-1, FR-ME-2, FR-INT-3 |
| Run | FR-RT-1 through FR-RT-4, FR-REC-2 |
| Mission Record | FR-ME-3, FR-OBS-1, FR-REC-4 |
| Agent Registration | FR-AR-1 through FR-AR-4 |
| Extension Installation | FR-PL-1 through FR-PL-4, FR-INT-1, FR-EXT-1 |
| Capability Grant | FR-AR-3, FR-ADM-2, FR-SRY-1 |
| Schedule | FR-SCH-1 through FR-SCH-4 |
| Secret Reference | FR-SEC-1 through FR-SEC-4 |
| Model Route | FR-MR-1 through FR-MR-4 |
| Configuration Revision | FR-CFG-1 through FR-CFG-4 |
| Event Record | FR-RT-2, FR-OBS-1, FR-SRY-3 |

## 5. Domain invariant coverage

Every Domain invariant DM-I01 through DM-I32 appears in at least one functional row. Gate D verifies this mechanically. Requirements may cover additional behavior beyond the cited invariant; the Domain remains authoritative for meaning.

| Invariant range | Primary requirement coverage |
|---|---|
| DM-I01-I04 | FR-WE-1, FR-ADM-1, FR-SRY-3, FR-RT-4 |
| DM-I05-I08 | FR-WE-1 through FR-WE-4, FR-CFG-3 |
| DM-I09-I14 | FR-RT-1 through FR-RT-3, FR-ME-1 through FR-ME-3, FR-REC-1/2 |
| DM-I15-I19 | FR-AR-1 through FR-AR-3, FR-PL-1/2, FR-SEC-1/2, FR-SRY-1/2/4 |
| DM-I20-I24 | FR-CFG-1 through FR-CFG-4, FR-MR-1/2, FR-PL-3/4, FR-TEL-2/3 |
| DM-I25-I28 | FR-MEM-1 through FR-MEM-4, FR-KN-1 through FR-KN-4, FR-MR-4 |
| DM-I29-I32 | FR-DEP-1 through FR-DEP-4, FR-CLI-4, FR-TEL-1 |

## 6. Product Vision coverage summary

| Metric | Count |
|---|---:|
| Product Vision capability categories | 22 |
| Categories with dedicated `FR-*` prefix | 22 |
| Functional requirements | 89 |
| Cross-cutting non-functional requirements | 12 |
| Total normative requirements | 101 |
| Domain entities covered | 14/14 |
| Domain invariants covered | 32/32 |

## 7. Explicit resolution of inherited observations

- **M-B1:** `methodology-as-architecture` is treated as positioning, not a functional uniqueness claim. No requirement depends on exclusivity against competitors.
- **M-B2:** local is canonical; distributed/networked profiles are explicit opt-in (FR-DEP-1/2, FR-CLI-4, FR-TEL-1).
- **C-N1:** Domain invariant coverage is explicit in §5.
- **C-N2:** Memory Artifact retention and promotion are explicit in FR-MEM-1 through FR-MEM-4.
- **C-N3:** all 22 categories have dedicated requirement sections and prefixes.
- **C-N4:** eight-artifact Mission enforcement is FR-ME-2.
- **C-N5:** deployment behavior is technology-neutral and local-first in FR-DEP-1 through FR-DEP-4.
- **Historical M-D1:** requirement and entity counts are mechanically derived, not asserted manually.
- **Historical M-D2:** performance budgets define dataset/workload/reference-profile evidence in NFR-PERF-1 through NFR-PERF-3.

## 8. Compatibility and migration boundary

1. v0.8.x remains an unchanged local CLI compatibility input; Platform is a successor product, not a v0.8 module.
2. Import is non-destructive and verification-gated (NFR-MIG-1).
3. No auto-update, marketplace, schema-less configuration, multi-tenant SaaS, or cloud-owned canonical state is required or authorized.
4. Dashboard and telemetry are optional replaceable extensions/projections.
5. Public and extension contracts are versioned and explicitly incompatible outside supported ranges.

## 9. Architecture handoff

Architecture must implement these requirements without:

- adding a Domain entity or lifecycle state;
- assigning durable authority to runtime components, databases, queues, projections, dashboards, telemetry, or AI;
- creating Surface-specific product behavior;
- weakening local-first, human authority, capability grants, attribution, secret-value exclusion, or evidence preservation;
- claiming production readiness before implementation evidence exists.

Architecture must provide a requirement-to-component/interface mapping for every `FR-*` and `NFR-*` ID.

## 10. Gate D entry condition

Gate D must independently verify:

1. Exact mechanical counts.
2. 22/22 category coverage.
3. 14/14 Domain entity coverage.
4. 32/32 Domain invariant coverage.
5. Every functional row has all mandatory columns.
6. No duplicate ID or normative statement.
7. No Domain lifecycle or ownership contradiction.
8. No stale 2026-07-18 count/reference.
9. No implementation technology leakage.
10. Complete cross-reference resolution and current input hashes.

Until Gate D PASS, Architecture may not begin.
