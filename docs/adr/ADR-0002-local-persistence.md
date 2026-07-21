# ADR-0002: Select SQLite WAL for local authoritative mutation persistence

- Status: Accepted
- Date: 2026-07-19
- Roadmap: IP-003
- Authorities: Architecture section 5.4, NFR-REL-1, AV-O1, AR-R01

## Context

IP-003 requires two bounded crash-tested mechanisms before choosing the local authoritative persistence and Mutation Envelope implementation. The two spikes exercised the same seven crash boundaries: before prepare, after prepare, after authoritative record, after Event Record, after idempotency result, after commit, and after acknowledgement.

## Evidence

| Mechanism                                                                                                | Crash outcomes                                                                                                                | Acknowledged loss | Request replay                  | Partial-state behavior                                                                               |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------: | ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| SQLite 3.51.3 through Node 22 `node:sqlite`, WAL + `synchronous=FULL`, one `BEGIN IMMEDIATE` transaction | Pre-commit boundaries return `uncommitted`; post-commit boundaries return `committed`                                         |                 0 | Returns original durable result | Transaction prevents partially committed record/Event/idempotency sets                               |
| File journal, atomic rename + file and directory `fsync`                                                 | `prepared` returns `uncommitted`; any crash between record and commit returns `evidence-gap`; post-commit returns `committed` |                 0 | Returns original durable result | Multi-file write sequence exposes partial authoritative sets requiring permanent unresolved handling |

Executable evidence:

- `spikes/persistence/src/__tests__/sqlite-spike.test.ts`
- `spikes/persistence/src/__tests__/file-journal-spike.test.ts`
- 18 tests pass across both mechanisms.

## Decision

Use SQLite in WAL mode with `synchronous=FULL` as the Local Deployment Profile authoritative mutation adapter.

One database transaction commits:

1. authoritative aggregate record/version;
2. required Event Records;
3. idempotency result bound to `request_key` and intent digest;
4. Mutation Envelope `committed` state.

Acknowledgement occurs only after commit. A repeated request key returns the original result. Different intent under an existing request key returns `conflict`.

## Rationale

SQLite eliminates the normal multi-file partial-commit window while retaining an offline, operator-controlled local authority. The file journal can detect gaps, but it creates them at every inter-file crash boundary and therefore adds reconciliation and incident burden without improving portability or authority clarity.

This is an implementation mechanism, not Domain authority. SQLite files, indexes, WAL, and process state remain replaceable per Architecture section 2 and DM-I03.

## Consequences

- IP-004 implements Evidence Service against a storage port with SQLite as the Local adapter.
- Distributed/operator-hosted adapters remain optional and must pass the same contract and crash outcomes.
- The production adapter must pin and verify SQLite/runtime versions. Node's current `node:sqlite` API is experimental, so adapter containment and compatibility tests are mandatory.
- Filesystem export/Snapshot remains an explicit operation, not the transaction authority.

## Rejected alternative

File journal as authority was rejected because an authoritative record can become durable before required evidence and idempotency state. The architecture permits returning `evidence-gap`, but choosing a mechanism that creates more evidence gaps under ordinary crashes is lower quality than one atomic local transaction.
