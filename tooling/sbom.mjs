import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const reportDirectory = 'artifacts/reports/dependencies';
mkdirSync(reportDirectory, { recursive: true });

const dependencies = JSON.parse(
  execFileSync('pnpm', ['list', '--prod', '--json', '--depth', 'Infinity'], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  }),
);
const lock = readFileSync('pnpm-lock.yaml');
const lockSha256 = createHash('sha256').update(lock).digest('hex');
const report = {
  bomFormat: 'CycloneDX-compatible dependency inventory',
  specVersion: '1.5',
  serialNumber: `urn:uuid:${randomUUID()}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    tools: [{ name: 'pnpm-list-sbom-adapter', version: '1' }],
    properties: [{ name: 'pnpm-lock-sha256', value: lockSha256 }],
  },
  dependencyTrees: dependencies,
};

writeFileSync(`${reportDirectory}/sbom.cdx.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote ${reportDirectory}/sbom.cdx.json`);
