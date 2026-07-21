# OperatorOS Platform - Canonical Architecture

> **Phase:** 4 - Architecture
> **Status:** EDITORIAL SIMPLIFICATIONS AFTER COMPETITIVE DESTRUCTION; ARCHITECTURE REMAINS FROZEN
> **Version:** 1.0-recovery.4
> **Date:** 2026-07-19
> **Supersedes in active chain:** `OPERATOROS-PLATFORM-ARCHITECTURE-FINAL-2026-07-18.md`
> **Rule:** Architecture implements the current Gate-C Domain and Gate-D Requirements. It cannot redefine entity ownership, lifecycle, authority, or product behavior.

## Document contract

**Inputs**

- `OPERATOROS-PLATFORM-DOMAIN-MODEL-2026-07-19.md`
- `OPERATOROS-PLATFORM-DOMAIN-MODEL-GATE-C-2026-07-19.md`
- `OPERATOROS-PLATFORM-FUNCTIONAL-SPEC-2026-07-19.md`
- `OPERATOROS-PLATFORM-FUNCTIONAL-SPEC-GATE-D-2026-07-19.md`
- Product Vision, Research, ADR-001, Dependency Graph, Impact Matrix.

**Outputs**

- Minimal component architecture.
- Command/query/event and extension boundaries.
- Evidence, recovery, deployment, security, configuration, model, and operational contracts.
- Requirement-to-owner mapping and risk register.

**Authorities**

1. Workspace OS and human authority.
2. OperatorOS v0.8 release-line freeze.
3. Current Domain Model.
4. Current Functional Specification.
5. ADR-001 successor-product boundary.

**Consumers**

- Red Team, Consistency Review, Gate E, Architecture Validation, Roadmap, Test Strategy, Stress Review, Production Readiness, Competitive Review, final artifacts.

**Dependencies**

- Current Gate C and Gate D chain only.

**Reverse dependencies**

- Every active artifact from Red Team through Final Report.

---

## 1. Architecture in one sentence

OperatorOS Platform is a local-first, operator-controlled, event-evidenced Mission execution platform in which four replaceable components implement one shared Domain contract while Workspace artifacts and sealed Mission Records remain authoritative.

## 2. Design constraints

| Constraint | Architectural consequence |
|---|---|
| Human final authority | Policy and grants are operator-authored; AI cannot alter policy. |
| Workspace OS is upstream | Platform references Identity/Mission/Knowledge/SubSystem semantics and never rewrites them. |
| v0.8 remains frozen | Platform is a successor product, not a new v0.8 module/Core capability. |
| Runtime owns nothing durable | Processes, queues, caches, indexes, databases, dashboards, and telemetry are replaceable mechanisms/projections. |
| One Authority per Concept | Components receive command responsibility, not Domain ownership. |
| Local-first canonical | The local profile has no required network authority or telemetry. |
| Surfaces are equivalent | CLI, HTTP API, SDK, and optional Dashboard use one command/query contract. |
| Recovery is designed | Every acknowledged mutation has durability/reconstruction evidence. |
| Evidence over inference | Unknown state remains unresolved; no projection invents success. |
| Simplicity default | Four components; one extension model; one authorization primitive; one evidence contract. |

## 3. Component model

The Platform has exactly **four implementation components**. They are not Domain authorities and are not Workspace OS S-numbered Subsystems.

| Component | Single responsibility | Implements | Must not own |
|---|---|---|---|
| Workspace Service | Validate and commit Workspace-scoped entity/artifact mutations and rebuild projections. | Operator Profile, Workspace, Artifact, Agent Registration, Extension Installation, Capability Grant, Schedule, Secret Reference, Model Route, Configuration Revision commands/queries. | Workspace OS Identity/Mission/Knowledge; external secret values; projection truth. |
| Execution Service | Execute Mission Execution Specifications as recoverable Runs and coordinate extension/model calls. | Mission Execution Specification, Run, Mission Record, Checkpoint/Snapshot operations. | Policy, grants, Workspace artifacts outside command contracts, long-term knowledge promotion. |
| Evidence Service | Atomically append Event Records, maintain Mission Record evidence indexes/sealing, verify integrity, and feed rebuildable projections. | Event Record and Mission Record evidence contracts; Audit/Catalog/telemetry feeds. | Business policy, user identity, Artifact content, projection authority. |
| Interface Host | Authenticate/attribute requests and expose shared commands/queries to CLI, HTTP API, SDK, and optional UI extensions. | Surface contracts, request identity, streaming, pagination, idempotency boundary. | Domain-specific alternative behavior, cached authority, grant decisions. |

### 3.1 Why four

- Workspace Service owns mutation coordination for Workspace-scoped records, preventing one component per entity.
- Execution Service isolates long-lived recovery and orchestration from CRUD-style Workspace mutation.
- Evidence Service is separated because atomic evidence acknowledgement, sealing, verification, and reconstruction have different failure semantics from execution.
- Interface Host separates transport concerns and prevents CLI/API/Dashboard behavior drift.

### 3.2 Rejected component splits

| Rejected split | Why rejected |
|---|---|
| Agent Runtime | Agent Registration is a Domain entity; dispatch is Execution Service behavior. A separate runtime duplicates orchestration. |
| Plugin System | Extension Installation and Capability Grant are Workspace Service contracts; invocation is Execution Service behavior. |
| Data Plane | Durable authority belongs to Workspace Artifacts/Mission Records, not a component or storage plane. |
| Control Plane | Configuration, Profile, Route, Grant, Schedule, and Secret Reference are entities with commands; one broad control owner would become a god object. |
| Scheduler Service | Schedule evaluation is an Execution Service adapter and can scale independently without a fifth conceptual component. |
| Dashboard/Telemetry service | Both are replaceable extensions/projections. |
| Memory service | Memory is an Artifact kind governed by Workspace and context-routing rules. |
| Integration service | Integration is an Extension Installation kind. |

### 3.3 Dependency direction

```text
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

Rules:

1. Interface Host never calls storage or adapters directly.
2. Execution Service mutates Workspace-scoped entities only through Workspace Service commands.
3. Workspace Service and Execution Service acknowledge mutations only after Evidence Service confirms the required evidence append or atomic mutation envelope.
4. Evidence Service never invokes domain commands.
5. Projection builders are asynchronous consumers and cannot authorize commands.
6. No component depends on a Surface.

## 4. Canonical Domain-to-component responsibility map

This maps implementation responsibility. Domain authority remains with the records named in the Domain Model.

| Domain entity/value/projection | Command owner | Query owner | Evidence owner |
|---|---|---|---|
| Operator Profile | Workspace Service | Workspace Service | Evidence Service |
| Workspace | Workspace Service | Workspace Service | Evidence Service |
| Artifact | Workspace Service | Workspace Service | Evidence Service |
| Mission Execution Specification | Workspace Service exclusively validates, versions, and activates the specification pointer; Execution Service pins the active version at Run creation | Workspace Service | Evidence Service |
| Run | Execution Service | Execution Service | Evidence Service |
| Mission Record | Execution Service requests open/seal; Evidence Service commits evidence index | Evidence Service | Evidence Service |
| Agent Registration | Workspace Service | Workspace Service | Evidence Service |
| Extension Installation | Workspace Service | Workspace Service | Evidence Service |
| Capability Grant | Workspace Service using operator policy | Workspace Service | Evidence Service |
| Schedule | Workspace Service manages policy; Execution Service evaluates | Workspace Service | Evidence Service |
| Secret Reference | Workspace Service manages reference; Execution adapter resolves at use | Workspace Service | Evidence Service stores reference-only use record |
| Model Route | Workspace Service manages version; Execution Service evaluates | Workspace Service | Evidence Service records route evaluation |
| Configuration Revision | Workspace Service | Workspace Service + projection builder | Evidence Service |
| Event Record | Evidence Service | Evidence Service | Evidence Service |
| Catalog | n/a; rebuild only | Workspace projection builder | Rebuild provenance |
| Audit View | n/a; rebuild only | Evidence projection builder | Rebuild provenance |
| Effective Configuration | New revision only via Workspace Service | Workspace projection builder | Revision/provenance evidence |
| Telemetry | Export policy via Workspace Service | Telemetry extension | Local Event/Mission evidence remains authoritative |
| Surfaces | Interface Host | Interface Host | Request/correlation evidence |

No row gives two components command authority over the same mutation. Composite operations have one coordinator and explicit called commands.

## 5. Command, query, and event contracts

### 5.1 Command envelope

Every mutation accepts:

```text
Command {
  command_id
  request_key
  command_type
  subject_identity_ref
  operator_profile_ref?
  capability_grant_ref?
  workspace_ref
  target_ref?
  expected_version?
  payload_schema_version
  payload
  correlation_id
  causation_id?
  requested_at
}
```

Properties:

- `request_key` provides idempotency.
- `expected_version` provides optimistic conflict detection.
- identity is a reference to an authoritative source, never self-declared user text.
- command type has one handler owner.
- validation and grant resolution occur before side effect.
- success returns authoritative resource identity/version plus evidence reference.

### 5.2 Query envelope

```text
Query {
  query_type
  subject_identity_ref
  workspace_ref
  filter
  cursor?
  limit
  projection_freshness_requirement?
}
```

A query response identifies:

- deciding authoritative source;
- projection source and freshness, if used;
- missing evidence explicitly;
- stable cursor and contract version.

### 5.3 Event Record envelope

```text
EventRecord {
  event_id
  event_type
  schema_version
  recorded_at
  subject_identity_ref
  workspace_ref
  run_ref?
  command_id?
  aggregate_ref
  aggregate_version
  correlation_id
  causation_id?
  payload
  payload_digest
  sensitivity_class
}
```

Rules:

- immutable after record;
- secret values forbidden;
- one schema per event type/version;
- projection consumers tolerate replay;
- event order is defined per aggregate, not assumed globally;
- cross-aggregate order uses correlation/causation, not one global sequence.

### 5.4 Mutation Envelope protocol

Evidence Service owns the implementation-level Mutation Envelope state machine. The envelope is not a Domain entity and owns no business truth; it makes command acknowledgement and reconciliation deterministic.

```text
prepared -> committing -> committed -> acknowledged
    |           |             |
    +-> aborted +-> unresolved +-> acknowledged-on-retry
```

Envelope fields:

```text
MutationEnvelope {
  mutation_id
  command_id
  request_key
  coordinator_component
  aggregate_ref
  expected_version
  intended_record_version
  required_event_ids
  idempotency_result_digest
  state
  prepared_at
  committed_at?
  acknowledged_at?
  reconciliation_evidence?
}
```

Responsibilities:

- Workspace Service or Execution Service is the command coordinator and supplies the intended authoritative mutation.
- Evidence Service prepares the envelope, verifies the expected aggregate version, and coordinates durable record/Event/idempotency commitment.
- `committed` means the authoritative record/version, required Event Records, and idempotency result are durable and mutually referenced.
- `acknowledged` means a response proving the committed identities was delivered or reproduced for the caller.
- A crash during `prepared` or `committing` is reconciled from durable record/Event/idempotency evidence; coordination memory is not trusted.
- If all required durable parts exist, reconciliation marks `committed` and repeated request returns the original result.
- Retrying with a new `request_key` is not a recovery mechanism; changing identity to bypass idempotency is denied and recorded as an attempted bypass.
- If none exist, reconciliation marks `aborted` and the same request may retry.
- If only a non-authoritative copy exists, discard it and reconcile from authority.
- If authoritative mutation exists without complete required evidence, mark `unresolved`, deny conflicting follow-up mutation, and open a recovery/IR obligation. Never synthesize the missing evidence.

Caller-visible outcomes:

| Outcome | Meaning | Safe action |
|---|---|---|
| `committed` | Durable mutation exists; response may have been lost | Repeat same request key to retrieve original result. |
| `uncommitted` | No authoritative mutation exists | Retry same request after correcting transient failure. |
| `conflict` | Expected version or request-key intent differs | Reload authority; issue a new request only for new intent. |
| `evidence-gap` | Authoritative mutation exists but required evidence cannot be proven complete | Stop dependent mutation; execute recovery/incident procedure. |

Architecture does not mandate one storage technology. Any implementation must prove the same outcomes through crash-point tests.

### 5.5 Admission Decision and backpressure

Every resource-consuming operation obtains an Admission Decision before work begins. Admission is policy evaluated from current operator-authored configuration and observed resource evidence; it is not a Domain entity or durable business authority.

Priority classes, highest first:

1. authoritative mutation and required evidence append;
2. Run control, cancellation, sealing, and recovery;
3. normal Run execution and extension/model invocation;
4. projection rebuild and optional backfill;
5. telemetry export and optional analytics.

Rules:

- Evidence-capacity preflight occurs before accepting an authoritative mutation.
- If required authoritative/evidence capacity is unavailable, deny new mutation before acknowledgement; never accept work that cannot be evidenced.
- Existing recovery/cancel/seal work may preempt normal execution.
- Projection and telemetry work is bounded, pausable, and discardable/rebuildable.
- Admission denial returns reason, deciding evidence, retry-after or operator action, and whether existing Runs are affected.
- Memory, concurrency, queue, disk, and external-rate budgets are explicit per Deployment Profile and operation class.
- Backpressure never widens capability scope, bypasses human approval, or turns coordination state into authority.
- Admission priority is fixed: authoritative mutation/evidence > Run control/recovery/sealing > normal Run execution > projection rebuild/backfill > telemetry export. Telemetry priority may never be raised above Run control or authoritative mutation.

## 6. Execution architecture

### 6.1 Run creation

1. Interface Host authenticates/attributes request.
2. Workspace Service resolves active Workspace, Mission Execution Specification, Operator Profile, grants, configuration and route versions.
3. Execution Service constructs a Run creation command.
4. Run identity and open Mission Record are committed in one mutation envelope.
5. Execution begins only after acknowledgement.

### 6.2 Run state machine enforcement

Execution Service is the only Run transition command owner. Every transition:

- validates current version and legal edge;
- verifies authorization/policy;
- persists new state plus Event Record;
- updates Mission Record evidence index;
- emits projection notifications only after acknowledgement.

### 6.3 Checkpoints

A Checkpoint is a Workspace Artifact with:

- Run and specification versions;
- execution cursor and deterministic replay inputs;
- referenced Artifact/Extension/Route versions;
- integrity digest;
- compatibility range;
- created-at and subject evidence.

Checkpoint creation does not change Run state unless a separate legal transition occurs.

### 6.4 Recovery lease

Before automatic continuation, Execution Service acquires a bounded recovery lease for one Run. The lease is coordination state, not durable truth. Safe continuation is decided from authoritative Run/Mission Record/Checkpoint evidence. If lease state is lost, a new contender must re-evaluate evidence and cannot infer prior success.

### 6.5 Scheduling

- Workspace Service owns Schedule policy/version commands.
- Execution Service evaluates armed schedules.
- Each evaluation creates an idempotent trigger identity.
- A Run request is committed before one-shot retirement.
- overlap/missed/backfill/timezone policies are explicit per Schedule.

### 6.6 Agent and extension invocation

Execution Service resolves:

1. pinned Agent Registration or Extension Installation version;
2. active Capability Grant;
3. Security Boundary;
4. required Secret References;
5. Model Route and availability evidence where applicable;
6. timeout/retry/circuit policy;
7. expected input/output schema.

Invocation output remains untrusted until schema/gate validation. Extensions never receive host services outside granted interfaces.

## 7. Evidence and projection architecture

### 7.1 Authoritative evidence

- Workspace Artifact content and content history.
- Run state and sealed Mission Record.
- Immutable Event Records referenced by Mission Records.
- Active version pointers for Platform entities.
- Capability Grant history and identity references.

### 7.2 Rebuildable projections

| Projection | Sources | Rebuild trigger | Failure behavior |
|---|---|---|---|
| Catalog | Workspace artifacts/history | drift, schema change, operator request | direct Artifact reads remain available |
| Audit View | Mission Records, Event Records, grants, identities | corruption, schema change | evidence remains queryable at source |
| Effective Configuration | active revisions + precedence | revision activation | mutation blocked if provenance cannot be resolved |
| Run timeline | Run/Mission Record/Event Records | query or index drift | shows gaps, never guesses |
| Dashboard views | domain queries | reconnect/version change | CLI/API remain available |
| Telemetry | evidence + runtime measurements | exporter replay policy | exporter failure does not alter Run truth |

### 7.3 Sealing

Evidence Service seals a Mission Record only when:

- Run terminal state is durable;
- required start, transition and terminal evidence exists;
- referenced Artifacts resolve or are explicitly marked unavailable with an unresolved finding;
- grant/model/extension/configuration versions are recorded;
- result digest and verification summary exist.

Correction creates a successor Mission Record; sealed evidence is not edited.

## 8. Authorization and identity architecture

### 8.1 Policy authority

Operator-authored Configuration Revisions define policy. Capability Definitions declare actions. Capability Grants authorize concrete subject/action/scope/time tuples. AI/model/extension output cannot create or widen grants.

### 8.2 Enforcement points

Authorization is enforced twice:

1. Interface Host rejects unauthenticated/unattributed requests before command dispatch.
2. Owning command component resolves the current grant and expected entity version immediately before mutation or external action.

The second check is authoritative. Client or Dashboard checks are usability only.

### 8.3 Identity classes

- User identity reference: authority is operator or client context.
- Service identity reference: authority is configured platform/vendor account.
- Machine identity reference: authority is host/runtime.

Platform stores references and attribution evidence, not invented user identities.

### 8.4 Irreversible actions

Mandatory explicit human authorization applies to:

- user/service/machine credential issuance;
- authority/identity changes;
- irreversible evidence deletion;
- public external publication/representation;
- grant widening beyond pre-authorized policy;
- migration activation that makes the source unavailable.

## 9. Secret and sensitive-data architecture

### 9.1 Secret adapter contract

```text
resolve(secret_ref, subject, capability_grant, run?, purpose) -> leased_value_handle
```

- raw value is delivered only to the isolated invocation boundary;
- value handle is not serializable to Platform evidence;
- resolution produces redacted Event Record;
- backend fallback must be operator-configured and cannot downgrade to plaintext;
- expiry/revocation is checked at point of use.

### 9.2 Data classification

Every command/event/artifact field declares one class:

- public;
- workspace-internal;
- sensitive;
- secret-reference;
- prohibited-secret-value.

Projection/export policies are schema-driven. Unclassifiable fields are denied from external export.

## 10. Extension architecture

### 10.1 One extension contract

All kinds use one manifest:

```text
ExtensionManifest {
  extension_id
  kind
  version
  host_compatibility
  entry_points
  capability_definitions
  requested_capabilities
  security_boundary
  data_classes
  health_contract
  shutdown_contract
  checkpoint_contract?
  migration_contract?
  uninstall_contract
  source_identity
  content_digest
}
```

Kinds: `plugin`, `integration`, `dashboard`, `telemetry-exporter`, `adapter`.

### 10.2 Isolation tiers

Architecture defines contract tiers, not one technology:

| Tier | Intended subject | Minimum boundary |
|---|---|---|
| T0 built-in | Platform-owned deterministic adapter | In-process contract, no undeclared service access |
| T1 operator-trusted | Local reviewed extension | Restricted process/service interfaces, explicit filesystem/network grants |
| T2 third-party | External extension | Strong process/container/sandbox boundary, deny-by-default host services |
| T3 remote | External service adapter | Network protocol boundary, scoped credential, rate/circuit policy |

A stronger risk class cannot run in a weaker tier without explicit reviewed policy.

### 10.3 Lifecycle operations

- install stages and validates before executable registration;
- enable resolves grants/boundary;
- disable prevents new invocations;
- upgrade installs successor, migrates, verifies, switches pointer;
- uninstall disables and revokes the active registration; removes executable material where present; revokes local routes, cached handles, and scoped credentials for remote kinds; verifies kind-specific removal; preserves evidence.

For a remote T3 adapter, uninstall verification means no local registration, active grant, credential binding, route, or executable bridge remains. It does not claim to delete the external service.

No registry/marketplace or automatic update is implied.

## 11. Configuration and model routing

### 11.1 Configuration precedence

One deterministic order, from lowest to highest:

1. Deployment Profile defaults.
2. Workspace Configuration Revision.
3. Mission Execution Specification overrides.
4. Run-scoped operator-authorized overrides.

Conflicts at the same scope are invalid. Effective Configuration returns value provenance. Secret values are never configuration values; only Secret References are.

### 11.2 Model route evaluation

```text
select(route_version, request_requirements, configured_endpoints, availability_evidence)
  -> endpoint_ref + evaluation_trace
```

- route is immutable by version;
- required capability/data boundary filters precede cost/latency preference;
- fallback follows declared finite order;
- availability evidence and chosen endpoint are recorded;
- model output cannot alter route or availability evidence;
- no eligible endpoint produces route exhaustion, not an undeclared fallback.

## 12. Deployment profiles

Profiles change mechanisms, not Domain contracts.

| Profile | Canonical state | Required network | Intended use | Constraints |
|---|---|---:|---|---|
| Local | Operator-controlled Workspace and local evidence store | No | Canonical individual-operator profile | All authoritative core behavior works offline; telemetry off. |
| Operator-hosted | Operator-controlled Workspace plus operator-hosted durable services | Yes for remote clients/adapters | Small team / always-on host | One deployment authority boundary; explicit backup/restore. |
| Distributed operator-controlled | Operator-controlled replicated durable store and workers | Yes | Scale/availability experiments | Explicit opt-in; same Domain; consistency/recovery semantics validated before release. |

Excluded:

- cloud-owned canonical Workspace truth;
- multi-tenant SaaS organizations;
- hidden remote dependency in Local profile;
- profile-specific Domain entities;
- automatic upgrades.

### 12.1 Storage abstraction

Architecture requires capabilities, not products:

- atomic versioned entity mutation;
- append-only Event Record persistence;
- Artifact content/history integration;
- compare-and-set active pointers;
- integrity verification;
- snapshot/export/import;
- local implementation with no network;
- optional operator-controlled replicated implementation.

Technology selection belongs to implementation planning/spikes and cannot change observable contracts.

### 12.2 Coordination abstraction

Coordination may use local locks, leases, queues, or distributed consensus mechanisms, but:

- coordination state never decides business truth;
- every message/request has idempotent identity;
- loss/replay is reconciled from authoritative records;
- Run continuation has one bounded recovery lease;
- projection/export queues are lossy only according to explicit non-authoritative policy.

## 13. Surface architecture

### 13.1 Shared contract

All Surfaces expose generated or schema-equivalent:

- command types;
- query types;
- event/result/error schemas;
- authorization behavior;
- idempotency and optimistic concurrency;
- pagination/streaming/cancellation;
- compatibility metadata.

### 13.2 CLI

- first-class canonical local interface;
- human and deterministic JSON modes;
- no mixed progress/data stream;
- all local authority operations available offline.

### 13.3 HTTP API

- optional in Local, required for remote clients in networked profiles;
- same commands/queries;
- explicit authentication/attribution;
- no browser/session-only authority.

### 13.4 SDK

- typed convenience binding, generated or validated from public contract;
- propagates identity/grant/request/correlation explicitly;
- no SDK-only entity or mutation.

### 13.5 Dashboard

- optional extension kind;
- uses API/SDK contracts;
- no Dashboard-owned workflow/configuration/evidence state;
- removable without loss of capability.

## 14. Knowledge and memory architecture

### 14.1 Memory

Memory Artifact is stored through Workspace Service and loaded by a context-routing query that enforces:

- Workspace/Mission/subject scope;
- sensitivity and Capability Grant;
- retention/expiry;
- minimum sufficient context;
- provenance.

Runtime caches may accelerate loading but are discardable.

### 14.2 Knowledge emission

Execution Service may request Knowledge Article candidates after evidence gates:

- ADR: accepted architecture decision with context/rationale/alternatives/status.
- IR: escaped runtime/security/recovery/durability contract failure.
- LL: repeated validated pattern across at least two independent Missions.

Workspace Service stores Artifact candidates. Human/Workspace OS governance decides promotion. No model auto-promotes. Failed incident patterns cannot be promoted into Knowledge without an explicit IR or LL candidate meeting the evidence/pattern governance; aggregation by AI without governed promotion is denied.

## 15. End-to-end execution flow

| Stage | Owner | Inputs | Outputs | Completion criterion |
|---:|---|---|---|---|
| 0 Request intake | Interface Host | command envelope | validated attributed request | identity/request schema valid |
| 1 Authority resolution | Workspace Service | request, profile, grants, config | pinned authority snapshot | current references/grants valid |
| 2 Run creation | Execution + Evidence | Mission/spec snapshot | Run + open Mission Record | atomic acknowledgement |
| 3 Input/context resolution | Execution + Workspace | Artifact/Memory/Secret refs | validated bounded execution input | all hard dependencies resolved |
| 4 Plan/dispatch | Execution | execution input, registrations/extensions | bounded execution plan | actions map to grants/contracts |
| 5 Execute | Execution + extensions/models | plan | candidate outputs + evidence | invocation outcomes recorded |
| 6 Validate | Execution gates | candidate outputs | accepted/rejected result | schema/acceptance/security gates pass |
| 7 Checkpoint | Execution + Workspace + Evidence | Run cursor/evidence | Checkpoint Artifact | integrity verified |
| 8 Commit outputs | Workspace + Evidence | accepted outputs | active/superseding Artifacts | mutation/evidence acknowledged |
| 9 Operator checkpoint | Interface Host + human policy | current Run/evidence | approval/continue/cancel decision | required policy satisfied |
| 10 Seal | Execution + Evidence | terminal outcome/evidence | sealed Mission Record | sealing criteria complete |
| 11 Knowledge candidate | Workspace Service | sealed evidence/patterns | optional ADR/IR/LL draft | governance metadata valid |

The flow is a default lifecycle, not a new Domain state machine. A Mission Execution Specification may omit stages that are not relevant, but cannot bypass authority, grant, evidence, validation, or sealing contracts.

## 16. Quality gates inside a Run

| Gate | Before | Automatic checks | Human condition | Failure |
|---|---|---|---|---|
| Q1 Authority | Run create | references, grants, config, specification versions | required when policy cannot pre-authorize | deny creation |
| Q2 Input | Execute | schema, scope, sensitivity, dependency resolution | optional for exceptional missing input | pause/fail |
| Q3 Capability | Every action | subject/action/scope/time/boundary | explicit grant for new scope | deny action |
| Q4 Output | Commit | schema, acceptance, provenance, secret scan | only irreducible judgment | revise/fail |
| Q5 Checkpoint | Resume/commit | integrity, compatibility, cursor completeness | none | use earlier checkpoint |
| Q6 Publication | External representation | destination, identity, approval, compliance | mandatory where irreversible/public | stop publication |
| Q7 Seal | Mission Record seal | terminal evidence completeness | unresolved gaps require decision | remain unsealed |
| Q8 Knowledge | Knowledge promotion | evidence/pattern/governance | human authority | remain temporary |

Each gate writes or references Event Record evidence. These product runtime gates are distinct from lifecycle Gates C-K.

## 17. Failure and recovery model

| Failure class | Detection | Safe behavior | Recovery |
|---|---|---|---|
| Process/host loss | heartbeat/lease + evidence inspection | no inferred success | reconstruct, acquire lease, resume compatible checkpoint |
| Partial mutation | idempotency/expected version/evidence mismatch | report uncommitted or unresolved | deterministic reconciliation |
| Artifact corruption | digest/schema/history validation | do not activate | restore predecessor/Snapshot, create IR |
| Extension crash | bounded invocation/health | isolate dependent action | retry/circuit/disable/replace |
| Secret backend outage | point-of-use resolution | no insecure fallback | bounded retry/fallback/pause |
| Model endpoint outage | availability evidence | declared fallback only | fallback or route exhaustion |
| Projection corruption | source-vs-projection check | direct source query | discard/rebuild |
| Recovery via projection | forbidden | recovery reads authoritative record/Event/Checkpoint evidence; projections and coordination memory cannot decide truth | n/a |
| Network partition | coordination failure + version conflict | preserve local authority; stop unsafe cross-boundary writes | reconcile from authoritative versions |
| Disk/full resource | write preflight and failed acknowledgement | no false acknowledgement | free/expand/restore, retry idempotently |
| Configuration corruption | revision validation | keep predecessor active | activate validated successor |
| Operator error | preview/expected version/approval | reject conflicts | create corrective successor |
| Security boundary failure | launch/access enforcement | do not execute subject | strengthen isolation/disable/incident |

## 18. Scalability model

- Unit of concurrency: Run.
- Unit of partitioning: Workspace, then Run.
- Unit of recovery: Run aggregate and Mission Record.
- Unit of extension scale: isolated invocation, not more Domain entities.
- Unit of evidence ordering: aggregate version.
- Unit of horizontal worker coordination: idempotent command/invocation identity.
- Projections scale independently because they own no truth.
- Backpressure policies prioritize authoritative mutation/evidence over telemetry and optional projection updates.

Reference design targets for validation, not promises:

- 100k Artifacts and 10k historical Runs per Workspace for local query budgets.
- thousands of enabled Agent/Extension registrations without loading all into every Run.
- bounded context and paginated queries.
- per-profile documented concurrency/admission budgets chosen during implementation validation.

## 19. Requirement allocation matrix

Every functional prefix has one primary architecture owner and validation surface.

| Prefix | Primary owner | Supporting component/extension | Primary validation |
|---|---|---|---|
| FR-RT | Execution Service | Evidence Service | state/restart/idempotency tests |
| FR-WE | Workspace Service | projection builders | Artifact/import/rebuild tests |
| FR-ME | Workspace + Execution | Evidence Service | specification/Mission State/sealing tests |
| FR-KN | Workspace Service | governance workflow | knowledge lifecycle tests |
| FR-AR | Workspace + Execution | isolation adapter | registration/grant/dispatch tests |
| FR-PL | Workspace + Execution | extension host | install/upgrade/uninstall tests |
| FR-CLI | Interface Host | command/query contracts | surface parity/offline tests |
| FR-DSH | Dashboard extension | Interface Host | replaceability/parity/security tests |
| FR-SEC | Execution secret adapter | Workspace grant service | leak/resolution/rotation/outage tests |
| FR-SCH | Workspace + Execution | scheduler adapter | trigger/idempotency/time tests |
| FR-TEL | telemetry extension | Evidence Service | opt-in/loss/redaction tests |
| FR-MEM | Workspace Service | context router | scope/retention/promotion tests |
| FR-INT | extension host | external adapters | failure/credential/dependency tests |
| FR-MR | Workspace + Execution | model adapters | deterministic route/fallback tests |
| FR-SDK | SDK binding | Interface Host | contract parity/compatibility tests |
| FR-EXT | extension host | Workspace grants | manifest/isolation/lifecycle tests |
| FR-ADM | Workspace Service | Interface Host | profile/grant/human authority tests |
| FR-CFG | Workspace Service | configuration projection | precedence/revision/rollback tests |
| FR-DEP | deployment packaging | all components | profile equivalence/offline tests |
| FR-REC | Execution + Evidence | Workspace Service | crash/restore/unresolved tests |
| FR-OBS | Evidence Service | projections/Interface Host | reconstruction/freshness/correlation tests |
| FR-SRY | all enforcement points | isolation/secret adapters | default-deny/attribution/leak tests |
| NFR-* | Architecture validation owner | Test Strategy | measurable release evidence |

Detailed 101-ID allocation is a Phase 6/7 artifact obligation; no requirement prefix or normative ID is orphaned.

## 20. Architecture risks

| ID | Assumption / risk | Failure mode | Validation evidence | Destination |
|---|---|---|---|---|
| AR-R01 | Mutation Envelope protocol can be implemented crash-consistently | committed record without evidence or irreconcilable partial envelope | crash-point matrix across every envelope state and coordinator | Phase 5/7 |
| AR-R02 | Evidence Service separation does not create a bottleneck | latency/availability limits all mutation | throughput/partition benchmark | Phase 5/8 |
| AR-R03 | Four components are minimal and coherent | hidden fifth responsibility or god component | Red Team responsibility deletion/merge tests | Red Team |
| AR-R04 | One extension model covers all kinds | dashboard/exporter/integration need incompatible lifecycle | manifest/lifecycle comparison | Red Team/Phase 8 |
| AR-R05 | Domain state can be technology-neutral across profiles | local and distributed semantics diverge | cross-profile conformance suite | Phase 5/7 |
| AR-R06 | Operator-controlled distributed state is operable | backup/restore/partition complexity exceeds user value | operational pilot and chaos evidence | Phase 8/9 |
| AR-R07 | Aggregate-version ordering is enough | cross-aggregate causality cannot be reconstructed | concurrent scenario replay | Phase 5/7 |
| AR-R08 | Recovery lease prevents duplicate continuation | partitions produce two active executors | split-brain chaos test | Phase 8 |
| AR-R09 | Checkpoints are portable across compatible versions | upgrade makes recovery impossible | versioned checkpoint migration corpus | Phase 7/8 |
| AR-R10 | Projections remain rebuildable at target scale | rebuild too slow or source lacks fields | delete/rebuild benchmark and equivalence | Phase 7/8 |
| AR-R11 | Capability grants remain understandable | grant explosion/hidden transitive rights | grant graph audit/usability test | Phase 5/9 |
| AR-R12 | Secret leakage can be structurally prevented | third-party output/errors leak values | canary/adversarial extension suite | Phase 7/8 |
| AR-R13 | Route reproducibility survives changing availability | same request selects differently without adequate evidence | availability replay suite | Phase 7/8 |
| AR-R14 | Context memory stays bounded and private | cross-Workspace leak/context explosion | routing/privacy/load tests | Phase 7/8 |
| AR-R15 | Human checkpoints are not bypassed or overused | unsafe automation or operational friction | policy matrix and timed scenarios | Phase 8/9 |
| AR-R16 | v0.8 import preserves evidence and intent | migration loss or semantic mismatch | representative golden corpus | Phase 7/9 |
| AR-R17 | Interface parity remains enforceable | CLI/API/SDK/UI semantic drift | generated/schema contract parity | Phase 7 |
| AR-R18 | Knowledge candidate generation does not flood Workspace | incident/pattern noise overwhelms S6 | dedup/throttle/governance metrics | Phase 8/9 |
| AR-R19 | 100k Artifact/10k Run local target is realistic | latency/memory budgets fail | reference hardware benchmark | Phase 7/9 |
| AR-R20 | Evidence retention remains affordable | authoritative history grows without bound | retention/legal/restore study | Phase 8/9 |

Risks are unresolved assumptions. `mitigated by design` is not accepted as validation evidence.

## 21. Architecture decision trace

| Decision | Source | Architecture expression |
|---|---|---|
| Platform is successor boundary | ADR-001 | v0.8 unchanged; separate components/contracts |
| Runtime owns nothing durable | CI-07, Domain | Workspace/Mission evidence authority; projections rebuildable |
| One extension model | Domain consolidation | Extension manifest + kinds + one lifecycle |
| One authorization primitive | Domain Capability Grant | all Surfaces/actions resolve active grant |
| Local canonical | Vision, Domain DM-I29 | Local profile works offline; telemetry off |
| Distributed optional | Vision, ADR, DM-I30 | operator-controlled profile only |
| Dashboard/Telemetry not authority | Vision, Domain | optional extensions/projections |
| AI never authority | Constitution/Domain | policy/config/grants operator-authored |
| Evidence-first recovery | Domain/FR | Event/Mission/Checkpoint contracts and unresolved state |
| No multi-tenant SaaS | Vision/Domain | one deployment boundary; no Tenant/Org entity |
| Crash-consistent acknowledgement | RT-R1, FR-RT/WE/REL | Evidence-owned Mutation Envelope protocol |
| One specification activation owner | RT-R2, Domain authority | Workspace Service activates; Execution only pins |
| Evidence-first admission | RT-R3, NFR resource bounds | five priority classes; unsafe acceptance denied |

## 22. Re-entry and change policy

Before Gate E, this candidate may be fully regenerated in response to Red Team or Consistency findings.

After Gate E PASS:

- editorial correction with no semantic change: update and re-run Consistency/Gate E hash binding;
- component/interface/risk semantic change: regenerate Architecture and all downstream artifacts;
- Domain entity/lifecycle/ownership change: return to Phase 2.5;
- functional behavior change: return to Phase 3;
- frozen Platform decision change: record a successor ADR.

## 23. Red Team integration record

The full Architecture was regenerated after the 2026-07-19 Red Team candidate review:

- **RT-R1 integrated:** §5.4 now defines Evidence-owned Mutation Envelope states, fields, coordinator roles, reconciliation, and caller-visible outcomes.
- **RT-R2 integrated:** §4 makes Workspace Service the sole Mission Execution Specification activation owner; Execution Service only pins the active version.
- **RT-R3 integrated:** §5.5 defines admission/backpressure priorities and evidence-capacity denial; §10.3 defines kind-specific remote uninstall verification.

No Domain or Functional Specification contract changed. Per the Impact Matrix, only Phase 4 candidate hash and its Red Team/Consistency/Gate E closure were invalidated.

## 24. Architectural review integration record

| Review | Source | Refinements integrated |
|---|---|---|
| Red Team | 2026-07-19 | RT-R1 Mutation Envelope protocol; RT-R2 single specification activation owner; RT-R3 admission/backpressure and remote uninstall semantics. |
| Stress Review | 2026-07-19 | ST-1 forbids recovery via projection; ST-5 fixes admission priority; ST-10 forbids AI aggregation of failed incidents into Knowledge without explicit IR/LL. |

None of these refinements change Domain or Functional Specification contracts, change the risk register, or alter component boundaries.

## 25. Freeze-readiness entry condition

The Architecture cannot pass Gate E until:

1. Red Team attacks mental model, minimality, authority, coupling, local-first, extension, deployment, and failure semantics.
2. Consistency Review checks terminology, ownership, cycles, lifecycle, requirement trace, and stale references.
3. Every blocking finding is integrated by full Architecture regeneration.
4. Current hashes and all 101 normative requirement IDs are validated.
5. No downstream artifact exists yet claiming this candidate is frozen.
