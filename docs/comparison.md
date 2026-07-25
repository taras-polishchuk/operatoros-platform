# Comparison with adjacent durable-execution platforms

This comparison positions OperatorOS Platform against four widely deployed
durable-execution and background-job systems. Each row is anchored to a
publicly documented property of the system, not a marketing claim.

| Dimension                  | OperatorOS Platform v1.0                                                                                 | Temporal                                                                                                           | Inngest                                                                                             | BullMQ                                                                            | Trigger.dev v3                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Local-first**            | Yes. Local profile is canonical: isolated workspaces, no network required, SQLite WAL evidence.          | No. The Temporal dev server exists, but production deployments rely on a managed service or self-hosted cluster.   | No. Inngest is a managed service with a self-hosted mode that still requires a persistent backend.  | Yes. BullMQ is a Redis-backed library that runs entirely inside the host process. | No. Trigger.dev is a hosted platform with a self-hosted option that still requires infrastructure. |
| **Evidence ledger**        | Yes. Append-only Event Records, sealed Mission Records, integrity digest, replay-safe.                   | Implicit. Workflow history is queryable but is not a tamper-evident evidence ledger.                               | No. Step events stream into the Inngest dashboard but are not packaged as a sealed evidence object. | No. Job state is read from Redis; no evidence or audit trail primitive.           | No. Run history is observable but is not a sealed evidence record.                                 |
| **Recovery**               | Leases with fencing tokens, lexicographic-smaller-wins dual-contender resolution, atomic checkpoints.    | Workflow determinism + replay; relies on activity retries without fencing leases.                                  | Step retries + checkpoint via `step.run`; no fencing-token primitive.                               | Manual retry / stalled-job recovery; no fencing model.                            | Task retries + concurrency keys; no fencing-token primitive.                                       |
| **Multi-tenant**           | Operator-hosted profile (`hosted-runtime`) with tenant isolation; v1 core is single-tenant per operator. | Yes, via Namespaces, but the tenant model is external to the orchestration engine.                                 | Yes, multi-tenant by design (managed SaaS).                                                         | Single-tenant per Redis instance; multi-tenancy is the caller's responsibility.   | Yes, multi-tenant by design (managed SaaS).                                                        |
| **Capabilities**           | First-class Capability Grant entity: subject / action / scope / time.                                    | No. Authorization is a workflow-level concern, not a primitive.                                                    | No. Authorization is handled via function-level auth.                                               | No. Authorization is the caller's responsibility.                                 | No. Authorization is enforced via run-level permissions.                                           |
| **Hexagonal architecture** | Yes. Contracts package is the only public vocabulary; services are replaceable implementations.          | Partial. SDKs and Workers are pluggable, but the protocol is Cloud-Event-shaped and tightly coupled to the server. | Partial. Functions are pluggable; the event / function contract is fixed.                           | Partial. Workers are pluggable; the queue contract is implicit.                   | Partial. Tasks are pluggable; the run contract is fixed.                                           |

## Notes on terminology

- **Local-first** means the canonical path runs without a network dependency.
  This is true for OperatorOS Platform (Local profile) and BullMQ (in-process
  Redis). It is not true for the managed-default paths of Temporal, Inngest,
  or Trigger.dev.
- **Evidence ledger** here means an append-only, immutable, digest-bearing,
  secret-free record of what was acknowledged. Only OperatorOS Platform treats
  this as a first-class sealed object. The other systems expose history, but
  it is not sealed and is not part of the contract.
- **Recovery** is the primitive used to reconcile state after a crash or
  partition. Only OperatorOS Platform exposes a fencing-lease primitive. The
  other systems rely on retries; correctness under double-contender scenarios
  comes from workflow determinism, not from fencing.
- **Capabilities** is a typed authorization primitive. Only OperatorOS
  Platform exposes Capability Grant as a first-class entity with subject /
  capability-definition / scope / time bounds.
- **Hexagonal** in this context means the domain contract is the only stable
  surface and the transport / persistence adapters are replaceable. OperatorOS
  Platform makes this explicit via the `contracts` package; the other systems
  have SDKs but the protocol boundary is fixed.

## Reading the table

This is a positioning table, not a quality ranking. Temporal, Inngest, BullMQ,
and Trigger.dev are excellent at what they are designed for. OperatorOS
Platform is narrower: it is the right choice when the operator needs a
durable, evidence-ledgered, capability-scoped record of what was authorized
and what was acknowledged, with recovery that survives ambiguity via fencing
rather than determinism.
