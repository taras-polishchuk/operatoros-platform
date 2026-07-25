# Deployment

## Local profile (default)

Use Local when operator authority and offline determinism matter most. Canonical Workspace operations require no network, fresh profiles emit no telemetry, and evidence uses SQLite WAL with `BEGIN IMMEDIATE` and `synchronous=FULL`. Keep each Workspace's store isolated and protect the filesystem with OS permissions and encryption.

## Hosted contract shape

`@operatoros-platform/hosted-runtime` provides an in-memory multi-tenant routing and isolation contract shape. It is testable repository code, but it is not a bundled, durable, or operationally verified hosted service. Do not present or deploy it as a production hosted profile. A future hosted adapter must add authenticated ingress, durable tenant-isolated storage, operational controls, and explicit Capability Grants without changing the four-component authority model.

## Storage choices

SQLite WAL is the v1.0 Local default. TD-001 records the current `node:sqlite` experimental status and the single-adapter mitigation. An alternative store is permitted by the architecture only when it proves the same mutation-envelope, crash-point, ordering, integrity, and recovery outcomes; see the persistence spike and architecture authority.

## Secret storage

TD-005/v1.0 stores secret material in memory at resolution time and persists only Secret References and 4-character previews. Raw values are never persisted or printed. v1.1 backlog work adds an OS keyring integration.

## Backup and recovery

Back up and restore Workspace state with the application-level snapshot workflow in [`docs/runbooks/WORKSPACE-SNAPSHOT-BACKUP-RESTORE.md`](docs/runbooks/WORKSPACE-SNAPSHOT-BACKUP-RESTORE.md). Do not copy live SQLite files as the acceptance path. `recovery-service` provides checkpoint/snapshot recovery, leases, fencing-token preemption, and dual-contender resolution. A restored instance must not advance with an expired fencing token.

## Observability

v1.0 provides structured logs only. v1.1 backlog work includes OpenTelemetry (OTel). In Local, the evidence ledger—not logs or telemetry—is canonical.

## Performance expectations

Release evidence observed:

| NFR                     | Target              | Observed                                          |
| ----------------------- | ------------------- | ------------------------------------------------- |
| Throughput              | >= 1000 ops/sec     | 3602–4009 ops/sec across three 5000-mutation runs |
| Recovery time objective | < 30000 ms          | 40 ms                                             |
| Local deployment        | isolated workspaces | 2 distinct stores                                 |
| Cold start              | < 5000 ms           | 88 ms                                             |
| Secret value leakage    | none                | none                                              |

These measurements are observed release values, not a promise for every workload or host.
