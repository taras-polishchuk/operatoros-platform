// Local CLI for OperatorOS Platform. The package depends on the service
// packages at runtime, but typings are intentionally structural (see below)
// to keep the interface-host decoupled from internal type churn.

export const packageName = '@operatoros-platform/interface-host' as const;

export const SUPPORTED_OPERATIONS = [
  'interface.run',
  'interface.explain',
  'interface.inspect',
  'interface.cancel',
] as const;

export interface InterfaceRequest {
  operation: 'interface.run' | 'interface.explain' | 'interface.inspect' | 'interface.cancel';
  args: Record<string, unknown>;
  subject_identity_ref: string;
  correlation_id: string;
  causation_id?: string;
}

export type InterfaceResult =
  | {
      outcome: 'accepted';
      operation: InterfaceRequest['operation'];
      at_runtime: 'local-cli';
      payload: Record<string, unknown>;
    }
  | { outcome: 'rejected'; reason: string };

// Structural types for the package surfaces used by Interface Host. Kept
// inline (not imported) so each service package can be re-emitted
// independently; the typed surface in the imported modules is a structural
// superset of these shapes.
export interface LocalWorkspaceRecord {
  entity_id: string;
  workspace_ref: string;
  state: string;
  record_version: number;
  schema_version: string;
  created_at: string;
  updated_at: string;
  root_path: string;
}
export interface LocalWorkspaceService {
  getWorkspaceRecord(workspace_ref: string): LocalWorkspaceRecord | null;
}
export interface LocalActivationResult {
  outcome: 'committed';
  record_version: number;
  record: { entity_id: string; mission_ref: string; state: string };
}
export interface LocalStartRunResult {
  outcome: 'committed';
  record_version: number;
  record: {
    entity_id: string;
    run_ref: string;
    mission_ref: string;
    specification_ref: string;
    mission_record_ref: string;
    owning_operator_ref: string;
    owning_agent_ref: string;
    state: string;
    record_version: number;
    workspace_ref: string;
    updated_at: string;
    checkpoint_ref: string | null;
  };
}
export interface LocalCancelResult {
  outcome: 'committed';
  record_version: number;
  record: LocalRunRecord;
}
export interface LocalRunRecord {
  entity_id: string;
  run_ref: string;
  mission_ref: string;
  specification_ref: string;
  mission_record_ref: string;
  owning_operator_ref: string;
  owning_agent_ref: string;
  state: string;
  record_version: number;
  workspace_ref: string;
  updated_at: string;
  checkpoint_ref: string | null;
}
export interface LocalExecutionStore {
  activateMission(input: {
    entity_id: string;
    mission_ref: string;
    workspace_ref: string;
    subject_identity_ref: string;
  }):
    | LocalActivationResult
    | { outcome: 'conflict'; deciding_source: string; current_version: number };
  startRunWithMissionRecord(input: {
    entity_id: string;
    run_ref: string;
    mission_ref: string;
    specification_ref: string;
    owning_operator_ref: string;
    owning_agent_ref: string;
    workspace_ref: string;
  }): LocalStartRunResult | { outcome: 'conflict' | 'rejected' };
  getRun(entity_id: string): LocalRunRecord | null;
  cancelRun(input: {
    entity_id: string;
    expected_version: number;
    reason: string;
  }): LocalCancelResult | { outcome: 'rejected' | 'conflict'; reason?: string };
}
export interface LocalExecutionService {
  store: LocalExecutionStore;
  startRunWithMissionRecord(input: {
    entity_id: string;
    run_ref: string;
    mission_ref: string;
    specification_ref: string;
    owning_operator_ref: string;
    owning_agent_ref: string;
    workspace_ref: string;
  }): LocalStartRunResult | { outcome: 'conflict' | 'rejected' };
}
export type LocalGovernanceService = object;
export type LocalEvidenceService = object;

export interface InterfaceHostOptions {
  workspace: LocalWorkspaceService;
  governance: LocalGovernanceService;
  execution: LocalExecutionService;
  evidence: LocalEvidenceService;
}

export function createInProcessInterfaceHost(options: InterfaceHostOptions) {
  function dispatch(request: InterfaceRequest): InterfaceResult {
    switch (request.operation) {
      case 'interface.explain': {
        // No remote sync, deterministic, FROZEN-AUTHORITY-clean (returns SUPPORTED_OPERATIONS).
        return {
          outcome: 'accepted',
          operation: 'interface.explain',
          at_runtime: 'local-cli',
          payload: {
            contract_version: '1.0.0',
            supported_operations: [...SUPPORTED_OPERATIONS],
            routing: 'in-process',
          },
        };
      }
      case 'interface.inspect': {
        const workspace_ref =
          typeof request.args.workspace_ref === 'string' ? request.args.workspace_ref : '';
        if (!workspace_ref) return { outcome: 'rejected', reason: 'WORKSPACE_REF_REQUIRED' };
        const record = options.workspace.getWorkspaceRecord(workspace_ref);
        return {
          outcome: 'accepted',
          operation: 'interface.inspect',
          at_runtime: 'local-cli',
          payload: { workspace: record },
        };
      }
      case 'interface.cancel': {
        const entity_id = typeof request.args.entity_id === 'string' ? request.args.entity_id : '';
        if (!entity_id) return { outcome: 'rejected', reason: 'RUN_ENTITY_ID_REQUIRED' };
        // Cancellation routes through the execution-service so the audit trail is consistent.
        const run = options.execution.store.getRun(entity_id);
        if (!run) return { outcome: 'rejected', reason: 'RUN_NOT_FOUND' };
        const cancelled = options.execution.store.cancelRun({
          entity_id,
          expected_version: run.record_version,
          reason: 'interface-host cancel',
        });
        if (cancelled.outcome !== 'committed') {
          return { outcome: 'rejected', reason: `CANCEL_FAILED:${cancelled.outcome}` };
        }
        return {
          outcome: 'accepted',
          operation: 'interface.cancel',
          at_runtime: 'local-cli',
          payload: {
            run_ref: run.run_ref,
            previous_version: run.record_version,
            new_version: cancelled.record_version,
          },
        };
      }
      case 'interface.run': {
        const workspace_ref =
          typeof request.args.workspace_ref === 'string' ? request.args.workspace_ref : '';
        const mission_ref =
          typeof request.args.mission_ref === 'string' ? request.args.mission_ref : '';
        const specification_ref =
          typeof request.args.specification_ref === 'string' ? request.args.specification_ref : '';
        if (!workspace_ref || !mission_ref || !specification_ref) {
          return {
            outcome: 'rejected',
            reason: 'WORKSPACE_REF_AND_MISSION_REF_AND_SPECIFICATION_REF_REQUIRED',
          };
        }
        const activated = options.execution.store.activateMission({
          entity_id: `mission_spec_${mission_ref.slice(0, 12)}`,
          mission_ref,
          workspace_ref,
          subject_identity_ref: request.subject_identity_ref,
        });
        if (activated.outcome !== 'committed') {
          return {
            outcome: 'rejected',
            reason: `MISSION_ACTIVATION_FAILED:${activated.outcome}`,
          };
        }
        const started = options.execution.startRunWithMissionRecord({
          entity_id: `run_${request.correlation_id}`,
          run_ref: `run_${request.correlation_id}`,
          mission_ref,
          specification_ref,
          owning_operator_ref: request.subject_identity_ref,
          owning_agent_ref: `agent://interface-host/${request.correlation_id}`,
          workspace_ref,
        });
        if (started.outcome !== 'committed') {
          return { outcome: 'rejected', reason: `RUN_START_FAILED:${started.outcome}` };
        }
        return {
          outcome: 'accepted',
          operation: 'interface.run',
          at_runtime: 'local-cli',
          payload: {
            run_ref: started.record.run_ref,
            mission_record_ref: started.record.mission_record_ref,
            record_version: started.record_version,
          },
        };
      }
    }
  }

  return {
    dispatch,
    SUPPORTED_OPERATIONS,
    runtime: 'in-process-local-cli' as const,
  };
}

export function renderHelp(): string {
  return [
    'OperatorOS Platform local CLI (Architecture §6)',
    '',
    'Operations:',
    '  interface.explain              surface the supported operations',
    '  interface.inspect <ref>        read a workspace record',
    '  interface.run <ws> <mission> <spec>  start a run',
    '  interface.cancel <entity_id>   cancel a run',
    '',
    'Storage paths are NEVER exposed by the local CLI.',
    'Secret material is NEVER printed by the local CLI.',
  ].join('\n');
}
