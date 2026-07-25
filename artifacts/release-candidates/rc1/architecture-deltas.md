# Architecture Deltas — OperatorOS Platform v1.0

This document lists every deviation from the frozen architecture (Architecture SHA-256 `1e79049d9ae5a328556378ff8235525cd0f692bfa317fd7da6dc2bcdb1f27610`).

## D-001: Storage backend — SQLite WAL via `node:sqlite`

**Where:** packages/evidence-service, packages/workspace-service, packages/governance-service, packages/recovery-service, packages/agent-execution, packages/extension-runtime, packages/distributed-coordination.

The architecture allowed for either file journal or SQLite WAL (Architecture §2 Local Profile). We selected SQLite WAL via `node:sqlite`, validated by the persistence spike (IP-003). The selection is recorded in ADR-0002-local-persistence.

## D-002: Public contract version `1.0.0`

**Where:** packages/contracts/src/index.ts.

The architecture pinned public contract version `1.0.0`. All 14 entities + 5 envelopes + 1 extension manifest schema include `entity_schema_version: z.literal('1.0.0')` (entity-level) or `schema_version: z.string().regex(...)` (event-level, semver).

## D-003: Evidence Service batch API

**Where:** packages/evidence-service/src/index.ts.

Added `openBatch`, `closeBatch`, `abortBatch` for high-throughput workloads. Each call uses SAVEPOINTs to isolate per-mutation failures. The historical RC1 benchmark recorded 3850 ops/sec at 1000 mutations; the current v1.0 validation uses 5000 mutations to reduce timing noise and recorded 3602–4009 ops/sec across three runs.

## D-004: Interface Host uses inline structural types

**Where:** packages/interface-host/src/index.ts.

The interface host defines `LocalXxxService` structural types rather than importing from each service package. This decouples the in-process dispatcher from internal service type churn.

## D-005: v0.8 Importer is strictly READ-ONLY on v0.8 source

**Where:** packages/v08-importer/src/index.ts.

The `readonlyV08RootPath` parameter name IS the contract. The importer cannot mutate the v0.8 source under any code path.

## D-006: Six delegation verdicts folded into Mission State

**Where:** progress.md, decisions.md.

Six read-only audits (`deleg_79b9ce0c`, `deleg_9f4c62fe`, `deleg_a2316c1d`, `deleg_3a5ef9a7`, `deleg_4cd0a1bf`, `deleg_340ac342`) informed the implementation. Decisions D1..D17 trace back to one or more verdicts.
