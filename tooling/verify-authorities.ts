import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

const authorityLockSchema = z.object({
  schema_version: z.literal(1),
  locked_at: z.string().min(1),
  authorities: z.record(
    z.string().min(1),
    z.object({
      source: z.string().min(1),
      sha256: z.string().regex(/^[0-9a-f]{64}$/u),
    }),
  ),
});

export interface AuthorityVerificationResult {
  ok: boolean;
  verified: number;
  failures: string[];
}

function sha256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

export async function verifyAuthorities(lockUrl: URL): Promise<AuthorityVerificationResult> {
  const lockPath = fileURLToPath(lockUrl);
  const lock = authorityLockSchema.parse(JSON.parse(await readFile(lockPath, 'utf8')));
  const authorityDirectoryUrl = new URL('./docs/authorities/', lockUrl);
  const failures: string[] = [];

  await Promise.all(
    Object.entries(lock.authorities).map(async ([snapshotName, authority]) => {
      const snapshotUrl = new URL(snapshotName, authorityDirectoryUrl);
      const sourceUrl = authority.source.startsWith('/')
        ? new URL(`file://${authority.source}`)
        : new URL(authority.source, lockUrl);
      const [snapshot, source] = await Promise.all([readFile(snapshotUrl), readFile(sourceUrl)]);
      const snapshotDigest = sha256(snapshot);
      const sourceDigest = sha256(source);

      if (snapshotDigest !== authority.sha256) {
        failures.push(
          `${snapshotName}: snapshot digest ${snapshotDigest} differs from lock ${authority.sha256}`,
        );
      }
      if (sourceDigest !== authority.sha256) {
        failures.push(
          `${snapshotName}: source digest ${sourceDigest} differs from lock ${authority.sha256}`,
        );
      }
    }),
  );

  failures.sort();
  return {
    ok: failures.length === 0,
    verified: Object.keys(lock.authorities).length,
    failures,
  };
}

/* v8 ignore start -- CLI process adapter; verifyAuthorities is the tested behavior. */
async function main(): Promise<void> {
  const result = await verifyAuthorities(new URL('../authority-lock.json', import.meta.url));
  if (!result.ok) {
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
/* v8 ignore stop */
