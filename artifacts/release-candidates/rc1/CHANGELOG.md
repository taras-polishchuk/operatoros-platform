# Changelog

## v1.0.0-rc1 — 2026-07-20

Initial Release Candidate for OperatorOS Platform, the canonical successor to OperatorOS v0.8.x.

### What's new

This is the first end-to-end RC of the OperatorOS Platform monorepo: 13 packages, 129 tests passing, 50 supported operations, full quality gate green, NFR matrix all pass (PERF 3850 ops/sec, RTO 40ms, cold-start 88ms).

#### M0 Local Bedrock (closed)

- **IP-002 Contracts**: 14-entity vocabulary + 5 envelopes + extension manifest, byte-stable JSON Schema generation.
- **IP-004 Evidence Service**: SQLite WAL atomic mutations, mission records, idempotency, integrity verification, batch API with SAVEPOINT isolation.
- **IP-005 Workspace Service**: Workspace aggregate, Artifact aggregate, snapshot export/import with workspace_ref mismatch rejection.
- **IP-006 Governance Service**: Operator Profile FSM, Capability Grant issue/revoke, Configuration Revision precedence resolution.
- **IP-007 Execution Service**: Mission Record per Run, run state machine (queued→running→paused→interrupted→recovering→succeeded/failed/cancelled/expired), optimistic concurrency, evidence routing.
- **IP-008 Secret Reference**: Security baseline enforced (no secret value persisted, in-memory preview only).
- **IP-009 Interface Host**: Local CLI (explain/inspect/run/cancel); storage paths and secret material never exposed.
- **IP-010 Recovery**: Checkpoint, recovery lease with fencing_token + contender_seq, dual-contender resolution (loser preempted).
- **IP-011 v0.8 Importer**: Strictly READ-ONLY on v0.8 root; dry-run, discover, import to target workspace.
- **IP-012 NFR Closure**: All 6 NFR / AV checks pass.

#### M1 Agent Execution (closed)

- **IP-101..IP-104**: Agent Registration (draft/active/suspended/retired), capability matching against governance grants, invoke + record-result + cancel + idempotency on re-record.

#### M2 Extensibility (closed)

- **IP-201..IP-205**: Extension lifecycle (staged→validated→active→suspended→retired), capability grant enforcement at the extension boundary, uninstall flow with successor ref.

#### M3 Operator-hosted (closed)

- **IP-301..IP-304**: Tenant register/suspend/resume, cross-tenant workspace isolation, hosted CLI shape (explain/run/cancel) with request_digest.

#### M4 Distributed (closed)

- **IP-401..IP-403**: Peer register/deregister, anchor with fencing_token, reconcile across peers (payload_digest divergence detection), deregister blocks subsequent anchors.

### Compatibility

- `core/package.json#version` 0.8.0 (CHANGELOG v0.8.2)
- Imports v0.8.x workspaces non-destructively (FR-DEP-1, AR-R16)
- Public contract version: `1.0.0`

### Known limitations / v1.1 backlog

See `artifacts/release-candidates/rc1/technical-debt.md`.
