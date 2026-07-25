# FAQ

## What is a Mission?

A Mission is named declarative intent. A Run is one execution of that intent. A Mission Record is the durable evidence record for a Run and can be sealed after terminal evidence is verified.

## What is a Run?

A state-machine instance with 8 states (`RUN_STATES`) and optimistic concurrency.

## Why local-first?

Operator authority requires no network for canonical operations. Local-first is audit-friendly and offline-deterministic.

## Does OperatorOS require a network?

No. The Local profile is offline-deterministic and has no required network authority.

## Where are secrets stored?

Only as 4-character previews. Raw values are never persisted. v1.1 adds OS keyring support.

## How does OperatorOS compare with Temporal?

OperatorOS emphasizes local-first authority, operator-controlled capabilities, and sealed evidence. It is not a workflow engine; it is a mission ledger. Choose the system that matches your authority and orchestration needs.

## How does recovery work?

Recovery Service performs fencing-token preemption. If two contenders exist, the lexicographic tie-breaker resolves them deterministically.

## What is the difference between v1.0.0-rc1 and v1.0.0?

RC1 was internal-quality. v1.0 adds a public-facing landing page, executable CLI, GitHub-ready artifacts, and expanded documentation. The underlying architecture is unchanged, including SHA-256 `1e79049d9ae5a328556378ff8235525cd0f692bfa317fd7da6dc2bcdb1f27610`.

## What is the migration path from OperatorOS v0.8.x?

Use the `v08-importer` package. It is READ-ONLY on v0.8 and produces OperatorOS Platform artifacts.

## What's in v1.1?

The backlog includes OS keyring support, OTel observability, a stable SQLite binding, and other tracked technical-debt work.
