# OperatorOS Platform - Canonical Domain Model

> **Phase:** 2.5 - Domain Model
> **Status:** CANDIDATE FOR GATE C
> **Version:** 1.0-recovery.1
> **Date:** 2026-07-19
> **Supersedes in active chain:** `OPERATOROS-PLATFORM-DOMAIN-MODEL-2026-07-18.md`
> **Scope:** Platform domain concepts only. No APIs, storage engines, deployment topology, frameworks, or production code.

## Document contract

**Inputs**

- `OPERATOROS-PLATFORM-RESEARCH-2026-07-18.md`
- `OPERATOROS-PLATFORM-PRODUCT-VISION-2026-07-18.md`
- `OPERATOROS-PLATFORM-PRODUCT-VISION-GATE-B-2026-07-18.md`
- `OPERATOROS-PLATFORM-MISSION-RECOVERY-AUDIT-2026-07-19.md`
- `.project-state/operatoros-platform-autonomous-recovery-completion-2026-07-19/decisions.md` (ADR-001)

**Outputs**

- Canonical Platform entity set.
- Canonical lifecycles, cardinalities, invariants, authority boundaries, and projection rules.
- Gate C input contract.

**Authorities**

1. Workspace OS Constitution and Specification.
2. Workspace OS Authority Model and `system-graph.md`.
3. OperatorOS v0.8 freeze for the unchanged v0.8 release line.
4. ADR-001 for the separate OperatorOS Platform successor boundary.
5. Product Vision for user/problem/capability scope.

**Consumers**

- Gate C.
- Functional Specification and Gate D.
- Architecture and all downstream planning, testing, review, and reporting artifacts.

**Dependencies**

- Research, Product Vision, ADR-001, immutable Workspace OS and OperatorOS v0.8 authorities.

**Reverse dependencies**

- Every active artifact from Gate C through the Final Report.

---

## 1. Domain in one sentence

OperatorOS Platform executes an operator-authorized Workspace OS Mission as a durable Run inside a Workspace, records verifiable evidence as Workspace-owned artifacts, and exposes replaceable projections without becoming an authority over Identity, Knowledge, policy, or the Workspace itself.

## 2. Authority hierarchy

| Rank | Authority | Owns | Platform relationship |
|---:|---|---|---|
| 1 | Human operator | Approval, credentials, irreversible authority changes | Platform executes only explicit or policy-pre-authorized actions and records attribution. |
| 2 | Workspace OS | Identity, Principle, Authority, Knowledge, Mission, Subsystem, Specialization, constitutional lifecycle | Platform references these primitives and never redefines or writes them. |
| 3 | OperatorOS v0.8 freeze | v0.8 Core, module, ships-set, terminology, Local-First release-line contract | Platform treats v0.8.x as a compatibility input. Platform is not a v0.8 module or silent Core amendment. |
| 4 | Platform Domain Model | Platform-specific runtime entities and relationships | Functional requirements and Architecture must conform to this document. |
| 5 | Functional Specification | Observable product behavior | Cannot create a new entity or lifecycle not defined here. |
| 6 | Architecture | Components and interfaces implementing the Domain and Requirements | Cannot change Domain ownership or lifecycle silently. |
| 7 | Runtime projections | Catalog, Audit View, Dashboard, Telemetry, Effective Configuration | Derived and replaceable; never durable authority. |

### 2.1 Authority test

For any state question, exactly one source decides the answer:

- Who is the operator? Workspace OS Identity.
- What work was authorized? The Workspace OS Mission plus the active Mission Execution Specification.
- What is the current Workspace content? Workspace files and their content history.
- What happened during a Run? The sealed Mission Record and its referenced evidence artifacts.
- What may a subject do? The active Capability Grant.
- What does a dashboard, catalog, event stream, metric, or index show? A projection that must be reproducible from authoritative records.

## 3. Workspace OS boundary

### 3.1 Read-only primitive mapping

| Workspace OS primitive | Platform use | Forbidden Platform behavior |
|---|---|---|
| Identity | Resolve the operator reference used by Operator Profile and attribution | Create, rewrite, infer, or clone Identity. |
| Principle | Constrain Platform behavior and validation | Add a Platform principle that masquerades as constitutional. |
| Authority | Enforce one source per question | Declare a projection or AI output authoritative. |
| Knowledge | Link ADR, IR, and LL artifacts and promotion evidence | Redefine Knowledge taxonomy or auto-promote observations to governance. |
| Mission | Supply authored intent and the eight-artifact mission discipline | Replace Mission intent with runtime state or a workflow graph. |
| Subsystem | Classify operator work under S1-S6 | Introduce Platform components as new S-numbered Subsystems. |
| Specialization | Route context from the operator's Identity | Write or infer the operator's specialization set. |

### 3.2 S1-S6 relationship

OperatorOS Platform is shared execution infrastructure, not a seventh Workspace OS Subsystem.

- Its engineering ownership is primarily S4 Automation Infrastructure.
- Its evidence and knowledge-integration surfaces serve S6 Knowledge Base.
- It may execute Missions whose business purpose belongs to any S1-S6 Subsystem.
- It never absorbs the authority of S1 Income, S2 Skill, S3 Portfolio, S5 Career, or S6 Knowledge.
- Platform implementation components are not Workspace OS Subsystems and therefore do not need a one-to-one S-number mapping.

This resolves the historical layer collision between Workspace OS Subsystems and Platform implementation components.

## 4. Canonical terminology

| Term | Class | Definition |
|---|---|---|
| Operator | Workspace OS reference | Human final authority for Platform use. |
| Operator Profile | Entity | Platform record linking one Workspace OS Identity to deployment-local preferences and authorization subjects. |
| Workspace | Entity | Git-tracked operator-controlled directory that contains authoritative work artifacts and Mission State. |
| Artifact | Entity | Versioned Workspace-owned content with schema, provenance, lifecycle, and content-history identity. |
| Mission | Workspace OS reference | Authoritative authored unit of intent following the eight-artifact mission discipline. |
| Mission Execution Specification | Entity | Versioned Platform configuration that binds a Workspace OS Mission to executable subjects, policies, schedules, and acceptance conditions without owning Mission intent. |
| Run | Entity | One attempt to execute one active Mission Execution Specification. |
| Mission Record | Entity | Durable evidence index for one Run, created with the Run and sealed after a terminal outcome. |
| Agent Registration | Entity | Registration of an AI or deterministic executor with declared responsibilities and capabilities. |
| Extension Installation | Entity | Installed replaceable extension, with kind `plugin`, `integration`, `dashboard`, `telemetry-exporter`, or `adapter`. |
| Capability Definition | Value object | Typed action identifier plus input/output contract and risk class. |
| Capability Grant | Entity | Time- and scope-bounded authorization for one subject to use one Capability Definition. |
| Schedule | Entity | Durable trigger policy that requests a new Run; firing does not change the Schedule lifecycle. |
| Secret Reference | Entity | Typed pointer to a value owned by an external secret authority; never the value. |
| Model Route | Entity | Versioned deterministic policy that selects among operator-configured model endpoints. |
| Configuration Revision | Entity | Validated version of Platform configuration. |
| Event Record | Entity | Immutable evidence fact attributed to a subject and Run or administrative operation. |
| Checkpoint | Artifact kind | Recoverable Run-state artifact; creation is an event, not a Run lifecycle state. |
| Snapshot | Artifact kind | Point-in-time export for recovery or migration; never a second Workspace authority. |
| Memory Artifact | Artifact kind | Bounded cross-Run context with scope, provenance, retention, and promotion status. It is not durable Knowledge merely because it persists. |
| Knowledge Article | Workspace OS Artifact kind | ADR, IR, or LL governed by the Workspace OS Knowledge lifecycle. |
| Catalog | Projection | Rebuildable inventory of Workspace artifacts and relationships. |
| Audit View | Projection | Rebuildable actor/security-focused view over Mission Records and Event Records. |
| Effective Configuration | Projection | Rebuildable resolution of active Configuration Revision plus scoped overrides. |
| Telemetry | Projection/export | Replaceable spans, metrics, and logs emitted from evidence; opt-in export is never canonical state. |
| Surface | Projection/interface | CLI, HTTP API, SDK, or optional UI exposing the same domain contract. |
| Deployment Profile | Value object | Named operational defaults. Local is canonical; any networked profile is explicit opt-in. |
| Security Boundary | Policy value | Isolation and enforcement contract applied to Agent Registrations and Extension Installations. |

### 4.1 Naming rules

1. `Mission` always means the Workspace OS primitive.
2. Executable binding is always `Mission Execution Specification`, never a second meaning of Mission.
3. `Agent Registration` and `Extension Installation` are durable records; executors and processes are runtime instances, not entities.
4. `Catalog`, `Audit View`, `Telemetry`, `Dashboard`, and `Effective Configuration` are projections.
5. `Secret Reference` is the only Platform secret entity. Secret values remain external.
6. `Integration` is an Extension Installation kind, not a parallel lifecycle model.
7. `Plugin System`, `Agent Runtime`, `Data Plane`, and `Control Plane` are prohibited as Domain owners. Architecture may define components later, but Domain ownership remains here.

## 5. Canonical entity set

The Platform has exactly **14 entities**.

| # | Entity | Canonical authority record | Purpose |
|---:|---|---|---|
| 1 | Operator Profile | Active profile artifact | Link one Workspace OS Identity to Platform-local preferences and authorization subject identity. |
| 2 | Workspace | Workspace root plus content history | Authority scope and home of Platform-managed artifacts. |
| 3 | Artifact | Artifact content plus content history | Durable operator-owned work/evidence content. |
| 4 | Mission Execution Specification | Active versioned specification artifact | Bind Mission intent to executable configuration. |
| 5 | Run | Run identity plus current Mission Record state | Track one execution attempt. |
| 6 | Mission Record | Sealed evidence-index artifact | Preserve verifiable evidence and terminal outcome for one Run. |
| 7 | Agent Registration | Active registration artifact | Declare an executor and its responsibility/capability requirements. |
| 8 | Extension Installation | Active installation artifact | Declare a replaceable extension and its compatibility/isolation contract. |
| 9 | Capability Grant | Grant record | Authorize a subject/action/scope/time tuple. |
| 10 | Schedule | Active schedule artifact | Request Runs according to a durable trigger policy. |
| 11 | Secret Reference | Reference artifact | Identify externally owned secret material without storing it. |
| 12 | Model Route | Active route artifact | Reproduce model-selection policy. |
| 13 | Configuration Revision | Active validated revision artifact | Version Platform configuration and precedence inputs. |
| 14 | Event Record | Immutable evidence record referenced by a Mission Record | Record attributable facts without making an event log authoritative. |

### 5.1 Excluded first-class entities

| Candidate | Classification | Reason |
|---|---|---|
| Catalog | Projection | Rebuildable from Workspace artifacts and history; CI-07 forbids registry authority. |
| Audit Log | Projection | Rebuildable from Mission Records and Event Records. |
| Telemetry signal | Projection/export | Operational signal, not durable truth. |
| Dashboard | Surface/projection | Optional view, never an authority. |
| Integration | Extension kind | Same install/capability/isolation lifecycle as other extensions. |
| Plugin | Extension kind | Same reason; no duplicate model. |
| Memory | Artifact kind | Persistence alone does not justify a separate authority class. |
| Knowledge Article | Workspace OS-governed Artifact kind | Taxonomy and promotion authority belong to Workspace OS. |
| Role | Value object in Capability Grant policy | Authorization is enforced by concrete grants, not a second permission authority. |
| Tenant | Deployment policy value | v1 is single-tenant per operator-controlled deployment; no SaaS tenant entity. |
| Runtime | Process | CI-07: runtime owns nothing durable. |
| Component/subsystem | Architecture concept | Implementation structure is downstream from Domain. |

## 6. Entity lifecycles

### 6.1 Operator Profile

`draft -> active <-> suspended -> archived`

- At most one active Operator Profile exists for the same Workspace OS Identity in one deployment.
- An active profile may receive grants scoped to zero or more Workspaces.
- Archival does not change Workspace OS Identity.

### 6.2 Workspace

`initialized -> active <-> archived -> superseded`

- `superseded` requires a successor Workspace reference and is terminal.
- Archival is reversible by explicit operator action.
- Workspace content history remains authoritative across state changes.

### 6.3 Artifact

`draft -> validated -> active -> superseded -> archived`

Alternative transitions:

- `validated -> archived` for rejected temporary artifacts.
- `active -> archived` when no successor is needed.
- A successor uses an explicit `supersedes` reference; content is never silently replaced.

### 6.4 Mission Execution Specification

`draft -> validated -> active <-> paused -> retired`

- Any contract-changing edit creates a new draft version.
- Activating a successor retires the prior version and links `supersedes`.
- Existing Runs retain the exact specification version they started with.

### 6.5 Run

```text
queued -> running <-> paused
             |
             +-> interrupted -> recovering -> running
             |                    |
             |                    +-> failed
             +-> succeeded
             +-> failed
             +-> cancelling -> cancelled
paused ------+-> cancelling -> cancelled
```

- Terminal states: `succeeded`, `failed`, `cancelled`.
- `checkpointed` is not a state; it is a Checkpoint Artifact plus Event Record.
- `recovered` is not a terminal state; successful recovery returns to `running` and records evidence.
- Every transition is legal only if represented in this state machine.

### 6.6 Mission Record

`open -> sealing -> sealed`

- Created atomically with Run identity.
- References evidence produced before, during, and after interruption.
- `sealed` is terminal and append-closed. Correction creates a successor record with an explicit supersession link.

### 6.7 Agent Registration

`proposed -> registered -> enabled <-> disabled -> retired`

- Enabling requires declared responsibilities, Capability Definitions, and a Security Boundary.
- Retirement is terminal for that registration version.

### 6.8 Extension Installation

`staged -> installed -> enabled <-> disabled -> uninstalled`

- Upgrade creates a successor installation; `upgraded` is not a lifecycle state.
- Uninstall is terminal and verifies executable removal while preserving audit evidence.
- Extension kind does not change this lifecycle.

### 6.9 Capability Grant

`requested -> granted -> revoked | expired`

Alternative terminal: `requested -> denied`.

- Grant identity is immutable.
- A changed scope, capability, subject, or expiry creates a successor grant.
- Revocation never deletes evidence of prior use.

### 6.10 Schedule

`draft -> armed <-> suspended -> retired`

- A trigger firing creates a Run request and Event Record; it does not consume the Schedule.
- One-shot behavior retires only after the Run request is durably recorded.

### 6.11 Secret Reference

`declared -> bound <-> unbound -> revoked`

- Resolution is an Event Record, not a state.
- Rotation creates a new version; prior versions remain valid until revoked according to policy.
- Secret value is never a Platform field.

### 6.12 Model Route

`draft -> validated -> active -> superseded -> retired`

- Selection is reproducible for fixed inputs and availability evidence.
- Availability changes may change the selected endpoint but not the policy evaluation algorithm.

### 6.13 Configuration Revision

`draft -> validated -> active -> superseded -> archived`

- Exactly one active revision exists per configuration scope.
- Effective Configuration is a projection and never edited directly.

### 6.14 Event Record

`recorded -> archived`

- Payload and attribution are immutable.
- Projection retention may discard derived copies, but authoritative evidence referenced by an unarchived Mission Record remains reconstructable.

## 7. Cardinalities

| Relationship | Cardinality | Binding rule |
|---|---|---|
| Workspace OS Identity -> Operator Profile | `1 -> 0..N historical; 0..1 active per deployment` | Prevents parallel active profile authority while preserving history. |
| Operator Profile -> Workspace | `N <-> M` through Workspace-scoped Capability Grants | One operator may use many Workspaces; a small team Workspace may authorize many profiles. |
| Workspace -> Artifact | `1 -> 0..N` | Every Platform Artifact belongs to exactly one Workspace. |
| Workspace OS Mission -> Mission Execution Specification | `1 -> 0..N versions` | Execution configuration evolves without rewriting Mission intent. |
| Workspace -> Mission Execution Specification | `1 -> 0..N` | Each specification belongs to one Workspace. |
| Mission Execution Specification -> Run | `1 -> 0..N` | Every Run pins exactly one specification version. |
| Run -> Mission Record | `1 -> 1` | Record exists from Run creation. |
| Mission Record -> Artifact | `1 -> 0..N references` | Evidence artifacts remain Workspace-owned. |
| Mission Record -> Event Record | `1 -> 1..N` | Every Run records creation and terminal/interruption evidence. |
| Workspace -> Agent Registration | `1 -> 0..N` | Registration scope is one Workspace unless a deployment-level grant is explicit. |
| Workspace -> Extension Installation | `1 -> 0..N` | Installation is Workspace-scoped by default. |
| Subject -> Capability Grant | `1 -> 0..N` | Subject is Operator Profile, Agent Registration, or Extension Installation. |
| Capability Grant -> Capability Definition | `N -> 1` | Definition is immutable typed value. |
| Mission Execution Specification -> Schedule | `1 -> 0..N` | A Schedule targets one active specification version or successor policy. |
| Schedule -> Run | `1 -> 0..N` | Manual Runs have no Schedule; scheduled Runs reference one Schedule. |
| Run -> Secret Reference | `N <-> M uses` | Resolution evidence is recorded; value is external. |
| Workspace -> Model Route | `1 -> 0..N versions` | One active route per named routing scope. |
| Workspace -> Configuration Revision | `1 -> 0..N versions` | One active revision per scope. |

### 7.1 Cardinality resolution

The historical contradiction is resolved explicitly:

- Operator Profile is not owned by exactly one Workspace.
- Workspace access is not inferred from profile attachment.
- Many-to-many access is represented only by scoped Capability Grants.
- At most one active profile exists per Workspace OS Identity and deployment.
- Therefore one operator may work across many Workspaces and one team Workspace may authorize multiple operators without profile sharing ambiguity.

## 8. Aggregate boundaries

Aggregates define atomic consistency, not conceptual ownership. They do not overlap.

| Aggregate root | Members | Atomic rule |
|---|---|---|
| Workspace | Workspace metadata, Artifact references, active version pointers | Workspace version pointer updates and artifact registration commit together. |
| Operator Profile | Profile state, profile-scoped Capability Grants | Profile suspension prevents new grant use atomically. |
| Mission Execution Specification | Specification version, Schedule references, required Capability Definitions | Activation verifies all referenced contracts. |
| Run | Run state, Mission Record open state, Checkpoint references, Event Record references | Every state transition and evidence reference commit together. |
| Agent Registration | Registration state and declared Capability Definitions | Enabled registration cannot omit its Security Boundary. |
| Extension Installation | Installation state, manifest, declared Capability Definitions | Enabled extension cannot outlive compatible manifest verification. |
| Model Route | Route version and ordered policy | Active route is one immutable evaluated policy. |
| Configuration Revision | Revision and precedence metadata | Active pointer changes only after validation. |
| Secret Reference | Reference metadata and binding state | Reference state changes never include secret value. |

Cross-aggregate changes use immutable references and Event Records. No transaction writes two aggregate roots as if they were one authority.

## 9. Invariants

### 9.1 Authority and identity

- **DM-I01.** Platform never writes Workspace OS Identity, Principle, Authority, Knowledge taxonomy, Mission intent, Subsystem, or Specialization.
- **DM-I02.** Every active entity version has exactly one authoritative record.
- **DM-I03.** No Catalog, index, dashboard, metric, cache, database, event stream, or Effective Configuration projection is durable authority.
- **DM-I04.** Every externally attributed action references the authoritative user, service, or machine identity source; automation never invents an identity.

### 9.2 Workspace and artifacts

- **DM-I05.** Every Platform-owned durable artifact belongs to exactly one Workspace.
- **DM-I06.** A Workspace can be reconstructed from operator-controlled content and content history without a Platform-owned cloud authority.
- **DM-I07.** Supersession is explicit; no active artifact is silently overwritten.
- **DM-I08.** Catalog and search indexes are reproducible from authoritative artifacts.

### 9.3 Mission and execution

- **DM-I09.** Every Run pins one Mission Execution Specification version and one Workspace OS Mission reference.
- **DM-I10.** Every Run has exactly one Mission Record created at Run creation.
- **DM-I11.** Every Run transition is represented in the Run lifecycle and produces attributed evidence.
- **DM-I12.** Checkpoint and recovery are evidence-bearing operations, not undocumented runtime behavior.
- **DM-I13.** A terminal Run has a sealed Mission Record or an explicit unresolved recovery finding; it cannot disappear silently.
- **DM-I14.** Every Platform Mission State enforces the eight required Workspace OS mission artifacts.

### 9.4 Authorization and security

- **DM-I15.** Every Agent Registration and Extension Installation declares at least one Capability Definition and one Security Boundary before enablement.
- **DM-I16.** Every capability use resolves one active, unexpired Capability Grant for subject, action, scope, and Run or administrative operation.
- **DM-I17.** Capability declaration and capability authorization are separate concepts.
- **DM-I18.** Grant, denial, expiry, and revocation remain auditable.
- **DM-I19.** Secret values never appear in Platform entities, Mission Records, Event Records, projections, or telemetry.

### 9.5 Configuration, models, and extensions

- **DM-I20.** Effective Configuration is deterministic from active revisions and declared precedence.
- **DM-I21.** Model selection is reproducible from route version, request requirements, configured endpoints, availability evidence, and fallback evaluation.
- **DM-I22.** Extension failure is isolated unless a Mission Execution Specification declares it a hard dependency.
- **DM-I23.** Upgrade creates a successor Extension Installation; it does not mutate historical installation identity.
- **DM-I24.** Dashboard and telemetry remain removable without loss of authoritative state.

### 9.6 Knowledge and memory

- **DM-I25.** A Memory Artifact has scope, provenance, retention, sensitivity, and owner.
- **DM-I26.** Persistence does not promote Memory or observations to Workspace OS Knowledge.
- **DM-I27.** ADR, IR, and LL artifacts follow Workspace OS governance and retain evidence links.
- **DM-I28.** AI output is a proposal or observation until the relevant authority accepts it.

### 9.7 Deployment boundary

- **DM-I29.** Local deployment is the canonical profile and works without a network dependency for authoritative Workspace state.
- **DM-I30.** Networked or distributed operation is explicit opt-in and cannot move canonical authority outside operator control.
- **DM-I31.** v1 has one operator-controlled deployment boundary; it does not define multi-tenant SaaS organizations.
- **DM-I32.** Deployment topology never changes Domain ownership.

## 10. Projections and derived surfaces

| Projection/surface | Derived from | May be deleted and rebuilt? | May accept commands? | Authority rule |
|---|---|---:|---:|---|
| Catalog | Workspace artifacts and content history | Yes | Reconcile request only | Never owns artifact truth. |
| Audit View | Mission Records, Event Records, grants, identity references | Yes | Query only | Never owns attribution truth. |
| Effective Configuration | Active Configuration Revisions and scope precedence | Yes | Change request creates a new revision | Never edited directly. |
| Dashboard | Domain queries and command interfaces | Yes | May submit authorized commands | UI state is never canonical. |
| Telemetry | Run/Event evidence and runtime measurements | Yes | Export configuration only | Export loss cannot erase Mission evidence. |
| CLI | Domain queries and commands | Yes | Yes | Same authorization contract as all surfaces. |
| HTTP API | Domain queries and commands | Yes | Yes | Same contract; no hidden API-only entity. |
| SDK | HTTP/embedded contract types | Yes | Yes | Convenience interface, not authority. |

## 11. Capability-category mapping

All 22 Product Vision categories have a Domain home.

| Vision category | Domain home |
|---|---|
| Runtime | Run, Mission Record, Event Record, Checkpoint Artifact |
| Workspace Engine | Workspace, Artifact, Catalog projection |
| Mission Engine | Workspace OS Mission reference, Mission Execution Specification, Run, Schedule |
| Knowledge integration | Knowledge Article Artifact kinds, DM-I14, DM-I27 |
| Agent Runtime | Agent Registration, Run, Capability Grant, Security Boundary |
| Plugin System | Extension Installation, Capability Definition/Grant |
| CLI | Surface projection |
| Dashboard | Optional Surface projection / Extension kind |
| Secrets | Secret Reference and external authority boundary |
| Scheduler | Schedule and Run request |
| Telemetry | Replaceable projection/export |
| Memory | Memory Artifact kind and DM-I25/26 |
| Integrations | Extension Installation kind `integration` |
| Model Routing | Model Route |
| SDK | Surface/interface |
| Extension API | Capability Definition plus extension interface, detailed downstream |
| Administration | Operator Profile, Capability Grant, Configuration Revision |
| Configuration | Configuration Revision and Effective Configuration projection |
| Deployment | Deployment Profile value and DM-I29-32 |
| Recovery | Run lifecycle, Checkpoint/Snapshot Artifacts, Mission Record |
| Observability | Mission Record, Event Record, Catalog/Audit/Telemetry projections |
| Security | Capability Grant, Secret Reference, Security Boundary, attribution invariants |

No capability category requires a new Workspace OS primitive.

## 12. Boundary rules for downstream Architecture

Architecture MAY:

- Choose components and interfaces that implement these entities.
- Merge implementation responsibilities when Domain ownership remains unchanged.
- Define local and opt-in distributed adapters.
- Define Plugin, Integration, Dashboard, and Telemetry adapters under the Extension Installation model.

Architecture MUST NOT:

- Assign Domain authority to a component such as Data Plane, Control Plane, Runtime, or Plugin System.
- Make Event Log, database, queue, dashboard, catalog, or telemetry authoritative.
- Reclassify a projection as an entity.
- Add a Run lifecycle state.
- Split Plugin and Integration into conflicting domain lifecycles.
- Convert Platform components into S1-S6 Subsystems.
- weaken local-first or human-authority invariants.

## 13. Evolution rules

A Domain change requires:

1. Evidence that a current contract fails.
2. Earliest-impact classification through the Impact Matrix.
3. Full Domain Model regeneration.
4. New Gate C.
5. Regeneration of all downstream consumers.
6. ADR when the change affects a frozen Platform decision or OperatorOS v0.8 compatibility boundary.

Refactoring priority:

1. Remove authority conflicts.
2. Eliminate duplication.
3. Consolidate identical concepts.
4. Reduce context needs.
5. Simplify navigation.
6. Improve discoverability.
7. Improve naming.

## 14. Mechanical summary

- Workspace OS primitives referenced: 7.
- Platform entities: 14.
- Value objects/policies: 4 primary (`Capability Definition`, `Deployment Profile`, `Security Boundary`, identity references).
- Projections/surfaces: 7 listed.
- Invariants: 32.
- Entity lifecycles: 14.
- Vision categories mapped: 22 of 22.
- Shared aggregate membership: 0.
- Domain owners named as implementation components: 0.
- New Workspace OS primitives: 0.

## 15. Gate C entry condition

Gate C must independently verify:

1. Entity count and uniqueness.
2. Lifecycle completeness and prose/state consistency.
3. Cardinality consistency.
4. No aggregate overlap.
5. No projection authority.
6. No Workspace OS primitive redefinition.
7. Complete 22-category mapping.
8. ADR-001 and v0.8 compatibility.
9. No API, storage-engine, deployment-topology, or framework leakage.
10. No unresolved historical contradiction.

Until Gate C PASS, this document is a candidate and Phase 3 may not begin.
