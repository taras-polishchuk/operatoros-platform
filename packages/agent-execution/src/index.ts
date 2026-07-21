import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import { publicContractVersion } from '@operatoros-platform/contracts';

export const packageName = '@operatoros-platform/agent-execution' as const;

export const SUPPORTED_OPERATIONS = [
  'agent.register',
  'agent.activate',
  'agent.suspend',
  'agent.retire',
  'agent.invoke',
  'agent.record-result',
  'agent.cancel',
] as const;

export interface AgentRegistration {
  entity_id: string;
  agent_id: string;
  typed_responsibility: string;
  identity_class: 'user' | 'service' | 'machine';
  capability_definitions: string[];
  security_boundary_ref: string;
  isolation_tier: 'T0' | 'T1' | 'T2' | 'T3';
  state: 'draft' | 'active' | 'suspended' | 'retired';
  workspace_ref: string;
  record_version: number;
  created_at: string;
  updated_at: string;
}

export interface AgentInvocation {
  invocation_id: string;
  agent_id: string;
  run_ref: string;
  workspace_ref: string;
  capability_needed: string;
  subject_identity_ref: string;
  correlation_id: string;
}

export interface AgentResultRecord {
  invocation_id: string;
  agent_id: string;
  run_ref: string;
  outcome: 'succeeded' | 'failed' | 'cancelled';
  payload: Record<string, unknown>;
  payload_digest: string;
  recorded_at: string;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

const SCHEMA_VERSION = publicContractVersion;

export function createSqliteAgentRegistry(options: { databasePath: string }) {
  const database = new DatabaseSync(options.databasePath);
  database.exec(`
    CREATE TABLE IF NOT EXISTS agent_registrations (
      entity_id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      typed_responsibility TEXT NOT NULL,
      identity_class TEXT NOT NULL,
      capability_definitions TEXT NOT NULL,
      security_boundary_ref TEXT NOT NULL,
      isolation_tier TEXT NOT NULL,
      state TEXT NOT NULL,
      workspace_ref TEXT NOT NULL,
      record_version INTEGER NOT NULL,
      entity_schema_version TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE INDEX IF NOT EXISTS agent_by_state
      ON agent_registrations(workspace_ref, state, agent_id);

    CREATE TABLE IF NOT EXISTS agent_invocations (
      invocation_id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      run_ref TEXT NOT NULL,
      workspace_ref TEXT NOT NULL,
      capability_needed TEXT NOT NULL,
      subject_identity_ref TEXT NOT NULL,
      correlation_id TEXT NOT NULL,
      state TEXT NOT NULL,
      result_digest TEXT,
      recorded_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS agent_results (
      invocation_id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      run_ref TEXT NOT NULL,
      outcome TEXT NOT NULL,
      payload TEXT NOT NULL,
      payload_digest TEXT NOT NULL,
      recorded_at TEXT NOT NULL
    ) STRICT;
  `);

  function registerAgent(input: {
    entity_id: string;
    agent_id: string;
    typed_responsibility: string;
    identity_class: 'user' | 'service' | 'machine';
    capability_definitions: string[];
    security_boundary_ref: string;
    isolation_tier: 'T0' | 'T1' | 'T2' | 'T3';
    workspace_ref: string;
  }):
    | { outcome: 'committed'; record: AgentRegistration }
    | { outcome: 'conflict'; deciding_source: 'aggregate_records' } {
    const existing = database
      .prepare('SELECT entity_id FROM agent_registrations WHERE entity_id = ?')
      .get(input.entity_id);
    if (existing !== undefined) {
      return { outcome: 'conflict', deciding_source: 'aggregate_records' };
    }
    const now = new Date().toISOString();
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(
          `INSERT INTO agent_registrations VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, 1, ?, ?, ?)`,
        )
        .run(
          input.entity_id,
          input.agent_id,
          input.typed_responsibility,
          input.identity_class,
          JSON.stringify(input.capability_definitions.slice().sort()),
          input.security_boundary_ref,
          input.isolation_tier,
          input.workspace_ref,
          SCHEMA_VERSION,
          now,
          now,
        );
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return {
      outcome: 'committed',
      record: {
        entity_id: input.entity_id,
        agent_id: input.agent_id,
        typed_responsibility: input.typed_responsibility,
        identity_class: input.identity_class,
        capability_definitions: input.capability_definitions,
        security_boundary_ref: input.security_boundary_ref,
        isolation_tier: input.isolation_tier,
        state: 'draft',
        workspace_ref: input.workspace_ref,
        record_version: 1,
        created_at: now,
        updated_at: now,
      },
    };
  }

  function activateAgent(input: {
    entity_id: string;
    expected_version: number;
    required_capability_grants: {
      subject_ref: string;
      capability_definition_ref: string;
    }[];
    governanceStore: {
      listActiveGrantsFor(input: { subject_ref: string }): {
        capability_definition_ref: string;
        state: string;
      }[];
    };
  }):
    | { outcome: 'committed'; record_version: number }
    | { outcome: 'conflict' | 'rejected'; reason?: string } {
    const row = database
      .prepare(
        'SELECT record_version, state, capability_definitions FROM agent_registrations WHERE entity_id = ?',
      )
      .get(input.entity_id) as
      { record_version: number; state: string; capability_definitions: string } | undefined;
    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
    if (!row || row.record_version !== input.expected_version) {
      return { outcome: 'conflict', reason: 'AGENT_VERSION_MISMATCH' };
    }
    if (row.state !== 'draft') {
      return { outcome: 'rejected', reason: 'AGENT_NOT_DRAFT' };
    }
    // Verify all required capability grants exist (the agent can ONLY be
    // activated if every capability it declares has at least one active grant
    // for the subject it runs under).
    const declared: string[] = JSON.parse(row.capability_definitions) as string[];
    const subjects = Array.from(
      new Set(input.required_capability_grants.map((g) => g.subject_ref)),
    );
    for (const subject_ref of subjects) {
      const grants = input.governanceStore.listActiveGrantsFor({ subject_ref });
      const granted = new Set(
        grants.filter((g) => g.state === 'active').map((g) => g.capability_definition_ref),
      );
      for (const cap of declared) {
        if (!granted.has(cap)) {
          return { outcome: 'rejected', reason: `CAPABILITY_GRANT_MISSING:${cap}` };
        }
      }
    }
    const now = new Date().toISOString();
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(
          `UPDATE agent_registrations SET state = 'active', record_version = record_version + 1, updated_at = ? WHERE entity_id = ?`,
        )
        .run(now, input.entity_id);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return { outcome: 'committed', record_version: input.expected_version + 1 };
  }

  function suspendAgent(input: { entity_id: string; expected_version: number }): {
    outcome: 'committed' | 'rejected';
    reason?: string;
    record_version?: number;
  } {
    const row = database
      .prepare('SELECT record_version, state FROM agent_registrations WHERE entity_id = ?')
      .get(input.entity_id) as { record_version: number; state: string } | undefined;
    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
    if (!row || row.record_version !== input.expected_version) {
      return { outcome: 'rejected', reason: 'AGENT_VERSION_MISMATCH' };
    }
    if (row.state !== 'active') {
      return { outcome: 'rejected', reason: 'AGENT_NOT_ACTIVE' };
    }
    const now = new Date().toISOString();
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(
          `UPDATE agent_registrations SET state = 'suspended', record_version = record_version + 1, updated_at = ? WHERE entity_id = ?`,
        )
        .run(now, input.entity_id);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return { outcome: 'committed', record_version: input.expected_version + 1 };
  }

  function retireAgent(input: { entity_id: string; expected_version: number }): {
    outcome: 'committed' | 'rejected';
    reason?: string;
    record_version?: number;
  } {
    const row = database
      .prepare('SELECT record_version, state FROM agent_registrations WHERE entity_id = ?')
      .get(input.entity_id) as { record_version: number; state: string } | undefined;
    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
    if (!row || row.record_version !== input.expected_version) {
      return { outcome: 'rejected', reason: 'AGENT_VERSION_MISMATCH' };
    }
    if (row.state === 'retired') {
      return { outcome: 'rejected', reason: 'AGENT_ALREADY_RETIRED' };
    }
    const now = new Date().toISOString();
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(
          `UPDATE agent_registrations SET state = 'retired', record_version = record_version + 1, updated_at = ? WHERE entity_id = ?`,
        )
        .run(now, input.entity_id);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return { outcome: 'committed', record_version: input.expected_version + 1 };
  }

  function invokeAgent(input: {
    invocation_id: string;
    agent_id: string;
    run_ref: string;
    workspace_ref: string;
    capability_needed: string;
    subject_identity_ref: string;
    correlation_id: string;
  }): { outcome: 'committed' | 'rejected'; reason?: string; invocation?: AgentInvocation } {
    const agent = database
      .prepare(
        'SELECT agent_id, capability_definitions, state FROM agent_registrations WHERE agent_id = ?',
      )
      .get(input.agent_id) as
      { agent_id: string; capability_definitions: string; state: string } | undefined;
    if (!agent) {
      return { outcome: 'rejected', reason: 'AGENT_NOT_REGISTERED' };
    }
    if (agent.state !== 'active') {
      return { outcome: 'rejected', reason: 'AGENT_NOT_ACTIVE' };
    }
    const declared: string[] = JSON.parse(agent.capability_definitions) as string[];
    if (!declared.includes(input.capability_needed)) {
      return { outcome: 'rejected', reason: 'CAPABILITY_NOT_DECLARED' };
    }
    const existing = database
      .prepare('SELECT invocation_id FROM agent_invocations WHERE invocation_id = ?')
      .get(input.invocation_id);
    if (existing !== undefined) {
      return { outcome: 'rejected', reason: 'INVOCATION_DUPLICATE' };
    }
    const now = new Date().toISOString();
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(`INSERT INTO agent_invocations VALUES (?, ?, ?, ?, ?, ?, ?, 'invoked', NULL, ?)`)
        .run(
          input.invocation_id,
          input.agent_id,
          input.run_ref,
          input.workspace_ref,
          input.capability_needed,
          input.subject_identity_ref,
          input.correlation_id,
          now,
        );
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return {
      outcome: 'committed',
      invocation: {
        invocation_id: input.invocation_id,
        agent_id: input.agent_id,
        run_ref: input.run_ref,
        workspace_ref: input.workspace_ref,
        capability_needed: input.capability_needed,
        subject_identity_ref: input.subject_identity_ref,
        correlation_id: input.correlation_id,
      },
    };
  }

  function recordAgentResult(input: {
    invocation_id: string;
    outcome: 'succeeded' | 'failed' | 'cancelled';
    payload: Record<string, unknown>;
  }):
    | { outcome: 'committed'; payload_digest: string; recorded_at: string }
    | { outcome: 'rejected'; reason: string } {
    const inv = database
      .prepare('SELECT agent_id, run_ref, state FROM agent_invocations WHERE invocation_id = ?')
      .get(input.invocation_id) as { agent_id: string; run_ref: string; state: string } | undefined;
    if (!inv) {
      return { outcome: 'rejected', reason: 'INVOCATION_NOT_FOUND' };
    }
    if (inv.state !== 'invoked') {
      return { outcome: 'rejected', reason: 'INVOCATION_ALREADY_RECORDED' };
    }
    const now = new Date().toISOString();
    const payloadDigest = digest(input.payload);
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(`INSERT INTO agent_results VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(
          input.invocation_id,
          inv.agent_id,
          inv.run_ref,
          input.outcome,
          JSON.stringify(input.payload),
          payloadDigest,
          now,
        );
      database
        .prepare(
          `UPDATE agent_invocations SET state = 'recorded', result_digest = ? WHERE invocation_id = ?`,
        )
        .run(payloadDigest, input.invocation_id);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return { outcome: 'committed', payload_digest: payloadDigest, recorded_at: now };
  }

  function cancelAgentInvocation(input: { invocation_id: string }): {
    outcome: 'committed' | 'rejected';
    reason?: string;
  } {
    const inv = database
      .prepare('SELECT state FROM agent_invocations WHERE invocation_id = ?')
      .get(input.invocation_id) as { state: string } | undefined;
    if (!inv) {
      return { outcome: 'rejected', reason: 'INVOCATION_NOT_FOUND' };
    }
    if (inv.state !== 'invoked') {
      return { outcome: 'rejected', reason: 'INVOCATION_NOT_INVOKED' };
    }
    const now = new Date().toISOString();
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(
          `UPDATE agent_invocations SET state = 'cancelled', result_digest = ? WHERE invocation_id = ?`,
        )
        .run(`cancel:${now}`, input.invocation_id);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return { outcome: 'committed' };
  }

  function getAgent(entity_id: string): AgentRegistration | null {
    const row = database
      .prepare('SELECT * FROM agent_registrations WHERE entity_id = ?')
      .get(entity_id) as
      | {
          entity_id: string;
          agent_id: string;
          typed_responsibility: string;
          identity_class: AgentRegistration['identity_class'];
          capability_definitions: string;
          security_boundary_ref: string;
          isolation_tier: AgentRegistration['isolation_tier'];
          state: AgentRegistration['state'];
          workspace_ref: string;
          record_version: number;
          created_at: string;
          updated_at: string;
        }
      | undefined;
    if (!row) return null;
    return {
      entity_id: row.entity_id,
      agent_id: row.agent_id,
      typed_responsibility: row.typed_responsibility,
      identity_class: row.identity_class,
      capability_definitions: JSON.parse(row.capability_definitions) as string[],
      security_boundary_ref: row.security_boundary_ref,
      isolation_tier: row.isolation_tier,
      state: row.state,
      workspace_ref: row.workspace_ref,
      record_version: row.record_version,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  function getInvocation(
    invocation_id: string,
  ): { state: string; result_digest: string | null } | null {
    const row = database
      .prepare('SELECT state, result_digest FROM agent_invocations WHERE invocation_id = ?')
      .get(invocation_id) as { state: string; result_digest: string | null } | undefined;
    if (!row) return null;
    return row;
  }

  return {
    registerAgent,
    activateAgent,
    suspendAgent,
    retireAgent,
    invokeAgent,
    recordAgentResult,
    cancelAgentInvocation,
    getAgent,
    getInvocation,
    close: () => {
      database.close();
    },
  };
}
