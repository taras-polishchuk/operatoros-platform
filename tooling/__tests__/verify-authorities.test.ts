import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { verifyAuthorities } from '../verify-authorities.js';

const temporaryDirectories: string[] = [];

async function createFixture(options?: {
  lockDigest?: string;
  snapshot?: string;
  source?: string;
}): Promise<URL> {
  const directory = await mkdtemp(join(tmpdir(), 'operatoros-authority-'));
  temporaryDirectories.push(directory);
  await mkdir(join(directory, 'docs', 'authorities'), { recursive: true });
  const sourcePath = join(directory, 'source.md');
  const snapshot = options?.snapshot ?? 'frozen authority\n';
  const source = options?.source ?? snapshot;
  const digest =
    options?.lockDigest ?? '33f3121c419031be0a8231ca8b45db23351dbac344e4b1057130a7f2b4874ca4';
  await Promise.all([
    writeFile(join(directory, 'docs', 'authorities', 'authority.md'), snapshot),
    writeFile(sourcePath, source),
  ]);
  await writeFile(
    join(directory, 'authority-lock.json'),
    JSON.stringify({
      schema_version: 1,
      locked_at: '2026-07-19',
      authorities: {
        'authority.md': { source: sourcePath, sha256: digest },
      },
    }),
  );
  return pathToFileURL(join(directory, 'authority-lock.json'));
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('verifyAuthorities', () => {
  it('accepts byte-identical frozen authority snapshots', async () => {
    const result = await verifyAuthorities(new URL('../../authority-lock.json', import.meta.url));

    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.verified).toBe(8);
  });

  it('reports a snapshot that differs from its lock', async () => {
    const lockUrl = await createFixture({
      snapshot: 'tampered snapshot\n',
      source: 'frozen authority\n',
    });

    const result = await verifyAuthorities(lockUrl);

    expect(result.ok).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toContain('snapshot digest');
  });

  it('reports an upstream source that differs from its lock', async () => {
    const lockUrl = await createFixture({ source: 'changed upstream source\n' });

    const result = await verifyAuthorities(lockUrl);

    expect(result.ok).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toContain('source digest');
  });

  it('rejects malformed authority lock metadata', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'operatoros-authority-'));
    temporaryDirectories.push(directory);
    const lockPath = join(directory, 'authority-lock.json');
    await writeFile(lockPath, JSON.stringify({ schema_version: 2, authorities: {} }));

    await expect(verifyAuthorities(pathToFileURL(lockPath))).rejects.toThrow();
  });
});
