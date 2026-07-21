import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SUPPORTED_OPERATIONS, createInProcessInterfaceHost, renderHelp } from '../index.js';
import type { InterfaceHostOptions } from '../index.js';
import { createWorkspaceService } from '@operatoros-platform/workspace-service';
import { createGovernanceService } from '@operatoros-platform/governance-service';
import { createExecutionService } from '@operatoros-platform/execution-service';
import { createSqliteEvidenceService } from '@operatoros-platform/evidence-service';

interface Host {
  workspace: ReturnType<typeof createWorkspaceService>;
  governance: ReturnType<typeof createGovernanceService>;
  execution: ReturnType<typeof createExecutionService>;
  evidence: ReturnType<typeof createSqliteEvidenceService>;
  host: ReturnType<typeof createInProcessInterfaceHost>;
  cleanup: () => Promise<void>;
}

const hosts: Host[] = [];

async function makeHost(): Promise<Host> {
  const root = await mkdtemp(join(tmpdir(), 'operatoros-iface-'));
  const snap = join(root, 'snap');
  const evidence = createSqliteEvidenceService({ databasePath: join(root, 'evidence.sqlite') });
  const workspace = createWorkspaceService({
    databasePath: join(root, 'workspace.sqlite'),
    snapshotsDirectory: snap,
  });
  const governance = createGovernanceService({ databasePath: join(root, 'gov.sqlite') });
  const execution = createExecutionService({ databasePath: join(root, 'exec.sqlite'), evidence });
  const host = createInProcessInterfaceHost({
    workspace: workspace as unknown as InterfaceHostOptions['workspace'],
    governance,
    execution: execution as unknown as InterfaceHostOptions['execution'],
    evidence,
  });
  const cleanup = async () => {
    execution.close();
    governance.close();
    workspace.close();
    evidence.close();
    await rm(root, { recursive: true, force: true });
  };
  const ref: Host = { workspace, governance, execution, evidence, host, cleanup };
  hosts.push(ref);
  return ref;
}

beforeEach(() => {
  hosts.length = 0;
});

afterEach(async () => {
  await Promise.all(hosts.splice(0).map((h) => h.cleanup()));
});

describe('IP-009 Interface Host (local CLI)', () => {
  it('declares its supported operations', () => {
    expect(SUPPORTED_OPERATIONS).toContain('interface.run');
    expect(SUPPORTED_OPERATIONS).toContain('interface.explain');
    expect(SUPPORTED_OPERATIONS).toContain('interface.inspect');
    expect(SUPPORTED_OPERATIONS).toContain('interface.cancel');
    const helpText = renderHelp();
    expect(helpText).toContain('OperatorOS Platform local CLI');
  });

  it('explain surfaces the supported operations and never logs storage paths', async () => {
    const ctx = await makeHost();
    const result = ctx.host.dispatch({
      operation: 'interface.explain',
      args: {},
      subject_identity_ref: 'identity://operator/taras',
      correlation_id: 'cor_help_01',
    });
    expect(result.outcome).toBe('accepted');
    if (result.outcome === 'accepted') {
      expect(result.payload.supported_operations).toContain('interface.run');
      expect(result.payload.routing).toBe('in-process');
      expect(JSON.stringify(result)).not.toMatch(/sqlite|sqli.te.wal/u);
    }
  });

  it('inspect returns the workspace record by ref, or rejects when missing', async () => {
    const ctx = await makeHost();
    const noRef = ctx.host.dispatch({
      operation: 'interface.inspect',
      args: {},
      subject_identity_ref: 'identity://operator/taras',
      correlation_id: 'cor_inspect_02',
    });
    expect(noRef).toMatchObject({ outcome: 'rejected', reason: 'WORKSPACE_REF_REQUIRED' });
  });

  it('run activates the mission and starts a run via the in-process host', async () => {
    const ctx = await makeHost();
    const result = ctx.host.dispatch({
      operation: 'interface.run',
      args: {
        workspace_ref: 'workspace_main',
        mission_ref: 'mission_01',
        specification_ref: 'specification_01',
      },
      subject_identity_ref: 'identity://operator/taras',
      correlation_id: 'cor_run_01',
    });
    expect(result.outcome).toBe('accepted');
    if (result.outcome === 'accepted') {
      expect(result.payload).toMatchObject({ run_ref: 'run_cor_run_01' });
      expect(result.payload.mission_record_ref).toMatch(/^mission_record_/);
    }
  });

  it('cancel rejects when the run cannot be found and accepts once a run exists', async () => {
    const ctx = await makeHost();
    const missing = ctx.host.dispatch({
      operation: 'interface.cancel',
      args: { entity_id: 'run_missing' },
      subject_identity_ref: 'identity://operator/taras',
      correlation_id: 'cor_cancel_missing',
    });
    expect(missing).toMatchObject({ outcome: 'rejected', reason: 'RUN_NOT_FOUND' });

    ctx.host.dispatch({
      operation: 'interface.run',
      args: {
        workspace_ref: 'workspace_main',
        mission_ref: 'mission_02',
        specification_ref: 'specification_02',
      },
      subject_identity_ref: 'identity://operator/taras',
      correlation_id: 'cor_run_02',
    });
    const cancelled = ctx.host.dispatch({
      operation: 'interface.cancel',
      args: { entity_id: 'run_cor_run_02' },
      subject_identity_ref: 'identity://operator/taras',
      correlation_id: 'cor_cancel_ok',
    });
    expect(cancelled.outcome).toBe('accepted');
    if (cancelled.outcome === 'accepted') {
      expect(cancelled.payload).toMatchObject({ previous_version: 1, new_version: 2 });
    }
  });

  it('refuses a run request missing its arguments', async () => {
    const ctx = await makeHost();
    const result = ctx.host.dispatch({
      operation: 'interface.run',
      args: { workspace_ref: 'workspace_main' },
      subject_identity_ref: 'identity://operator/taras',
      correlation_id: 'cor_run_bad',
    });
    expect(result).toMatchObject({
      outcome: 'rejected',
      reason: 'WORKSPACE_REF_AND_MISSION_REF_AND_SPECIFICATION_REF_REQUIRED',
    });
  });
});
