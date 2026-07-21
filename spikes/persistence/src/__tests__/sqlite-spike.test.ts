import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runSqliteScenario } from '../sqlite-spike.js';

const temporaryDirectories: string[] = [];

async function temporaryDatabase(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'operatoros-sqlite-'));
  temporaryDirectories.push(root);
  return join(root, 'authority.sqlite');
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('IP-003 SQLite bounded spike', () => {
  it.each([
    ['before-prepare', 'uncommitted'],
    ['after-prepare', 'uncommitted'],
    ['after-record', 'uncommitted'],
    ['after-event', 'uncommitted'],
    ['after-idempotency', 'uncommitted'],
    ['after-commit', 'committed'],
    ['after-acknowledge', 'committed'],
  ] as const)('reconciles crash point %s as %s', async (crashPoint, expectedOutcome) => {
    const databasePath = await temporaryDatabase();

    const result = runSqliteScenario(databasePath, crashPoint);

    expect(result.outcome).toBe(expectedOutcome);
    expect(result.acknowledgedLoss).toBe(false);
  });

  it('returns the original committed identity for the same request key after restart', async () => {
    const databasePath = await temporaryDatabase();
    const result = runSqliteScenario(databasePath, 'after-acknowledge');

    expect(result.replayedResult).toEqual(result.originalResult);
  });

  it('reports conflict when the same request key is reused for different intent', async () => {
    const databasePath = await temporaryDatabase();
    const result = runSqliteScenario(databasePath, 'conflicting-intent');

    expect(result.outcome).toBe('conflict');
  });
});
