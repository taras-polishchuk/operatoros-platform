# Core evidence and workflow entities

This is the canonical evidence and workflow entity model. It captures the ten
records that the Evidence Service, Workspace Service, and Execution Service
coordinate around: the durable Mission Record, the active Run, the immutable
Event Record, the Mutation Envelope, the two Workspace aggregates, the
operator-attribution record, the Capability Grant, the Secret Reference, and
the Recovery Lease.

```mermaid
classDiagram
  class MissionRecord {
    +mission_record_ref: string
    +run_ref: string
    +spec_version: string
    +state: terminal_state
    +evidence_index: string[]
    +subject_identity_ref: string
    +sealed_at: ISO8601
    +integrity_digest: string
  }

  class RunRecord {
    +run_ref: string
    +mission_execution_spec_ref: string
    +state: run_state
    +run_state_version: number
    +cursor: number
    +checkpoint_ref: string?
    +operator_profile_ref: string
    +started_at: ISO8601
    +terminal_at: ISO8601?
  }

  class EvidenceEvent {
    +event_id: string
    +event_type: string
    +event_type_version: string
    +aggregate_ref: string
    +causation_ref: string?
    +correlation_ref: string?
    +payload_digest: string
    +integrity_digest: string
    +recorded_at: ISO8601
    +subject_identity_ref: string
  }

  class MutationEnvelope {
    +mutation_id: string
    +command_id: string
    +request_key: string
    +coordinator_component: string
    +aggregate_ref: string
    +expected_version: number
    +intended_record_version: number
    +required_event_ids: string[]
    +idempotency_result_digest: string
    +state: envelope_state
    +prepared_at: ISO8601
    +committed_at: ISO8601?
    +acknowledged_at: ISO8601?
  }

  class WorkspaceAggregate {
    +workspace_ref: string
    +root_path: string
    +subject_identity_ref: string
    +active_spec_ref: string
    +configuration_revision_ref: string
    +content_history_digest: string
    +initialized_at: ISO8601
  }

  class ArtifactAggregate {
    +artifact_ref: string
    +workspace_ref: string
    +schema: string
    +lifecycle: artifact_lifecycle
    +content_history_identity: string
    +provenance_ref: string
    +content_digest: string
    +created_at: ISO8601
  }

  class OperatorProfile {
    +operator_profile_ref: string
    +identity_ref: string
    +deployment_profile: string
    +authorization_subject_ref: string
    +isolation_tier: T1|T2|T3
    +linked_at: ISO8601
  }

  class CapabilityGrant {
    +grant_id: string
    +subject_ref: string
    +capability_definition_ref: string
    +scope: string
    +workspace_ref: string
    +valid_from: ISO8601
    +valid_until: ISO8601
    +revoked_at: ISO8601?
  }

  class SecretReference {
    +secret_ref: string
    +backend: string
    +path: string
    +placeholder: string
    +workspace_ref: string
    +issued_at: ISO8601
    +preview_only: boolean
  }

  class RecoveryLease {
    +lease_id: string
    +fencing_token: string
    +aggregate_ref: string
    +holder_ref: string
    +acquired_at: ISO8601
    +expires_at: ISO8601
    +contender_resolution: lexicographic_smaller_wins
  }

  %% relationships
  MissionRecord "1" --> "1" RunRecord : seals evidence_index
  MissionRecord "1" o-- "*" EvidenceEvent : references
  MissionRecord "1" --> "1" MutationEnvelope : committed_via
  RunRecord "1" --> "1" WorkspaceAggregate : executes_in
  RunRecord "1" --> "1" OperatorProfile : attributed_to
  RunRecord "1" --> "1" MissionExecutionSpec : bound_to
  RunRecord "1" --> "0..1" ArtifactAggregate : checkpoint_is
  WorkspaceAggregate "1" *-- "*" ArtifactAggregate : owns
  WorkspaceAggregate "1" --> "1" OperatorProfile : scoped_by
  CapabilityGrant "*" --> "1" OperatorProfile : authorizes
  CapabilityGrant "*" --> "1" WorkspaceAggregate : scoped_to
  SecretReference "*" --> "1" WorkspaceAggregate : scoped_to
  RecoveryLease "1" --> "1" WorkspaceAggregate : guards
  RecoveryLease "1" --> "1" OperatorProfile : held_by
  MutationEnvelope "1" --> "*" EvidenceEvent : requires (required_event_ids)
```

## Reading notes

- **MissionRecord** is the authoritative evidence index for one Run. It is
  sealed at terminal state and references every EvidenceEvent by digest.
- **RunRecord** is the active state machine; it is the only owner of Run
  transitions and exposes optimistic concurrency via `run_state_version`.
- **EvidenceEvent** is immutable, secret-free, and digest-bearing. The
  `payload_digest` + `integrity_digest` pair supports tamper detection.
- **MutationEnvelope** is the implementation-level acknowledgement protocol.
  It is not a Domain entity and owns no business truth; it makes command
  acknowledgement and reconciliation deterministic.
- **WorkspaceAggregate** is the operator-controlled scope owning Artifacts and
  the active Mission Execution Specification.
- **ArtifactAggregate** is the durable content record; it has both provenance
  and content-history identity.
- **OperatorProfile** links one Workspace OS Identity to Platform-local
  preferences and authorization subjects.
- **CapabilityGrant** is a time- and scope-bounded authorization for one
  subject to use one Capability Definition.
- **SecretReference** is a typed pointer to an externally owned secret value;
  the value itself never lives in the Platform.
- **RecoveryLease** is the fencing primitive that prevents zombie contenders
  from double-committing state during recovery.
