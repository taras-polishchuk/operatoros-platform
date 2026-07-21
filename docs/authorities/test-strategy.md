# OperatorOS Platform - Test Strategy

> **Phase:** 7 - Test Strategy
> **Status:** COMPETITIVE DESTRUCTION SIMPLIFICATIONS INTEGRATED; GATE H RE-VALIDATION REQUIRED
> **Date:** 2026-07-19
> **Architecture:** SHA f4b76ad372164bb37ec3705e723d372a4e53f686569e0e50a7e5cdcabba37dc5
> **Architecture Validation:** SHA `a2ff530baf89fb15c619e6c88725e6a0862c5a436975c8d8352f44f4bb8804e3`
> **Roadmap:** SHA `add6035997d57639ca0c6b89dbd79ff57109a9e72053ce2ac3b7263103b547e1`
> **Gate G:** PASS

## Document contract

**Inputs**

- Domain/Gate C, Functional Specification/Gate D, Architecture/Gate E, Architecture Validation/Gate F, Roadmap/Gate G, ADR-001.

**Outputs**

- 22 functional suites, NFR suite, cross-cutting suites, exact 101-ID test trace, risk and validation-obligation mapping, evidence-gathering contract, gate conditions.

**Authorities**

- Frozen current Architecture and Domain/Functional contracts.

**Consumers**

- Gate H, Stress Review, Production Readiness, Competitive Review, Final Consistency Audit.

**Dependencies**

- Current C-G chain only.

**Reverse dependencies**

- Every active artifact from Phase 8 through Final Report.

---

## 1. Strategy principles

1. Every current normative requirement is exercised by at least one named test case in this document, executed against the implementation by a test owned by its Roadmap primary work package.
2. Cross-cutting suites verify failure detection, security, performance, recovery, durability, operability, migration, and compatibility contracts independently of feature suites.
3. No design authority changes are introduced; Test Strategy enforces architecture contracts.
4. Architecture Validation obligations and Architecture risks are mapped to test suites as release-blocking or profile-blocking.
5. Test infrastructure and scenarios must be reproducible on the named reference profile with explicit inputs.
6. Test count is observed from this document, not asserted.
7. Testing claims design-frozen maturity, not production maturity.

## 2. Test layers

| Layer | Scope | Authority target |
|---|---|---|
| Unit | Single function/module within a component/extension | component contracts, domain decisions |
| Component contract | Component public API surfaces | Mutation Envelope, command/query/event contracts, isolation |
| Cross-component | Two or more components | evidence acknowledgement, admission, recovery lease |
| Cross-cutting security | Platform-wide | default-deny, attribution, secret exclusion, extension isolation |
| Performance | Named reference profile and dataset | NFR-PERF budgets |
| Recovery and durability | Crash/restart/partition/disk-full/network-fault | Mutation Envelope outcomes and recovery model |
| Migration and compatibility | Golden migration corpus and contract ranges | NFR-MIG and NFR-COMP |
| End-to-end acceptance | Full local profile | local release gates |
| Profile acceptance | Operator-hosted/distributed profiles | profile-specific gates |

## 3. Functional suites by category

### 3.1 TS-S-ADM - Administration

**Suite coverage:** 4 requirements; primary owner follows Roadmap §5.

| Requirement | Primary test case | Roadmap owner | Evidence | Milestone |
|---|---|---|---|---|
| FR-ADM-1 | TC-FR-ADM-1-M0 | IP-006 | M0 verification bundle | M0 |
| FR-ADM-2 | TC-FR-ADM-2-M0 | IP-006 | M0 verification bundle | M0 |
| FR-ADM-3 | TC-FR-ADM-3-M0 | IP-006 | M0 verification bundle | M0 |
| FR-ADM-4 | TC-FR-ADM-4-M0 | IP-006 | M0 verification bundle | M0 |

### 3.2 TS-S-AR - Agent Runtime

**Suite coverage:** 4 requirements; primary owner follows Roadmap §5.

| Requirement | Primary test case | Roadmap owner | Evidence | Milestone |
|---|---|---|---|---|
| FR-AR-1 | TC-FR-AR-1-M1 | IP-101 | M1 verification bundle | M1 |
| FR-AR-2 | TC-FR-AR-2-M1 | IP-101 | M1 verification bundle | M1 |
| FR-AR-3 | TC-FR-AR-3-M1 | IP-101 | M1 verification bundle | M1 |
| FR-AR-4 | TC-FR-AR-4-M1 | IP-101 | M1 verification bundle | M1 |

### 3.3 TS-S-CFG - Configuration

**Suite coverage:** 4 requirements; primary owner follows Roadmap §5.

| Requirement | Primary test case | Roadmap owner | Evidence | Milestone |
|---|---|---|---|---|
| FR-CFG-1 | TC-FR-CFG-1-M0 | IP-006 | M0 verification bundle | M0 |
| FR-CFG-2 | TC-FR-CFG-2-M0 | IP-006 | M0 verification bundle | M0 |
| FR-CFG-3 | TC-FR-CFG-3-M0 | IP-006 | M0 verification bundle | M0 |
| FR-CFG-4 | TC-FR-CFG-4-M0 | IP-006 | M0 verification bundle | M0 |

### 3.4 TS-S-CLI - CLI

**Suite coverage:** 4 requirements; primary owner follows Roadmap §5.

| Requirement | Primary test case | Roadmap owner | Evidence | Milestone |
|---|---|---|---|---|
| FR-CLI-1 | TC-FR-CLI-1-M0 | IP-009 | M0 verification bundle | M0 |
| FR-CLI-2 | TC-FR-CLI-2-M0 | IP-009 | M0 verification bundle | M0 |
| FR-CLI-3 | TC-FR-CLI-3-M0 | IP-009 | M0 verification bundle | M0 |
| FR-CLI-4 | TC-FR-CLI-4-M0 | IP-009 | M0 verification bundle | M0 |

### 3.5 TS-S-DEP - Deployment

**Suite coverage:** 4 requirements; primary owner follows Roadmap §5.

| Requirement | Primary test case | Roadmap owner | Evidence | Milestone |
|---|---|---|---|---|
| FR-DEP-1 | TC-FR-DEP-1-M0 | IP-011 | M0 verification bundle | M0 |
| FR-DEP-2 | TC-FR-DEP-2-M3 | IP-303 | M3 verification bundle | M3 |
| FR-DEP-3 | TC-FR-DEP-3-M4 | IP-403 | M4 verification bundle | M4 |
| FR-DEP-4 | TC-FR-DEP-4-M0 | IP-011 | M0 verification bundle | M0 |

### 3.6 TS-S-DSH - Dashboard

**Suite coverage:** 4 requirements; primary owner follows Roadmap §5.

| Requirement | Primary test case | Roadmap owner | Evidence | Milestone |
|---|---|---|---|---|
| FR-DSH-1 | TC-FR-DSH-1-M3 | IP-301 | M3 verification bundle | M3 |
| FR-DSH-2 | TC-FR-DSH-2-M3 | IP-301 | M3 verification bundle | M3 |
| FR-DSH-3 | TC-FR-DSH-3-M3 | IP-301 | M3 verification bundle | M3 |
| FR-DSH-4 | TC-FR-DSH-4-M3 | IP-301 | M3 verification bundle | M3 |

### 3.7 TS-S-EXT - Extension API

**Suite coverage:** 4 requirements; primary owner follows Roadmap §5.

| Requirement | Primary test case | Roadmap owner | Evidence | Milestone |
|---|---|---|---|---|
| FR-EXT-1 | TC-FR-EXT-1-M2 | IP-201 | M2 verification bundle | M2 |
| FR-EXT-2 | TC-FR-EXT-2-M2 | IP-201 | M2 verification bundle | M2 |
| FR-EXT-3 | TC-FR-EXT-3-M2 | IP-201 | M2 verification bundle | M2 |
| FR-EXT-4 | TC-FR-EXT-4-M2 | IP-201 | M2 verification bundle | M2 |

### 3.8 TS-S-INT - Integrations

**Suite coverage:** 4 requirements; primary owner follows Roadmap §5.

| Requirement | Primary test case | Roadmap owner | Evidence | Milestone |
|---|---|---|---|---|
| FR-INT-1 | TC-FR-INT-1-M2 | IP-203 | M2 verification bundle | M2 |
| FR-INT-2 | TC-FR-INT-2-M2 | IP-203 | M2 verification bundle | M2 |
| FR-INT-3 | TC-FR-INT-3-M2 | IP-203 | M2 verification bundle | M2 |
| FR-INT-4 | TC-FR-INT-4-M2 | IP-203 | M2 verification bundle | M2 |

### 3.9 TS-S-KN - Knowledge

**Suite coverage:** 4 requirements; primary owner follows Roadmap §5.

| Requirement | Primary test case | Roadmap owner | Evidence | Milestone |
|---|---|---|---|---|
| FR-KN-1 | TC-FR-KN-1-M1 | IP-105 | M1 verification bundle | M1 |
| FR-KN-2 | TC-FR-KN-2-M1 | IP-105 | M1 verification bundle | M1 |
| FR-KN-3 | TC-FR-KN-3-M1 | IP-105 | M1 verification bundle | M1 |
| FR-KN-4 | TC-FR-KN-4-M1 | IP-105 | M1 verification bundle | M1 |

### 3.10 TS-S-ME - Mission Engine

**Suite coverage:** 4 requirements; primary owner follows Roadmap §5.

| Requirement | Primary test case | Roadmap owner | Evidence | Milestone |
|---|---|---|---|---|
| FR-ME-1 | TC-FR-ME-1-M0 | IP-007 | M0 verification bundle | M0 |
| FR-ME-2 | TC-FR-ME-2-M0 | IP-007 | M0 verification bundle | M0 |
| FR-ME-3 | TC-FR-ME-3-M0 | IP-007 | M0 verification bundle | M0 |
| FR-ME-4 | TC-FR-ME-4-M0 | IP-007 | M0 verification bundle | M0 |

### 3.11 TS-S-MEM - Memory

**Suite coverage:** 4 requirements; primary owner follows Roadmap §5.

| Requirement | Primary test case | Roadmap owner | Evidence | Milestone |
|---|---|---|---|---|
| FR-MEM-1 | TC-FR-MEM-1-M1 | IP-104 | M1 verification bundle | M1 |
| FR-MEM-2 | TC-FR-MEM-2-M1 | IP-104 | M1 verification bundle | M1 |
| FR-MEM-3 | TC-FR-MEM-3-M1 | IP-104 | M1 verification bundle | M1 |
| FR-MEM-4 | TC-FR-MEM-4-M1 | IP-104 | M1 verification bundle | M1 |

### 3.12 TS-S-MR - Model Routing

**Suite coverage:** 4 requirements; primary owner follows Roadmap §5.

| Requirement | Primary test case | Roadmap owner | Evidence | Milestone |
|---|---|---|---|---|
| FR-MR-1 | TC-FR-MR-1-M1 | IP-103 | M1 verification bundle | M1 |
| FR-MR-2 | TC-FR-MR-2-M1 | IP-103 | M1 verification bundle | M1 |
| FR-MR-3 | TC-FR-MR-3-M1 | IP-103 | M1 verification bundle | M1 |
| FR-MR-4 | TC-FR-MR-4-M1 | IP-103 | M1 verification bundle | M1 |

### 3.13 TS-S-OBS - Observability

**Suite coverage:** 4 requirements; primary owner follows Roadmap §5.

| Requirement | Primary test case | Roadmap owner | Evidence | Milestone |
|---|---|---|---|---|
| FR-OBS-1 | TC-FR-OBS-1-M0 | IP-004 | M0 verification bundle | M0 |
| FR-OBS-2 | TC-FR-OBS-2-M0 | IP-004 | M0 verification bundle | M0 |
| FR-OBS-3 | TC-FR-OBS-3-M0 | IP-004 | M0 verification bundle | M0 |
| FR-OBS-4 | TC-FR-OBS-4-M0 | IP-004 | M0 verification bundle | M0 |

### 3.14 TS-S-PL - Plugin System

**Suite coverage:** 4 requirements; primary owner follows Roadmap §5.

| Requirement | Primary test case | Roadmap owner | Evidence | Milestone |
|---|---|---|---|---|
| FR-PL-1 | TC-FR-PL-1-M2 | IP-202 | M2 verification bundle | M2 |
| FR-PL-2 | TC-FR-PL-2-M2 | IP-202 | M2 verification bundle | M2 |
| FR-PL-3 | TC-FR-PL-3-M2 | IP-202 | M2 verification bundle | M2 |
| FR-PL-4 | TC-FR-PL-4-M2 | IP-202 | M2 verification bundle | M2 |

### 3.15 TS-S-REC - Recovery

**Suite coverage:** 4 requirements; primary owner follows Roadmap §5.

| Requirement | Primary test case | Roadmap owner | Evidence | Milestone |
|---|---|---|---|---|
| FR-REC-1 | TC-FR-REC-1-M0 | IP-010 | M0 verification bundle | M0 |
| FR-REC-2 | TC-FR-REC-2-M0 | IP-010 | M0 verification bundle | M0 |
| FR-REC-3 | TC-FR-REC-3-M0 | IP-010 | M0 verification bundle | M0 |
| FR-REC-4 | TC-FR-REC-4-M0 | IP-010 | M0 verification bundle | M0 |

### 3.16 TS-S-RT - Runtime

**Suite coverage:** 4 requirements; primary owner follows Roadmap §5.

| Requirement | Primary test case | Roadmap owner | Evidence | Milestone |
|---|---|---|---|---|
| FR-RT-1 | TC-FR-RT-1-M0 | IP-007 | M0 verification bundle | M0 |
| FR-RT-2 | TC-FR-RT-2-M0 | IP-007 | M0 verification bundle | M0 |
| FR-RT-3 | TC-FR-RT-3-M0 | IP-007 | M0 verification bundle | M0 |
| FR-RT-4 | TC-FR-RT-4-M0 | IP-007 | M0 verification bundle | M0 |

### 3.17 TS-S-SCH - Scheduler

**Suite coverage:** 4 requirements; primary owner follows Roadmap §5.

| Requirement | Primary test case | Roadmap owner | Evidence | Milestone |
|---|---|---|---|---|
| FR-SCH-1 | TC-FR-SCH-1-M1 | IP-102 | M1 verification bundle | M1 |
| FR-SCH-2 | TC-FR-SCH-2-M1 | IP-102 | M1 verification bundle | M1 |
| FR-SCH-3 | TC-FR-SCH-3-M1 | IP-102 | M1 verification bundle | M1 |
| FR-SCH-4 | TC-FR-SCH-4-M1 | IP-102 | M1 verification bundle | M1 |

### 3.18 TS-S-SDK - SDK

**Suite coverage:** 4 requirements; primary owner follows Roadmap §5.

| Requirement | Primary test case | Roadmap owner | Evidence | Milestone |
|---|---|---|---|---|
| FR-SDK-1 | TC-FR-SDK-1-M2 | IP-204 | M2 verification bundle | M2 |
| FR-SDK-2 | TC-FR-SDK-2-M2 | IP-204 | M2 verification bundle | M2 |
| FR-SDK-3 | TC-FR-SDK-3-M2 | IP-204 | M2 verification bundle | M2 |
| FR-SDK-4 | TC-FR-SDK-4-M2 | IP-204 | M2 verification bundle | M2 |

### 3.19 TS-S-SEC - Secrets

**Suite coverage:** 4 requirements; primary owner follows Roadmap §5.

| Requirement | Primary test case | Roadmap owner | Evidence | Milestone |
|---|---|---|---|---|
| FR-SEC-1 | TC-FR-SEC-1-M0 | IP-008 | M0 verification bundle | M0 |
| FR-SEC-2 | TC-FR-SEC-2-M0 | IP-008 | M0 verification bundle | M0 |
| FR-SEC-3 | TC-FR-SEC-3-M0 | IP-008 | M0 verification bundle | M0 |
| FR-SEC-4 | TC-FR-SEC-4-M0 | IP-008 | M0 verification bundle | M0 |

### 3.20 TS-S-SRY - Security

**Suite coverage:** 5 requirements; primary owner follows Roadmap §5.

| Requirement | Primary test case | Roadmap owner | Evidence | Milestone |
|---|---|---|---|---|
| FR-SRY-1 | TC-FR-SRY-1-M0 | IP-008 | M0 verification bundle | M0 |
| FR-SRY-2 | TC-FR-SRY-2-M0 | IP-008 | M0 verification bundle | M0 |
| FR-SRY-3 | TC-FR-SRY-3-M0 | IP-008 | M0 verification bundle | M0 |
| FR-SRY-4 | TC-FR-SRY-4-M0 | IP-008 | M0 verification bundle | M0 |
| FR-SRY-5 | TC-FR-SRY-5-M0 | IP-008 | M0 verification bundle | M0 |

### 3.21 TS-S-TEL - Telemetry

**Suite coverage:** 4 requirements; primary owner follows Roadmap §5.

| Requirement | Primary test case | Roadmap owner | Evidence | Milestone |
|---|---|---|---|---|
| FR-TEL-1 | TC-FR-TEL-1-M3 | IP-302 | M3 verification bundle | M3 |
| FR-TEL-2 | TC-FR-TEL-2-M3 | IP-302 | M3 verification bundle | M3 |
| FR-TEL-3 | TC-FR-TEL-3-M3 | IP-302 | M3 verification bundle | M3 |
| FR-TEL-4 | TC-FR-TEL-4-M3 | IP-302 | M3 verification bundle | M3 |

### 3.22 TS-S-WE - Workspace Engine

**Suite coverage:** 4 requirements; primary owner follows Roadmap §5.

| Requirement | Primary test case | Roadmap owner | Evidence | Milestone |
|---|---|---|---|---|
| FR-WE-1 | TC-FR-WE-1-M0 | IP-005 | M0 verification bundle | M0 |
| FR-WE-2 | TC-FR-WE-2-M0 | IP-005 | M0 verification bundle | M0 |
| FR-WE-3 | TC-FR-WE-3-M0 | IP-005 | M0 verification bundle | M0 |
| FR-WE-4 | TC-FR-WE-4-M0 | IP-005 | M0 verification bundle | M0 |

### 3.23 TS-S-NFR - Non-functional

**Suite coverage:** 12 requirements; primary owner follows Roadmap §5.

| Requirement | Primary test case | Roadmap owner | Evidence | Milestone |
|---|---|---|---|---|
| NFR-PERF-1 | TC-NFR-PERF-1-M0 | IP-012 | M0 verification bundle | M0 |
| NFR-PERF-2 | TC-NFR-PERF-2-M0 | IP-012 | M0 verification bundle | M0 |
| NFR-PERF-3 | TC-NFR-PERF-3-M0 | IP-012 | M0 verification bundle | M0 |
| NFR-SEC-1 | TC-NFR-SEC-1-M0 | IP-008 | M0 verification bundle | M0 |
| NFR-SEC-2 | TC-NFR-SEC-2-M0 | IP-008 | M0 verification bundle | M0 |
| NFR-REL-1 | TC-NFR-REL-1-M0 | IP-003 | M0 verification bundle | M0 |
| NFR-REL-2 | TC-NFR-REL-2-M0 | IP-012 | M0 verification bundle | M0 |
| NFR-COMP-1 | TC-NFR-COMP-1-M0 | IP-001 | M0 verification bundle | M0 |
| NFR-MIG-1 | TC-NFR-MIG-1-M0 | IP-005 | M0 verification bundle | M0 |
| NFR-OPS-1 | TC-NFR-OPS-1-M0 | IP-012 | M0 verification bundle | M0 |
| NFR-OPS-2 | TC-NFR-OPS-2-M0 | IP-012 | M0 verification bundle | M0 |
| NFR-USE-1 | TC-NFR-USE-1-M0 | IP-012 | M0 verification bundle | M0 |

## 4. Cross-cutting suites

| Code | Suite | Targets | Owner/role | Required for |
|---|---|---|---|---|
| TS-X-SEC | Security baseline | FR-SRY, FR-SEC, FR-CLI, FR-DSH, FR-EXT, NFR-SEC-1, NFR-SEC-2 | Security task IP-008 | every milestone |
| TS-X-ENV | Mutation Envelope | FR-RT, FR-WE, FR-ME, FR-REC, AV-O1 | Evidence Service IP-004 | every milestone |
| TS-X-AGG | Aggregate/event ordering | FR-RT, FR-OBS, FR-REC, AV-O2, ST-2 cross-aggregate causality under concurrency | Evidence Service IP-004 | M0 |
| TS-X-PERF | Performance budgets | NFR-PERF-1, NFR-PERF-2, NFR-PERF-3, AV-O3, AV-O4 | Load task IP-012 | M0, profile rollouts |
| TS-X-RECOV | Recovery/crash/partition | FR-REC, FR-RT, FR-ME, AV-O1, AV-O5, ST-3 dual-contender recovery | Recovery IP-010, distributed IP-402 | every release; M4 chaos |
| TS-X-REDEL | Red-team, secrecy, attribution | FR-SRY, FR-CLI, FR-DSH, FR-INT, AV-O6, ST-7 IR obligation on escaped contract failure | Security IP-008, integration IP-203 | every release |
| TS-X-REDEL | Red-team, secrecy, attribution | FR-SRY, FR-CLI, FR-DSH, FR-INT, AV-O6 | Security IP-008, integration IP-203 | every release |
| TS-X-MIG | Migration and compatibility | FR-WE, FR-ME, FR-CFG, FR-DEP, NFR-COMP-1, NFR-MIG-1 | Migration IP-011, Roadmap IP-301/401 | every profile release |
| TS-X-PARITY | Surface parity | FR-CLI, FR-SDK, FR-EXT | SDK/HTTP IP-204 | M2+ |
| TS-X-CONT | Knowledge continuity | FR-KN, FR-MEM, FR-AR, FR-MR | Knowledge IP-105, memory IP-104 | M1+ |
| TS-X-PROF | Profile acceptance | FR-DEP, FR-OBS | Profile IP-303/403 | M3/M4 |

## 5. Architecture Validation obligation mapping

| Obligation | Test suites | Acceptance evidence | Release effect |
|---|---|---|---|
| AV-O1 Mutation Envelope spike/crash matrix | TS-X-ENV, TS-X-RECOV | crash-point committed/uncommitted/conflict/evidence-gap matrix on local authority adapter | blocks M0 |
| AV-O2 aggregate ordering/correlation/sealing | TS-X-AGG, TS-S-OBS | cross-aggregate replay/correlation and sealing/correction successor | blocks M0 |
| AV-O3 Evidence throughput/admission | TS-X-PERF | mutation latency under load; admission denial under evidence-capacity exhaustion | blocks M0 |
| AV-O4 100k/10k benchmark | TS-X-PERF | local non-streaming queries meet percentile budgets | blocks M0 |
| AV-O5 split-brain/recovery lease/partition | TS-X-RECOV | chaos scenarios produce one safe continuation or explicit unresolved state | blocks M4 |
| AV-O6 zero secret leakage | TS-X-SEC, TS-X-REDEL | canary corpus has zero leakage across success/error/retry/recovery/exports/telemetry/UI | blocks every release |
| AV-O7 exact 101-ID mappings | §3 + Gate H + §6 | every current ID present and traceable | blocks Gates G/H |

## 6. Architecture risk mapping

| Risk | Test suites | Required evidence | Release effect |
|---|---|---|---|
| AR-R01 | TS-X-ENV, TS-X-RECOV | Mutation Envelope crash matrix | blocks M0 |
| AR-R02 | TS-X-PERF | Evidence throughput/admission benchmark | blocks M0 |
| AR-R03 | design freeze only | Component responsibility review at design freeze | design freeze |
| AR-R04 | TS-S-PL, TS-S-INT, TS-S-EXT, TS-S-DSH, TS-S-TEL | all-kind manifest/lifecycle conformance | blocks M2 |
| AR-R05 | TS-S-DEP, TS-X-PROF | cross-profile semantic parity | blocks every profile release |
| AR-R06 | TS-X-PROF, TS-X-RECOV | operational pilot and chaos evidence | blocks M3/M4 |
| AR-R07 | TS-X-AGG | concurrent causality replay | blocks M0 |
| AR-R08 | TS-X-RECOV | split-brain chaos | blocks M4 |
| AR-R09 | TS-X-ENV, TS-S-PL | checkpoint/version migration corpus | blocks M2 |
| AR-R10 | TS-S-WE, TS-X-PERF | delete/rebuild equivalence and budgets | blocks M0 |
| AR-R11 | TS-S-ADM, TS-X-SEC | grant graph/usability audit | blocks M0 |
| AR-R12 | TS-X-REDEL, TS-X-SEC | canary/adversarial extension suite | blocks every release |
| AR-R13 | TS-S-MR | availability replay | blocks M1 |
| AR-R14 | TS-S-MEM | context privacy and load tests | blocks M1 |
| AR-R15 | TS-S-ME, TS-X-RECOV | approval policy/timed scenarios | blocks M0 |
| AR-R16 | TS-X-MIG | v0.8 golden migration corpus | blocks M0 |
| AR-R17 | TS-X-PARITY | Surface contract parity | blocks M2 |
| AR-R18 | TS-S-KN | knowledge dedup/throttle metrics | blocks M1 |
| AR-R19 | TS-X-PERF | 100k/10k benchmark | blocks M0 |
| AR-R20 | TS-X-RECOV | retention/restore cost study | blocks every release |

## 7. Test infrastructure

- Generated test clients from published contracts.
- In-process deterministic clocks and idempotent identifier sources.
- Crash/host-loss harness (process kill, network partition, disk full, secret backend down).
- Operator-controlled fixture store for Workspace artifacts, Memory, Routes, Configurations, Profiles.
- Reference hardware/dataset fingerprint recorded in evidence.
- Replay tools for envelope state and aggregate event streams.
- Coverage report includes requirement-to-test mapping.

## 8. Evidence bundle

Each milestone release gate produces:

- signed manifest of test cases executed;
- coverage table mapping each current requirement to executed test IDs;
- failure logs (zero unclassified);
- performance and resource numbers;
- crash matrix output;
- canary scan report;
- golden migration corpus report;
- contract compatibility matrix;
- current frozen input hashes;
- unresolved and known issues with explicit owner.

## 9. Cross-suite independence

Each cross-cutting suite is independent and may fail without invalidating other suites. Security, mutation-envelope, recovery, migration, and performance suites are explicitly release gates.

## 10. Failure handling

- Test failure creates a typed artifact with reproduction inputs; never a plain error.
- Failed suite blocks its owning milestone release.
- A test that cannot run produces an evidence gap, not a green pass.
- Reporting distinguishes design/test/runtime failures.

## 11. Day-one test boundary

- This document is design-frozen Test Strategy.
- No test code exists yet; test counts are observed from this document.
- No production readiness claim is implied.

## 12. Gate H entry condition

Gate H inherits the Final Consistency Audit acceptance clauses (see Gate K) plus the suite-specific checks in §3-§6. Until Gate H PASS, Phase 8 may not begin.
