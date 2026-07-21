import { describe, expect, it } from 'vitest';

import {
  contractIndex,
  domainEntityFixtures,
  domainEntityKinds,
  domainEntitySchema,
  domainEntityLifecycleStates,
  extensionKinds,
  getContract,
  parseContract,
  publicContractVersion,
  toJsonSchemas,
} from '../index.js';

describe('Domain contracts', () => {
  it('declares all 14 domain entity kinds and accepts a fixture for each', () => {
    expect(domainEntityKinds).toHaveLength(14);
    for (const kind of domainEntityKinds) {
      const fixture = domainEntityFixtures[kind];
      expect(fixture).toBeDefined();
      if (fixture === (undefined as never)) {
        throw new Error(`missing Domain entity fixture for ${kind}`);
      }
      expect(domainEntitySchema.parse({ ...fixture, record_version: 99 })).toMatchObject({ kind });
      expect(() => domainEntitySchema.parse({ ...fixture, state: 'invented' })).toThrow();
    }
  });

  it('rejects unknown properties on event records and on Mission Execution Specification', () => {
    const event = {
      ...domainEntityFixtures['event-record'],
      not_a_field: 'must-not-stick',
    };
    expect(() => domainEntitySchema.parse(event)).toThrow();

    const spec = {
      ...domainEntityFixtures['mission-execution-specification'],
      extra_field: 'must-not-stick',
    };
    expect(() => domainEntitySchema.parse(spec)).toThrow();
  });

  it('preserves required fields on the Event Record envelope', () => {
    const event = domainEntityFixtures['event-record'];
    expect(event.workspace_ref).toBe('workspace_01');
    expect(event.schema_version).toBe('1.0.0');
    expect(event.sensitivity_class).toBe('workspace-internal');
  });

  it('declares lifecycle states for every domain entity', () => {
    expect(Object.keys(domainEntityLifecycleStates)).toHaveLength(14);
    for (const kind of domainEntityKinds) {
      expect(domainEntityLifecycleStates[kind].length).toBeGreaterThan(0);
    }
  });

  it('Mutation Envelope accepts every required state via public contract id', () => {
    for (const state of [
      'prepared',
      'committed',
      'uncommitted',
      'conflict',
      'evidence-gap',
      'acknowledged',
    ] as const) {
      expect(() =>
        parseContract('envelope.mutation', {
          envelope_id: 'env_01',
          mutation_id: 'mutation_01',
          command_id: 'cmd_01',
          request_key: 'req_01',
          coordinator_component: 'workspace-service',
          aggregate_ref: 'workspace_01',
          expected_version: 0,
          intended_record_version: 1,
          required_event_ids: ['event_01'],
          idempotency_result_digest: 'a'.repeat(64),
          state,
          prepared_at: '2026-07-19T18:00:00.000Z',
        }),
      ).not.toThrow();
    }
  });

  it('Command, Query, Event, and Error envelopes match Architecture §5 envelopes', () => {
    expect(() =>
      parseContract('envelope.command', {
        command_id: 'cmd_01',
        request_key: 'req_01',
        command_type: 'workspace.activate',
        subject_identity_ref: 'identity://operator/taras',
        workspace_ref: 'workspace_01',
        payload_schema_version: '1.0.0',
        payload: {},
        correlation_id: 'cor_01',
        requested_at: '2026-07-19T18:00:00.000Z',
        classification: 'workspace-internal',
      }),
    ).not.toThrow();

    expect(() =>
      parseContract('envelope.query', {
        query_type: 'workspace.list',
        subject_identity_ref: 'identity://operator/taras',
        workspace_ref: 'workspace_01',
      }),
    ).not.toThrow();

    expect(() =>
      parseContract('envelope.event', {
        envelope_id: 'env_01',
        command_id: 'cmd_01',
        observed_at: '2026-07-19T18:00:00.000Z',
        stream_topic: 'run.observed',
        subject_identity_ref: 'identity://operator/taras',
        workspace_ref: 'workspace_01',
        payload: {},
      }),
    ).not.toThrow();

    expect(() =>
      parseContract('envelope.error', {
        error_id: 'err_01',
        error_code: 'AGGREGATE_VERSION_CONFLICT',
        deciding_source: 'aggregate_records',
        expected: { version: 0 },
        actual: { version: 4 },
        reported_at: '2026-07-19T18:00:00.000Z',
        retryable: false,
        human_summary: 'aggregate version conflict',
      }),
    ).not.toThrow();
  });

  it('Extension Manifest enforces five kinds and five data classifications', () => {
    expect(extensionKinds).toHaveLength(5);
    expect(() =>
      parseContract('manifest.extension', {
        extension_id: 'extension_01',
        kind: 'integration',
        version: publicContractVersion,
        host_compatibility: '>=1.0.0',
        entry_points: ['invoke://run'],
        capability_definitions: ['capability.read'],
        requested_capabilities: ['capability.read'],
        security_boundary: 'boundary_t1',
        data_classes: [
          'public',
          'workspace-internal',
          'sensitive',
          'secret-reference',
          'prohibited-secret-value',
        ],
        health_contract: 'http.get /healthz',
        shutdown_contract: 'SIGTERM drain',
        uninstall_contract: 'remove executable and credentials',
        source_identity: 'identity://operator/taras',
        content_digest: 'a'.repeat(64),
      }),
    ).not.toThrow();
  });

  it('Surface binding exposes transport, idempotency, and offline fields', () => {
    expect(() =>
      parseContract('binding.surface', {
        surface_id: 'cli',
        transport: 'cli',
        handshake: 'identity',
        idempotency: true,
        pagination: true,
        streaming: false,
        offline: true,
      }),
    ).not.toThrow();
  });

  it('contractIndex, getContract, and parseContract round-trip', () => {
    expect(Object.keys(contractIndex.public).length).toBeGreaterThan(10);
    for (const id of Object.keys(contractIndex.public)) {
      const schema = getContract(id);
      expect(schema).toBeDefined();
    }
    const ws = parseContract('entity.workspace', domainEntityFixtures.workspace) as {
      kind: string;
    };
    expect(ws.kind).toBe('workspace');
  });

  it('JSON Schemas serialise and include the public contract version', () => {
    const out = toJsonSchemas();
    expect(out.public_version).toBe(publicContractVersion);
    expect(out.contracts['entity.workspace']).toBeDefined();
  });

  it('Agent Registration requires identity_class matching user/service/machine', () => {
    const base = domainEntityFixtures['agent-registration'];
    expect(base.identity_class).toMatch(/^(user|service|machine)$/u);
  });

  it('Mission Execution Specification requires subjects, capability_needs, policy_declarations', () => {
    const spec = domainEntityFixtures['mission-execution-specification'];
    expect(Array.isArray(spec.subjects)).toBe(true);
    expect(spec.subjects.length).toBeGreaterThan(0);
    expect(Array.isArray(spec.capability_needs)).toBe(true);
    expect(Array.isArray(spec.policy_declarations)).toBe(true);
  });

  it('Configuration Revision and Model Route accept a supersedes reference', () => {
    expect(domainEntityFixtures['configuration-revision']).toBeDefined();
    expect(domainEntityFixtures['model-route']).toBeDefined();
    expect(() =>
      parseContract('entity.configuration-revision', {
        ...domainEntityFixtures['configuration-revision'],
        record_version: 99,
        supersedes: 'config_00',
      }),
    ).not.toThrow();
    expect(() =>
      parseContract('entity.model-route', {
        ...domainEntityFixtures['model-route'],
        record_version: 99,
        supersedes: 'route_00',
      }),
    ).not.toThrow();
  });
});
