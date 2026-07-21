import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export const publicContractVersion = '1.0.0' as const;

const dataClassificationValues = [
  'public',
  'workspace-internal',
  'sensitive',
  'secret-reference',
  'prohibited-secret-value',
] as const;
const dataClassification = z.enum(dataClassificationValues);

const nonEmptyString = z.string().min(1);
const timestamp = z.string().datetime({ offset: true });
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const identityReference = z.string().regex(/^(identity|service|machine):\/\//);
const workspaceReference = z.string().regex(/^workspace[_:/-]/);
const recordVersion = z.number().int().nonnegative();
const referenceList = z.array(nonEmptyString).default([]);

const baseEntity = {
  entity_id: nonEmptyString,
  // Note: the Event Record envelope (Architecture §5.3) defines its own
  // semver `schema_version` describing the payload schema in effect. Entity
  // records inherit the public contract version via this field.
  entity_schema_version: z.literal(publicContractVersion),
  workspace_ref: workspaceReference,
  record_version: recordVersion,
  created_at: timestamp,
  updated_at: timestamp,
  supersedes: nonEmptyString.optional(),
} as const;

const operatorProfileSchema = z
  .object({
    ...baseEntity,
    kind: z.literal('operator-profile'),
    state: z.enum(['draft', 'active', 'suspended', 'archived']),
    identity_ref: identityReference,
  })
  .strict();

const workspaceSchema = z
  .object({
    ...baseEntity,
    kind: z.literal('workspace'),
    state: z.enum(['initialized', 'active', 'archived', 'superseded']),
    root: nonEmptyString,
    successor: nonEmptyString.optional(),
  })
  .strict();

const artifactSchema = z
  .object({
    ...baseEntity,
    kind: z.literal('artifact'),
    state: z.enum(['draft', 'validated', 'active', 'superseded', 'archived']),
    artifact_kind: nonEmptyString,
    content_ref: nonEmptyString,
    supersedes: nonEmptyString.optional(),
  })
  .strict();

const missionExecutionSpecificationSchema = z
  .object({
    ...baseEntity,
    kind: z.literal('mission-execution-specification'),
    state: z.enum(['draft', 'validated', 'active', 'paused', 'retired']),
    mission_ref: nonEmptyString,
    acceptance_conditions: z.array(nonEmptyString).min(1),
    subjects: z.array(z.string().min(1)).min(1),
    capability_needs: z.array(nonEmptyString).default([]),
    policy_declarations: referenceList,
  })
  .strict();

const runSchema = z
  .object({
    ...baseEntity,
    kind: z.literal('run'),
    state: z.enum([
      'queued',
      'running',
      'paused',
      'interrupted',
      'recovering',
      'succeeded',
      'failed',
      'cancelled',
      'expired',
    ]),
    mission_ref: nonEmptyString,
    specification_ref: nonEmptyString,
    mission_record_ref: nonEmptyString.optional(),
    checkpoint_ref: nonEmptyString.optional(),
    owning_operator_ref: identityReference,
    owning_agent_ref: identityReference.optional(),
    initiated_by_command_id: nonEmptyString,
    started_at: timestamp,
    terminal_at: timestamp.optional(),
    terminal_event_id: nonEmptyString.optional(),
    resume_cursor: nonEmptyString.optional(),
  })
  .strict();

const missionRecordSchema = z
  .object({
    ...baseEntity,
    kind: z.literal('mission-record'),
    state: z.enum(['open', 'sealing', 'sealed', 'corrected']),
    run_ref: nonEmptyString,
    created_event_id: nonEmptyString,
    terminal_event_id: nonEmptyString.optional(),
    terminal_outcome: z.enum(['succeeded', 'failed', 'cancelled']).optional(),
    referenced_artifact_refs: referenceList,
    pinned_policy_refs: referenceList,
    integrity_digest: sha256.optional(),
    supersedes: nonEmptyString.optional(),
  })
  .strict();

const agentRegistrationSchema = z
  .object({
    ...baseEntity,
    kind: z.literal('agent-registration'),
    state: z.enum(['draft', 'active', 'suspended', 'retired']),
    agent_id: nonEmptyString,
    typed_responsibility: nonEmptyString,
    identity_class: z.enum(['user', 'service', 'machine']),
    capability_definitions: referenceList,
    security_boundary_ref: nonEmptyString,
    isolation_tier: z.enum(['T0', 'T1', 'T2', 'T3']),
  })
  .strict();

const extensionInstallationSchema = z
  .object({
    ...baseEntity,
    kind: z.literal('extension-installation'),
    state: z.enum(['staged', 'validated', 'active', 'suspended', 'retired']),
    extension_id: nonEmptyString,
    extension_kind: z.enum(['plugin', 'integration', 'dashboard', 'telemetry-exporter', 'adapter']),
    manifest_ref: nonEmptyString,
    content_digest: sha256,
    host_compatibility: z.string().min(1),
    capability_definitions: referenceList,
    requested_capabilities: referenceList,
    security_boundary_ref: nonEmptyString,
    successor: nonEmptyString.optional(),
  })
  .strict();

const capabilityGrantSchema = z
  .object({
    ...baseEntity,
    kind: z.literal('capability-grant'),
    state: z.enum(['draft', 'active', 'suspended', 'revoked']),
    grant_id: nonEmptyString,
    subject_ref: identityReference,
    capability_definition_ref: nonEmptyString,
    scope: z.string().min(1),
    granted_at: timestamp,
    expires_at: timestamp.optional(),
    revoker_ref: identityReference.optional(),
    successor: nonEmptyString.optional(),
  })
  .strict();

const scheduleSchema = z
  .object({
    ...baseEntity,
    kind: z.literal('schedule'),
    state: z.enum(['draft', 'armed', 'paused', 'expired', 'retired']),
    schedule_id: nonEmptyString,
    spec_ref: nonEmptyString,
    trigger: z.string().min(1),
    timezone_policy: z.string().min(1),
    guard_policy: z.string().min(1),
    approval_policy: z.string().min(1),
    next_fire_at: timestamp.optional(),
    last_fired_at: timestamp.optional(),
  })
  .strict();

const secretReferenceSchema = z
  .object({
    ...baseEntity,
    kind: z.literal('secret-reference'),
    state: z.enum(['declared', 'active', 'expired', 'revoked', 'unavailable']),
    secret_ref: nonEmptyString,
    backend_id: nonEmptyString,
    classification: dataClassification,
    allow_purpose: referenceList,
    deny_purpose: referenceList,
    rotation_policy: nonEmptyString.optional(),
    expires_at: timestamp.optional(),
  })
  .strict();

const modelRouteSchema = z
  .object({
    ...baseEntity,
    kind: z.literal('model-route'),
    state: z.enum(['draft', 'active', 'suspended', 'superseded', 'retired']),
    route_id: nonEmptyString,
    provider_ref: nonEmptyString,
    model_id: nonEmptyString,
    availability_policy: z.string().min(1),
    capability_grant_ref: nonEmptyString,
    supersedes: nonEmptyString.optional(),
  })
  .strict();

const configurationRevisionSchema = z
  .object({
    ...baseEntity,
    kind: z.literal('configuration-revision'),
    state: z.enum(['draft', 'validated', 'active', 'superseded', 'retired']),
    config_ref: nonEmptyString,
    scope: z.enum(['deployment-profile', 'workspace', 'mission', 'run']),
    precedence: z.number().int(),
    payload: z.record(z.string(), z.unknown()),
    digest: sha256,
    successor: nonEmptyString.optional(),
  })
  .strict();

const domainEventRecordSchema = z
  .object({
    ...baseEntity,
    kind: z.literal('event-record'),
    state: z.enum(['recorded', 'archived']),
    event_id: nonEmptyString,
    event_type: z.string().min(1),
    schema_version: z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/),
    recorded_at: timestamp,
    subject_identity_ref: identityReference,
    workspace_ref: workspaceReference,
    run_ref: nonEmptyString.optional(),
    command_id: nonEmptyString.optional(),
    aggregate_ref: nonEmptyString,
    aggregate_version: recordVersion,
    correlation_id: nonEmptyString,
    causation_id: nonEmptyString.optional(),
    payload: z.record(z.string(), z.unknown()),
    payload_digest: sha256,
    sensitivity_class: dataClassification,
  })
  .strict();

export { domainEventRecordSchema as eventRecordSchema };

const domainEntitySchemas = {
  'operator-profile': operatorProfileSchema,
  workspace: workspaceSchema,
  artifact: artifactSchema,
  'mission-execution-specification': missionExecutionSpecificationSchema,
  run: runSchema,
  'mission-record': missionRecordSchema,
  'agent-registration': agentRegistrationSchema,
  'extension-installation': extensionInstallationSchema,
  'capability-grant': capabilityGrantSchema,
  schedule: scheduleSchema,
  'secret-reference': secretReferenceSchema,
  'model-route': modelRouteSchema,
  'configuration-revision': configurationRevisionSchema,
  'event-record': domainEventRecordSchema,
} as const;

export const domainEntityKinds = Object.keys(domainEntitySchemas) as [
  keyof typeof domainEntitySchemas,
  ...(keyof typeof domainEntitySchemas)[],
];

export const domainEntitySchema = z.discriminatedUnion(
  'kind',
  Object.values(domainEntitySchemas) as never,
);

export const domainEntityFixtures = {
  'operator-profile': operatorProfileSchema.parse({
    kind: 'operator-profile',
    entity_id: 'op_01',
    entity_schema_version: publicContractVersion,
    workspace_ref: 'workspace_01',
    record_version: 1,
    created_at: '2026-07-19T18:00:00.000Z',
    updated_at: '2026-07-19T18:00:00.000Z',
    state: 'active',
    identity_ref: 'identity://operator/taras',
  }),
  workspace: workspaceSchema.parse({
    kind: 'workspace',
    entity_id: 'ws_01',
    entity_schema_version: publicContractVersion,
    workspace_ref: 'workspace_01',
    record_version: 1,
    created_at: '2026-07-19T18:00:00.000Z',
    updated_at: '2026-07-19T18:00:00.000Z',
    state: 'active',
    root: '/srv/ws/01',
  }),
  artifact: artifactSchema.parse({
    kind: 'artifact',
    entity_id: 'artifact_01',
    entity_schema_version: publicContractVersion,
    workspace_ref: 'workspace_01',
    record_version: 1,
    created_at: '2026-07-19T18:00:00.000Z',
    updated_at: '2026-07-19T18:00:00.000Z',
    state: 'validated',
    artifact_kind: 'specification',
    content_ref: '/srv/ws/01/spec.json',
  }),
  'mission-execution-specification': missionExecutionSpecificationSchema.parse({
    kind: 'mission-execution-specification',
    entity_id: 'spec_01',
    entity_schema_version: publicContractVersion,
    workspace_ref: 'workspace_01',
    record_version: 1,
    created_at: '2026-07-19T18:00:00.000Z',
    updated_at: '2026-07-19T18:00:00.000Z',
    state: 'validated',
    mission_ref: 'mission_01',
    acceptance_conditions: ['all obligations met'],
    subjects: ['identity://operator/taras'],
    capability_needs: ['capability.review'],
  }),
  run: runSchema.parse({
    kind: 'run',
    entity_id: 'run_01',
    entity_schema_version: publicContractVersion,
    workspace_ref: 'workspace_01',
    record_version: 0,
    created_at: '2026-07-19T18:00:00.000Z',
    updated_at: '2026-07-19T18:00:00.000Z',
    state: 'queued',
    mission_ref: 'mission_01',
    specification_ref: 'spec_01',
    owning_operator_ref: 'identity://operator/taras',
    initiated_by_command_id: 'cmd_01',
    started_at: '2026-07-19T18:00:00.000Z',
  }),
  'mission-record': missionRecordSchema.parse({
    kind: 'mission-record',
    entity_id: 'record_01',
    entity_schema_version: publicContractVersion,
    workspace_ref: 'workspace_01',
    record_version: 1,
    created_at: '2026-07-19T18:00:00.000Z',
    updated_at: '2026-07-19T18:00:00.000Z',
    state: 'open',
    run_ref: 'run_01',
    created_event_id: 'event_01',
  }),
  'agent-registration': agentRegistrationSchema.parse({
    kind: 'agent-registration',
    entity_id: 'agent_01',
    entity_schema_version: publicContractVersion,
    workspace_ref: 'workspace_01',
    record_version: 1,
    created_at: '2026-07-19T18:00:00.000Z',
    updated_at: '2026-07-19T18:00:00.000Z',
    state: 'active',
    agent_id: 'agent.reviewer',
    typed_responsibility: 'review',
    identity_class: 'service',
    capability_definitions: ['capability.review'],
    security_boundary_ref: 'boundary_t1',
    isolation_tier: 'T1',
  }),
  'extension-installation': extensionInstallationSchema.parse({
    kind: 'extension-installation',
    entity_id: 'extension_01',
    entity_schema_version: publicContractVersion,
    workspace_ref: 'workspace_01',
    record_version: 1,
    created_at: '2026-07-19T18:00:00.000Z',
    updated_at: '2026-07-19T18:00:00.000Z',
    state: 'validated',
    extension_id: 'extension.reviewer',
    extension_kind: 'plugin',
    manifest_ref: 'manifest_01',
    content_digest: 'a'.repeat(64),
    host_compatibility: '>=1.0.0',
    capability_definitions: ['capability.review'],
    requested_capabilities: ['capability.review'],
    security_boundary_ref: 'boundary_t1',
  }),
  'capability-grant': capabilityGrantSchema.parse({
    kind: 'capability-grant',
    entity_id: 'grant_01',
    entity_schema_version: publicContractVersion,
    workspace_ref: 'workspace_01',
    record_version: 1,
    created_at: '2026-07-19T18:00:00.000Z',
    updated_at: '2026-07-19T18:00:00.000Z',
    state: 'active',
    grant_id: 'grant_01',
    subject_ref: 'identity://operator/taras',
    capability_definition_ref: 'capability.review',
    scope: 'workspace:workspace_01',
    granted_at: '2026-07-19T18:00:00.000Z',
  }),
  schedule: scheduleSchema.parse({
    kind: 'schedule',
    entity_id: 'schedule_01',
    entity_schema_version: publicContractVersion,
    workspace_ref: 'workspace_01',
    record_version: 1,
    created_at: '2026-07-19T18:00:00.000Z',
    updated_at: '2026-07-19T18:00:00.000Z',
    state: 'armed',
    schedule_id: 'schedule_01',
    spec_ref: 'spec_01',
    trigger: 'manual',
    timezone_policy: 'UTC',
    guard_policy: 'no-overlap',
    approval_policy: 'operator-only',
  }),
  'secret-reference': secretReferenceSchema.parse({
    kind: 'secret-reference',
    entity_id: 'secret_01',
    entity_schema_version: publicContractVersion,
    workspace_ref: 'workspace_01',
    record_version: 1,
    created_at: '2026-07-19T18:00:00.000Z',
    updated_at: '2026-07-19T18:00:00.000Z',
    state: 'declared',
    secret_ref: 'secret://api-key/openai',
    backend_id: 'env://OP_API_KEY',
    classification: 'secret-reference',
  }),
  'model-route': modelRouteSchema.parse({
    kind: 'model-route',
    entity_id: 'route_01',
    entity_schema_version: publicContractVersion,
    workspace_ref: 'workspace_01',
    record_version: 1,
    created_at: '2026-07-19T18:00:00.000Z',
    updated_at: '2026-07-19T18:00:00.000Z',
    state: 'active',
    route_id: 'route_01',
    provider_ref: 'provider.openai',
    model_id: 'gpt-4o',
    availability_policy: 'p95 <= 200ms',
    capability_grant_ref: 'grant_01',
  }),
  'configuration-revision': configurationRevisionSchema.parse({
    kind: 'configuration-revision',
    entity_id: 'config_01',
    entity_schema_version: publicContractVersion,
    workspace_ref: 'workspace_01',
    record_version: 1,
    created_at: '2026-07-19T18:00:00.000Z',
    updated_at: '2026-07-19T18:00:00.000Z',
    state: 'active',
    config_ref: 'config_01',
    scope: 'workspace',
    precedence: 100,
    payload: { strict: true },
    digest: 'b'.repeat(64),
  }),
  'event-record': domainEventRecordSchema.parse({
    kind: 'event-record',
    entity_id: 'event_01',
    entity_schema_version: publicContractVersion,
    workspace_ref: 'workspace_01',
    record_version: 1,
    created_at: '2026-07-19T18:00:00.000Z',
    updated_at: '2026-07-19T18:00:00.000Z',
    state: 'recorded',
    event_id: 'event_01',
    event_type: 'run.created',
    recorded_at: '2026-07-19T18:00:00.000Z',
    subject_identity_ref: 'identity://operator/taras',
    aggregate_ref: 'run_01',
    aggregate_version: 1,
    correlation_id: 'cor_01',
    schema_version: '1.0.0',
    payload: { state: 'queued' },
    payload_digest: 'c'.repeat(64),
    sensitivity_class: 'workspace-internal',
  }),
} as const;

export const extensionKinds = [
  'plugin',
  'integration',
  'dashboard',
  'telemetry-exporter',
  'adapter',
] as const;

const commandSchema = z
  .object({
    command_id: nonEmptyString,
    request_key: nonEmptyString,
    command_type: nonEmptyString,
    subject_identity_ref: identityReference,
    operator_profile_ref: identityReference.optional(),
    capability_grant_ref: identityReference.optional(),
    workspace_ref: workspaceReference,
    target_ref: nonEmptyString.optional(),
    expected_version: recordVersion.optional(),
    payload_schema_version: z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/),
    payload: z.record(z.string(), z.unknown()),
    correlation_id: nonEmptyString,
    causation_id: nonEmptyString.optional(),
    requested_at: timestamp,
    classification: dataClassification.default('workspace-internal'),
  })
  .strict();

const querySchema = z
  .object({
    query_type: nonEmptyString,
    subject_identity_ref: identityReference,
    workspace_ref: workspaceReference,
    filter: z.record(z.string(), z.unknown()).default({}),
    cursor: nonEmptyString.optional(),
    limit: z.number().int().positive().max(1_000).default(50),
    projection_freshness_requirement: z
      .enum(['authoritative', 'rebuildable-projection', 'either'])
      .default('either'),
  })
  .strict();

const eventEnvelopeSchema = z
  .object({
    envelope_id: nonEmptyString,
    command_id: nonEmptyString,
    run_ref: nonEmptyString.optional(),
    observed_at: timestamp,
    stream_topic: nonEmptyString,
    subject_identity_ref: identityReference,
    workspace_ref: workspaceReference,
    payload: z.record(z.string(), z.unknown()),
    classification: dataClassification.default('workspace-internal'),
  })
  .strict();

const errorEnvelopeSchema = z
  .object({
    error_id: nonEmptyString,
    error_code: z.string().regex(/^[A-Z][A-Z0-9_]+$/),
    deciding_source: nonEmptyString,
    expected: z.record(z.string(), z.unknown()).default({}),
    actual: z.record(z.string(), z.unknown()).default({}),
    reported_at: timestamp,
    retryable: z.boolean(),
    human_summary: z.string().min(1),
    machine_details: z.record(z.string(), z.unknown()).default({}),
    classification: dataClassification.default('workspace-internal'),
  })
  .strict();

const mutationEnvelopeSchema = z
  .object({
    envelope_id: nonEmptyString,
    mutation_id: nonEmptyString,
    command_id: nonEmptyString,
    request_key: nonEmptyString,
    coordinator_component: z.enum(['workspace-service', 'execution-service']),
    aggregate_ref: nonEmptyString,
    expected_version: recordVersion,
    intended_record_version: recordVersion,
    required_event_ids: z.array(nonEmptyString).min(1),
    idempotency_result_digest: sha256,
    state: z.enum([
      'prepared',
      'committed',
      'uncommitted',
      'conflict',
      'evidence-gap',
      'acknowledged',
    ]),
    prepared_at: timestamp,
    committed_at: timestamp.optional(),
    acknowledged_at: timestamp.optional(),
    reconciliation: z.string().min(1).optional(),
  })
  .strict();

const extensionManifestSchema = z
  .object({
    extension_id: nonEmptyString,
    kind: z.enum(extensionKinds),
    version: z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/),
    host_compatibility: z.string().min(1),
    entry_points: z.array(nonEmptyString).min(1),
    capability_definitions: referenceList,
    requested_capabilities: referenceList,
    security_boundary: z.string().min(1),
    data_classes: z.array(dataClassification).min(1),
    health_contract: z.string().min(1),
    shutdown_contract: z.string().min(1),
    checkpoint_contract: z.string().min(1).optional(),
    migration_contract: z.string().min(1).optional(),
    uninstall_contract: z.string().min(1),
    source_identity: z.string().min(1),
    content_digest: sha256,
  })
  .strict();

const surfaceBinding = z
  .object({
    surface_id: nonEmptyString,
    transport: z.enum(['cli', 'http', 'sdk', 'telemetry']),
    handshake: z.enum(['none', 'identity', 'service', 'machine']),
    idempotency: z.boolean(),
    pagination: z.boolean(),
    streaming: z.boolean(),
    offline: z.boolean(),
    capability_grant_ref: identityReference.optional(),
  })
  .strict();

export const domainEntityLifecycleStates: Record<
  keyof typeof domainEntitySchemas,
  readonly string[]
> = {
  'operator-profile': ['draft', 'active', 'suspended', 'archived'],
  workspace: ['initialized', 'active', 'archived', 'superseded'],
  artifact: ['draft', 'validated', 'active', 'superseded', 'archived'],
  'mission-execution-specification': ['draft', 'validated', 'active', 'paused', 'retired'],
  run: [
    'queued',
    'running',
    'paused',
    'interrupted',
    'recovering',
    'succeeded',
    'failed',
    'cancelled',
    'expired',
  ],
  'mission-record': ['open', 'sealing', 'sealed', 'corrected'],
  'agent-registration': ['draft', 'active', 'suspended', 'retired'],
  'extension-installation': ['staged', 'validated', 'active', 'suspended', 'retired'],
  'capability-grant': ['draft', 'active', 'suspended', 'revoked'],
  schedule: ['draft', 'armed', 'paused', 'expired', 'retired'],
  'secret-reference': ['declared', 'active', 'expired', 'revoked', 'unavailable'],
  'model-route': ['draft', 'active', 'suspended', 'superseded', 'retired'],
  'configuration-revision': ['draft', 'validated', 'active', 'superseded', 'retired'],
  'event-record': ['recorded', 'archived'],
};

export const compatibilityMetadata = {
  schema_version: 1,
  contract_version: publicContractVersion,
  ranges: [
    { id: 'FR-CLI-1', from: '1.0.0', to: '1.0.x' },
    { id: 'FR-CLI-2', from: '1.0.0', to: '1.0.x' },
    { id: 'FR-CLI-3', from: '1.0.0', to: '1.0.x' },
    { id: 'FR-CLI-4', from: '1.0.0', to: '1.0.x' },
    { id: 'FR-WE-1', from: '1.0.0', to: '1.0.x' },
    { id: 'FR-WE-2', from: '1.0.0', to: '1.0.x' },
    { id: 'FR-WE-3', from: '1.0.0', to: '1.0.x' },
    { id: 'FR-WE-4', from: '1.0.0', to: '1.0.x' },
    { id: 'FR-ME-1', from: '1.0.0', to: '1.0.x' },
    { id: 'FR-ME-2', from: '1.0.0', to: '1.0.x' },
    { id: 'FR-ME-3', from: '1.0.0', to: '1.0.x' },
    { id: 'FR-ME-4', from: '1.0.0', to: '1.0.x' },
    { id: 'FR-RT-1', from: '1.0.0', to: '1.0.x' },
    { id: 'FR-RT-2', from: '1.0.0', to: '1.0.x' },
    { id: 'FR-RT-3', from: '1.0.0', to: '1.0.x' },
    { id: 'FR-RT-4', from: '1.0.0', to: '1.0.x' },
    { id: 'FR-REC-1', from: '1.0.0', to: '1.0.x' },
    { id: 'FR-REC-2', from: '1.0.0', to: '1.0.x' },
    { id: 'FR-REC-3', from: '1.0.0', to: '1.0.x' },
    { id: 'FR-REC-4', from: '1.0.0', to: '1.0.x' },
    { id: 'FR-OBS-1', from: '1.0.0', to: '1.0.x' },
    { id: 'FR-OBS-2', from: '1.0.0', to: '1.0.x' },
    { id: 'FR-OBS-3', from: '1.0.0', to: '1.0.x' },
    { id: 'FR-OBS-4', from: '1.0.0', to: '1.0.x' },
    { id: 'FR-MR-1', from: '1.0.0', to: '1.0.x' },
    { id: 'FR-CFG-1', from: '1.0.0', to: '1.0.x' },
    { id: 'FR-CFG-2', from: '1.0.0', to: '1.0.x' },
    { id: 'FR-CFG-3', from: '1.0.0', to: '1.0.x' },
    { id: 'FR-CFG-4', from: '1.0.0', to: '1.0.x' },
    { id: 'NFR-COMP-1', from: '1.0.0', to: '1.0.x' },
    { id: 'NFR-MIG-1', from: '1.0.0', to: '1.0.x' },
    { id: 'NFR-REL-1', from: '1.0.0', to: '1.0.x' },
    { id: 'NFR-REL-2', from: '1.0.0', to: '1.0.x' },
    { id: 'AV-O1', from: '1.0.0', to: '1.0.x' },
    { id: 'AV-O2', from: '1.0.0', to: '1.0.x' },
    { id: 'AV-O3', from: '1.0.0', to: '1.0.x' },
    { id: 'AV-O4', from: '1.0.0', to: '1.0.x' },
    { id: 'AV-O6', from: '1.0.0', to: '1.0.x' },
    { id: 'AR-R01', from: '1.0.0', to: '1.0.x' },
  ],
} as const;

export const extensionManifestContractVersion = publicContractVersion;

export const contractIndex = {
  schema_version: 1,
  contract_version: publicContractVersion,
  public: {
    'entity.operator-profile': operatorProfileSchema,
    'entity.workspace': workspaceSchema,
    'entity.artifact': artifactSchema,
    'entity.mission-execution-specification': missionExecutionSpecificationSchema,
    'entity.run': runSchema,
    'entity.mission-record': missionRecordSchema,
    'entity.agent-registration': agentRegistrationSchema,
    'entity.extension-installation': extensionInstallationSchema,
    'entity.capability-grant': capabilityGrantSchema,
    'entity.schedule': scheduleSchema,
    'entity.secret-reference': secretReferenceSchema,
    'entity.model-route': modelRouteSchema,
    'entity.configuration-revision': configurationRevisionSchema,
    'entity.event-record': domainEventRecordSchema,
    'envelope.command': commandSchema,
    'envelope.query': querySchema,
    'envelope.event': eventEnvelopeSchema,
    'envelope.error': errorEnvelopeSchema,
    'envelope.mutation': mutationEnvelopeSchema,
    'manifest.extension': extensionManifestSchema,
    'binding.surface': surfaceBinding,
  },
  internal: {
    'envelope.mutation': mutationEnvelopeSchema,
    'manifest.extension': extensionManifestSchema,
    'binding.surface': surfaceBinding,
  },
} as const;

const flatContractRegistry = {
  ...Object.fromEntries(
    Object.entries(domainEntitySchemas).map(([name, schema]) => [`entity.${name}`, schema]),
  ),
  ...contractIndex.public,
} as const;

export const contractRegistry: SchemaMap = flatContractRegistry;

function lookup(id: keyof typeof contractRegistry): z.ZodTypeAny {
  const value = contractRegistry[id];
  if (!value) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion
    throw new Error(`UNSUPPORTED_CONTRACT: ${String(id)}`);
  }
  return value;
}

export function getContract(id: keyof typeof contractRegistry): z.ZodTypeAny {
  return lookup(id);
}

export function parseContract(id: keyof typeof contractRegistry, value: unknown): unknown {
  return lookup(id).parse(value);
}

function asJsonSchema(schema: z.ZodTypeAny, name: string): Record<string, unknown> {
  const out: unknown = zodToJsonSchema(schema as never, { name, target: 'jsonSchema7' });
  const result = out as Record<string, unknown>;
  if (typeof result.title !== 'string') {
    result.title = name;
  }
  return result;
}

type SchemaMap = Record<string, z.ZodTypeAny>;

export function toJsonSchemas(): {
  contracts: Record<string, unknown>;
  public_version: string;
} {
  const contracts: Record<string, unknown> = {};
  for (const [id, schema] of Object.entries(contractRegistry)) {
    contracts[id] = asJsonSchema(schema, id);
  }
  return {
    contracts,
    public_version: publicContractVersion,
  };
}

export type DomainEntityKind = keyof typeof domainEntitySchemas;
export type DomainEntity = z.infer<typeof domainEntitySchema>;
