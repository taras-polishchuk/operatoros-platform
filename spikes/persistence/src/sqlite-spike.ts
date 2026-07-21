import { DatabaseSync } from 'node:sqlite';

export type SqliteCrashPoint =
  | 'before-prepare'
  | 'after-prepare'
  | 'after-record'
  | 'after-event'
  | 'after-idempotency'
  | 'after-commit'
  | 'after-acknowledge'
  | 'conflicting-intent';

export type ReconciliationOutcome = 'committed' | 'uncommitted' | 'conflict' | 'evidence-gap';

interface ScenarioResult {
  outcome: ReconciliationOutcome;
  acknowledgedLoss: boolean;
  originalResult?: Record<string, unknown>;
  replayedResult?: Record<string, unknown>;
}

const requestKey = 'req_01';
const intentDigest = 'intent_a';
const originalResult = {
  aggregate_ref: 'workspace_01',
  record_version: 1,
  event_ids: ['event_01'],
};

function initialize(database: DatabaseSync): void {
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    CREATE TABLE IF NOT EXISTS aggregate_records (
      aggregate_ref TEXT PRIMARY KEY,
      version INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS event_records (
      event_id TEXT PRIMARY KEY,
      aggregate_ref TEXT NOT NULL,
      aggregate_version INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS idempotency_results (
      request_key TEXT PRIMARY KEY,
      intent_digest TEXT NOT NULL,
      result_json TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS mutation_envelopes (
      mutation_id TEXT PRIMARY KEY,
      request_key TEXT NOT NULL,
      state TEXT NOT NULL
    ) STRICT;
  `);
}

function reconcile(databasePath: string, requestedIntent = intentDigest): ScenarioResult {
  const database = new DatabaseSync(databasePath);
  try {
    initialize(database);
    const idempotency = database
      .prepare('SELECT intent_digest, result_json FROM idempotency_results WHERE request_key = ?')
      .get(requestKey) as { intent_digest: string; result_json: string } | undefined;
    if (idempotency !== undefined && idempotency.intent_digest !== requestedIntent) {
      return { outcome: 'conflict', acknowledgedLoss: false, originalResult };
    }
    const committed = database
      .prepare("SELECT state FROM mutation_envelopes WHERE mutation_id = 'mutation_01'")
      .get() as { state: string } | undefined;
    if (committed?.state === 'committed' && idempotency !== undefined) {
      return {
        outcome: 'committed',
        acknowledgedLoss: false,
        originalResult,
        replayedResult: JSON.parse(idempotency.result_json) as Record<string, unknown>,
      };
    }
    const partialCount = (
      database
        .prepare(
          `SELECT
            (SELECT COUNT(*) FROM aggregate_records) +
            (SELECT COUNT(*) FROM event_records) +
            (SELECT COUNT(*) FROM idempotency_results) AS count`,
        )
        .get() as { count: number }
    ).count;
    return {
      outcome: partialCount > 0 ? 'evidence-gap' : 'uncommitted',
      acknowledgedLoss: false,
      originalResult,
    };
  } finally {
    database.close();
  }
}

export function runSqliteScenario(
  databasePath: string,
  crashPoint: SqliteCrashPoint,
): ScenarioResult {
  if (crashPoint === 'conflicting-intent') {
    runCommittedTransaction(databasePath);
    return reconcile(databasePath, 'intent_b');
  }
  if (crashPoint === 'before-prepare') return reconcile(databasePath);

  const database = new DatabaseSync(databasePath);
  initialize(database);
  let closed = false;
  database.exec('BEGIN IMMEDIATE');
  try {
    database
      .prepare('INSERT INTO mutation_envelopes VALUES (?, ?, ?)')
      .run('mutation_01', requestKey, 'prepared');
    if (crashPoint === 'after-prepare') {
      database.exec('ROLLBACK');
      closed = true;
      return reconcileAfterClose(database, databasePath);
    }

    database.prepare('INSERT INTO aggregate_records VALUES (?, ?)').run('workspace_01', 1);
    if (crashPoint === 'after-record') {
      database.exec('ROLLBACK');
      closed = true;
      return reconcileAfterClose(database, databasePath);
    }

    database
      .prepare('INSERT INTO event_records VALUES (?, ?, ?)')
      .run('event_01', 'workspace_01', 1);
    if (crashPoint === 'after-event') {
      database.exec('ROLLBACK');
      closed = true;
      return reconcileAfterClose(database, databasePath);
    }

    database
      .prepare('INSERT INTO idempotency_results VALUES (?, ?, ?)')
      .run(requestKey, intentDigest, JSON.stringify(originalResult));
    if (crashPoint === 'after-idempotency') {
      database.exec('ROLLBACK');
      closed = true;
      return reconcileAfterClose(database, databasePath);
    }

    database
      .prepare(
        "UPDATE mutation_envelopes SET state = 'committed' WHERE mutation_id = 'mutation_01'",
      )
      .run();
    database.exec('COMMIT');
  } finally {
    if (!closed) database.close();
  }
  return reconcile(databasePath);
}

function reconcileAfterClose(database: DatabaseSync, databasePath: string): ScenarioResult {
  database.close();
  return reconcile(databasePath);
}

function runCommittedTransaction(databasePath: string): void {
  const database = new DatabaseSync(databasePath);
  try {
    initialize(database);
    database.exec('BEGIN IMMEDIATE');
    database
      .prepare('INSERT INTO mutation_envelopes VALUES (?, ?, ?)')
      .run('mutation_01', requestKey, 'committed');
    database.prepare('INSERT INTO aggregate_records VALUES (?, ?)').run('workspace_01', 1);
    database
      .prepare('INSERT INTO event_records VALUES (?, ?, ?)')
      .run('event_01', 'workspace_01', 1);
    database
      .prepare('INSERT INTO idempotency_results VALUES (?, ?, ?)')
      .run(requestKey, intentDigest, JSON.stringify(originalResult));
    database.exec('COMMIT');
  } finally {
    database.close();
  }
}
