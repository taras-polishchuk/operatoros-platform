import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runFileJournalScenario } from '../file-journal-spike.js';

const temporaryDirectories: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'operatoros-file-journal-'));
  temporaryDirectories.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('IP-003 file-journal bounded spike', () => {
  it.each([
    ['before-prepare', 'uncommitted'],
    ['after-prepare', 'uncommitted'],
    ['after-record', 'evidence-gap'],
    ['after-event', 'evidence-gap'],
    ['after-idempotency', 'evidence-gap'],
    ['after-commit', 'committed'],
    ['after-acknowledge', 'committed'],
  ] as const)('reconciles crash point %s as %s', async (crashPoint, expectedOutcome) => {
    const root = await temporaryRoot();

    const result = await runFileJournalScenario(root, crashPoint);

    expect(result.outcome).toBe(expectedOutcome);
    expect(result.acknowledgedLoss).toBe(false);
  });

  it('returns the original committed identity for an acknowledged request after restart', async () => {
    const root = await temporaryRoot();
    const result = await runFileJournalScenario(root, 'after-acknowledge');

    expect(result.replayedResult).toEqual(result.originalResult);
  });

  it('exposes partial durable files as an explicit evidence gap instead of synthesizing evidence', async () => {
    const root = await temporaryRoot();
    const aggregateDirectory = join(root, 'aggregate');
    await mkdir(aggregateDirectory, { recursive: true });
    await writeFile(join(aggregateDirectory, 'record.json'), '{"version":1}\n');

    const result = await runFileJournalScenario(root, 'inspect-only');

    expect(result.outcome).toBe('evidence-gap');
    await expect(readFile(join(aggregateDirectory, 'event.json'), 'utf8')).rejects.toThrow();
  });
});
