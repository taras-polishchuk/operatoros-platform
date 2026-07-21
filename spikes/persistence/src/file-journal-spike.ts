import { access, mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export type CrashPoint =
  | 'before-prepare'
  | 'after-prepare'
  | 'after-record'
  | 'after-event'
  | 'after-idempotency'
  | 'after-commit'
  | 'after-acknowledge'
  | 'inspect-only';

export type ReconciliationOutcome = 'committed' | 'uncommitted' | 'conflict' | 'evidence-gap';

interface ScenarioResult {
  outcome: ReconciliationOutcome;
  acknowledgedLoss: boolean;
  originalResult?: Record<string, unknown>;
  replayedResult?: Record<string, unknown>;
}

const originalResult = {
  aggregate_ref: 'workspace_01',
  record_version: 1,
  event_ids: ['event_01'],
};

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function durableWrite(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  const handle = await open(temporaryPath, 'w');
  try {
    await handle.writeFile(`${JSON.stringify(value)}\n`);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporaryPath, path);
  const directory = await open(dirname(path), 'r');
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}

async function reconcile(root: string): Promise<ScenarioResult> {
  const aggregateDirectory = join(root, 'aggregate');
  const paths = {
    prepared: join(root, 'envelope', 'prepared.json'),
    record: join(aggregateDirectory, 'record.json'),
    event: join(aggregateDirectory, 'event.json'),
    idempotency: join(aggregateDirectory, 'idempotency.json'),
    commit: join(root, 'envelope', 'committed.json'),
    acknowledgement: join(root, 'envelope', 'acknowledged.json'),
  };
  const states = Object.fromEntries(
    await Promise.all(
      Object.entries(paths).map(async ([name, path]) => [name, await exists(path)]),
    ),
  ) as Record<keyof typeof paths, boolean>;
  const allDurable = states.record && states.event && states.idempotency && states.commit;
  const anyDurable = states.record || states.event || states.idempotency || states.commit;

  if (allDurable) {
    const replayedResult = JSON.parse(await readFile(paths.idempotency, 'utf8')) as Record<
      string,
      unknown
    >;
    return {
      outcome: 'committed',
      acknowledgedLoss: false,
      originalResult,
      replayedResult,
    };
  }
  if (anyDurable) {
    return { outcome: 'evidence-gap', acknowledgedLoss: false, originalResult };
  }
  return { outcome: 'uncommitted', acknowledgedLoss: false, originalResult };
}

export async function runFileJournalScenario(
  root: string,
  crashPoint: CrashPoint,
): Promise<ScenarioResult> {
  if (crashPoint === 'inspect-only') return reconcile(root);

  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
  if (crashPoint === 'before-prepare') return reconcile(root);

  await durableWrite(join(root, 'envelope', 'prepared.json'), {
    mutation_id: 'mutation_01',
    state: 'prepared',
  });
  if (crashPoint === 'after-prepare') return reconcile(root);

  await durableWrite(join(root, 'aggregate', 'record.json'), {
    aggregate_ref: 'workspace_01',
    version: 1,
  });
  if (crashPoint === 'after-record') return reconcile(root);

  await durableWrite(join(root, 'aggregate', 'event.json'), {
    event_id: 'event_01',
    aggregate_version: 1,
  });
  if (crashPoint === 'after-event') return reconcile(root);

  await durableWrite(join(root, 'aggregate', 'idempotency.json'), originalResult);
  if (crashPoint === 'after-idempotency') return reconcile(root);

  await durableWrite(join(root, 'envelope', 'committed.json'), {
    mutation_id: 'mutation_01',
    state: 'committed',
  });
  if (crashPoint === 'after-commit') return reconcile(root);

  await writeFile(join(root, 'envelope', 'acknowledged.json'), '{"state":"acknowledged"}\n');
  return reconcile(root);
}
