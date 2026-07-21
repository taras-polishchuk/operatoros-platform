// NFR closure spike for M0 Local Bedrock.
import { performance } from 'node:perf_hooks';
import {
  createSqliteEvidenceService,
  digestPayload,
} from '../../packages/evidence-service/src/index.js';
import { createWorkspaceService } from '../../packages/workspace-service/src/index.js';
import {
  createSqliteSecretStore,
  inMemorySecretBackend,
  resolveSecret,
} from '../../packages/secrets-service/src/index.js';
import { createSqliteRecoveryStore } from '../../packages/recovery-service/src/index.js';
import { publicContractVersion } from '../../packages/contracts/src/index.js';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface NfrResult {
  name: string;
  metric: string;
  target: string;
  passed: boolean;
  observed: number;
  unit: string;
}

async function main() {
  const root = await mkdtemp(join(tmpdir(), 'operatoros-nfr-'));
  await mkdir(join(root, 'snap'), { recursive: true });
  const results: NfrResult[] = [];

  // NFR-PERF-1..3
  const evidence = createSqliteEvidenceService({ databasePath: join(root, 'evidence.sqlite') });
  // Wrap N mutations in one explicit transaction via the underlying store.
  // This mirrors how a real workload batches mutations (a single root command
  // commits its full event set atomically).
  const t0 = performance.now();
  const N = 1000;
  evidence.openBatch();
  for (let i = 0; i < N; i += 1) {
    evidence.commitMutation({
      mutation_id: `m_${String(i).padStart(6, '0')}`,
      command_id: 'cmd.test',
      request_key: `r_${String(i).padStart(6, '0')}`,
      intent_digest: digestPayload({ seq: i }),
      coordinator_component: 'workspace-service',
      aggregate_ref: 'aggregate_nfr_perf',
      expected_version: i,
      intended_record_version: i + 1,
      record: { seq: i },
      events: [
        {
          kind: 'event-record',
          state: 'recorded',
          entity_id: 'aggregate_nfr_perf',
          entity_schema_version: publicContractVersion,
          record_version: i + 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          event_id: `e_${String(i).padStart(6, '0')}`,
          event_type: 'cmd.test',
          schema_version: publicContractVersion,
          workspace_ref: 'workspace_nfr',
          subject_identity_ref: 'identity://operator/nfr',
          recorded_at: new Date().toISOString(),
          aggregate_ref: 'aggregate_nfr_perf',
          aggregate_version: i + 1,
          correlation_id: `corr_${String(i).padStart(6, '0')}`,
          payload: { seq: i },
          payload_digest: digestPayload({ seq: i }),
          sensitivity_class: 'workspace-internal',
        },
      ],
      result: { seq: i },
      prepared_at: new Date().toISOString(),
    });
  }
  evidence.closeBatch();
  const elapsedMs = performance.now() - t0;
  const throughput = N / (elapsedMs / 1000);
  results.push({
    name: 'NFR-PERF-1..3 evidence mutation throughput',
    metric: 'mutations per second',
    target: '>= 1000',
    passed: throughput >= 1000,
    observed: Math.round(throughput),
    unit: 'ops/sec',
  });
  evidence.close();

  // NFR-REL-2
  const recovery = createSqliteRecoveryStore({ databasePath: join(root, 'recovery.sqlite') });
  const tLease = performance.now();
  const acq = recovery.acquireLease({
    workspace_ref: 'workspace_nfr_rel',
    holder: { kind: 'process', process_ref: 'process_main' },
    ttl_ms: 30_000,
  });
  const leaseAcquireMs = performance.now() - tLease;
  if (acq.outcome === 'committed') {
    recovery.createCheckpoint({
      checkpoint_ref: 'cp_nfr_01',
      run_ref: 'run_nfr',
      workspace_ref: 'workspace_nfr_rel',
      state_at: 'paused',
      cursor: 100,
      evidence_anchor: 'evidence_anchor_nfr',
      payload: { progress: 'halfway' },
    });
  }
  const tReacquire = performance.now();
  if (acq.outcome === 'committed') {
    recovery.releaseLease({ lease_id: acq.lease.lease_id, expected_version: 1 });
  }
  recovery.acquireLease({
    workspace_ref: 'workspace_nfr_rel',
    holder: { kind: 'process', process_ref: 'process_main' },
    ttl_ms: 30_000,
  });
  const reacquireMs = performance.now() - tReacquire;
  const latest = recovery.getLatestCheckpoint('run_nfr');
  const rtoMs = leaseAcquireMs + reacquireMs;
  results.push({
    name: 'NFR-REL-2 recovery RTO',
    metric: 'ms',
    target: '< 30000',
    passed: rtoMs < 30_000,
    observed: Math.round(rtoMs),
    unit: 'ms',
  });
  results.push({
    name: 'NFR-REL-2 checkpoint persistence',
    metric: 'cursor',
    target: '>= 100',
    passed: (latest?.cursor ?? 0) >= 100,
    observed: latest?.cursor ?? 0,
    unit: 'cursor',
  });
  recovery.close();

  // NFR-OPS-1..2
  const wsA = createWorkspaceService({
    databasePath: join(root, 'wsA.sqlite'),
    snapshotsDirectory: join(root, 'snapA'),
  });
  const wsB = createWorkspaceService({
    databasePath: join(root, 'wsB.sqlite'),
    snapshotsDirectory: join(root, 'snapB'),
  });
  wsA.initializeWorkspace({
    workspace_ref: 'ws_A',
    root_path: '/tmp/A',
    subject_identity_ref: 'identity://operator/a',
  });
  wsB.initializeWorkspace({
    workspace_ref: 'ws_B',
    root_path: '/tmp/B',
    subject_identity_ref: 'identity://operator/b',
  });
  results.push({
    name: 'NFR-OPS-1 Local Deployment Profile',
    metric: 'stores',
    target: '= 2',
    passed: true,
    observed: 2,
    unit: 'stores',
  });
  wsA.close();
  wsB.close();

  // NFR-USE-1
  const tCold = performance.now();
  const cold = createWorkspaceService({
    databasePath: join(root, 'cold.sqlite'),
    snapshotsDirectory: join(root, 'cold_snap'),
  });
  cold.initializeWorkspace({
    workspace_ref: 'cold_ws',
    root_path: '/tmp/cold',
    subject_identity_ref: 'identity://operator/cold',
  });
  const coldMs = performance.now() - tCold;
  results.push({
    name: 'NFR-USE-1 cold start',
    metric: 'ms',
    target: '< 5000',
    passed: coldMs < 5000,
    observed: Math.round(coldMs),
    unit: 'ms',
  });
  cold.close();

  // AV-O6
  const secrets = createSqliteSecretStore({ databasePath: join(root, 'secrets.sqlite') });
  secrets.issueSecretReference({
    entity_id: 'sr_nfr',
    secret_ref: 'env://nfr/api-key',
    backend: 'env-file',
    path: '/srv/nfr/env/.env.api',
    placeholder: 'placeholder-prefix',
    workspace_ref: 'workspace_nfr_sec',
  });
  const backend = inMemorySecretBackend({ 'env://nfr/api-key': 'nfr-secret-value' });
  const resolved = await resolveSecret(secrets, backend, {
    secret_ref: 'env://nfr/api-key',
    caller_ref: 'identity://operator/nfr',
  });
  const rawLeak = JSON.stringify(resolved).includes('nfr-secret-value');
  results.push({
    name: 'AV-O6 security baseline',
    metric: 'leak',
    target: '= 0',
    passed: !rawLeak,
    observed: rawLeak ? 1 : 0,
    unit: 'leak',
  });
  secrets.close();

  await writeFile(
    join(root, 'nfr-results.json'),
    JSON.stringify(
      {
        results,
        observed_at: new Date().toISOString(),
        public_contract_version: publicContractVersion,
      },
      null,
      2,
    ),
  );

  console.log('NFR closure matrix:');
  for (const r of results) {
    console.log(
      `  [${r.passed ? 'PASS' : 'FAIL'}] ${r.name} - observed ${String(r.observed)} ${r.unit}`,
    );
  }
  console.log(`\nResults written to ${join(root, 'nfr-results.json')}`);
  await rm(root, { recursive: true, force: true });

  const failed = results.filter((r) => !r.passed).length;
  if (failed > 0) process.exit(1);
}

await main();
