#!/usr/bin/env node
/**
 * verify-manifest.mjs
 *
 * Verifies every artifact listed in artifacts/release-candidates/v1.0/MANIFEST.json
 * by recomputing its SHA-256 on disk and comparing it to the recorded value.
 *
 * Self-reference policy (chicken-and-egg):
 *
 *   The top-level MANIFEST.json contains an entry that references itself.
 *   The recorded SHA-256 in that entry MUST be the hash of the file as it
 *   would exist if every occurrence of that recorded hash in the file were
 *   replaced with 64 zeros. This is the only fixed point of the recursive
 *   equation
 *
 *       recorded_hash = sha256(file_with_recorded_hash_zeroed)
 *
 *   and is computed deterministically by zeroing all occurrences of the
 *   recorded sha256 field in the self-entry before hashing.
 *
 *   The verifier enforces one of two outcomes for the self-reference:
 *
 *     1. PASS — the zero-substituted hash of the manifest equals the
 *        recorded self-hash. The manifest is internally consistent and
 *        reproducible from a clean checkout. The on-disk hash WILL differ
 *        from the recorded value because the file contains the hash
 *        itself, not zeros; this is intrinsic to the policy and not a
 *        defect.
 *     2. FAIL — the zero-substituted hash does not match the recorded
 *        self-hash. The self-entry's recorded value is stale and must
 *        be regenerated.
 *
 *   For non-self artifacts, the verifier enforces:
 *
 *     1. PASS — the on-disk hash equals the recorded hash.
 *     2. FAIL — mismatch.
 *
 *   The --strict flag is accepted for forward compatibility but does not
 *   currently change behavior; the zero-substituted policy is already
 *   strict.
 *
 *   The --allow-self-drift flag is accepted for forward compatibility and
 *   is now a no-op: the zero-substituted policy eliminates drift by
 *   construction.
 *
 * Exits 0 on success, non-zero on any mismatch.
 */

import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..', '..', '..');
const manifestPath = join(__dirname, 'MANIFEST.json');

// CLI flags accepted for forward compatibility (no current effect).
const args = new Set(process.argv.slice(2));
if (args.has('--strict') || args.has('--allow-self-drift')) {
  // No-op; the zero-substituted policy is strict by construction.
}

function sha256OfBuffer(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function sha256OfFile(path) {
  return sha256OfBuffer(readFileSync(path));
}

function zeroSubstitutedSelfHash(manifestBytes, recordedSelfHash) {
  if (!/^[0-9a-f]{64}$/u.test(recordedSelfHash)) {
    throw new Error(`Self-entry sha256 is not a 64-char hex string: ${recordedSelfHash}`);
  }
  // Replace EVERY occurrence of the recorded hash in the manifest text
  // with 64 zeros. This includes the field value and any mention in the
  // description; either way the resulting bytes are the canonical
  // "hash-free" form whose digest is the recorded value.
  const zeroed = '0'.repeat(64);
  const replaced = Buffer.from(
    manifestBytes.toString('utf8').split(recordedSelfHash).join(zeroed),
    'utf8',
  );
  return sha256OfBuffer(replaced);
}

const manifestBytes = readFileSync(manifestPath);
const manifest = JSON.parse(manifestBytes.toString('utf8'));

let failures = 0;
let verified = 0;

for (const art of manifest.artifacts) {
  const abs = join(repoRoot, art.path);
  if (!existsSync(abs)) {
    console.error(`MISSING: ${art.path}`);
    failures += 1;
    continue;
  }
  const actual = sha256OfFile(abs);

  if (art.role === 'manifest-of-manifests') {
    let recomputed;
    try {
      recomputed = zeroSubstitutedSelfHash(manifestBytes, art.sha256);
    } catch (error) {
      console.error(`SELF-HASH ERROR for ${art.path}: ${error.message}`);
      failures += 1;
      continue;
    }
    if (recomputed !== art.sha256) {
      console.error(`SELF-HASH STALE for ${art.path}`);
      console.error(`  recorded   = ${art.sha256}`);
      console.error(`  recomputed = ${recomputed}`);
      console.error(`  The recorded self-hash is not the fixed point of the zero-`);
      console.error(`  substituted manifest; regenerate MANIFEST.json with:`);
      console.error(
        `    sha256 = sha256(manifest_bytes_with_all_occurrences_of_<old>_replaced_by_64_zeros)`,
      );
      failures += 1;
      continue;
    }
    console.log(`OK  ${art.path}  ${art.sha256.slice(0, 16)}… (self, zero-substituted policy)`);
    verified += 1;
    continue;
  }

  if (actual !== art.sha256) {
    console.error(`MISMATCH: ${art.path}`);
    console.error(`  recorded = ${art.sha256}`);
    console.error(`  actual   = ${actual}`);
    failures += 1;
  } else {
    console.log(`OK  ${art.path}  ${art.sha256.slice(0, 16)}…`);
    verified += 1;
  }
}

console.log('');
console.log(`Verified: ${verified}`);
console.log(`Failures: ${failures}`);

if (failures > 0) {
  process.exit(1);
}
