#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const steps = [
  ['install', ['install', '--frozen-lockfile']],
  ['quality', ['quality']],
  ['smoke', ['test', 'apps/smoke']],
  ['docs', ['docs:build']],
  ['security', ['security:scan']],
  ['licenses', ['licenses:report']],
  ['sbom', ['sbom']],
];

if (!existsSync(resolve(root, 'pnpm-lock.yaml'))) {
  console.error('clean-tree verifier must run from an OperatorOS Platform checkout');
  process.exit(2);
}

for (const [name, args] of steps) {
  console.log(`\n[clean-tree:${name}] pnpm ${args.join(' ')}`);
  const result = spawnSync('pnpm', args, { cwd: root, stdio: 'inherit', env: process.env });
  if (result.status !== 0) {
    console.error(`[clean-tree:${name}] FAILED (${String(result.status)})`);
    process.exit(result.status ?? 1);
  }
}

console.log('\n[clean-tree:manifest] node artifacts/release-candidates/v1.0/verify-manifest.mjs');
const manifest = spawnSync('node', ['artifacts/release-candidates/v1.0/verify-manifest.mjs'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});
if (manifest.status !== 0) {
  console.error(`[clean-tree:manifest] FAILED (${String(manifest.status)})`);
  process.exit(manifest.status ?? 1);
}

console.log('\nOperatorOS clean-tree verification PASSED');
