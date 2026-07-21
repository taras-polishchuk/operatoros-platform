import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { runFileJournalScenario, type CrashPoint } from './src/file-journal-spike.js';
import { runSqliteScenario, type SqliteCrashPoint } from './src/sqlite-spike.js';

const reportPath = process.argv[2] ?? 'artifacts/reports/persistence/ip-003-crash-matrix.json';
const crashPoints = [
  'before-prepare',
  'after-prepare',
  'after-record',
  'after-event',
  'after-idempotency',
  'after-commit',
  'after-acknowledge',
] as const;
const temporaryRoot = `/tmp/operatoros-ip003-${String(process.pid)}`;
await mkdir(temporaryRoot, { recursive: true });
const rows = [];

for (const crashPoint of crashPoints) {
  const [fileJournal, sqlite] = await Promise.all([
    runFileJournalScenario(`${temporaryRoot}/file/${crashPoint}`, crashPoint as CrashPoint),
    Promise.resolve(
      runSqliteScenario(`${temporaryRoot}/sqlite-${crashPoint}.db`, crashPoint as SqliteCrashPoint),
    ),
  ]);
  rows.push({ crash_point: crashPoint, file_journal: fileJournal, sqlite });
}

const report = {
  schema_version: 1,
  roadmap: 'IP-003',
  requirement: 'NFR-REL-1',
  validation_obligation: 'AV-O1',
  generated_at: new Date().toISOString(),
  node: process.version,
  rows,
  selected: 'sqlite-wal-full',
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote ${reportPath}`);
