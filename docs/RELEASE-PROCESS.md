# Release Process

## Versioning

OperatorOS follows Semantic Versioning. Patch releases contain compatible fixes, minor releases add backward-compatible capabilities, and major releases may change public contracts. Keep package versions synchronized for a platform release.

## Branching

`main` is the integration branch. Release branches (`release/v1.0`) stabilize a version; fixes must be cherry-picked or merged deliberately and documented in the changelog. Tags are immutable release markers.

## Authority lock hygiene

Read the frozen authorities before changing behavior. Never edit `authority-lock.json` or the pinned architecture SHA-256 (`1e79049d9ae5a328556378ff8235525cd0f692bfa317fd7da6dc2bcdb1f27610`) as a release shortcut. Authority changes require the formal successor-ADR path, refreshed verification, and owner approval.

## Artifact bundle

A v1.0 release bundle belongs under `artifacts/release-candidates/v1.0/` and should mirror the evidence structure of `rc1`: manifest, final report, changelog, technical debt, migration notes, architecture deltas, and gate results.

## Quality gate

Run the complete gate from a clean checkout. Install dependencies before any quality or documentation command so the checkout is reproducible:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm quality
pnpm docs:build
pnpm security:scan
pnpm licenses:report
pnpm sbom
```

The core `pnpm quality` command covers format, lint, typecheck, coverage, build, contracts, and architecture checks.

## Release gates E/G/H/K

- **E — architecture consistency:** frozen authorities, lock file, and architecture invariants agree.
- **G — implementation readiness:** required packages, contracts, tests, and build artifacts are present.
- **H — production hardening:** security scan, license/SBOM evidence, schema strictness, secret non-leakage, and recovery controls pass.
- **K — release readiness:** version, changelog, artifacts, documentation, and final report are complete.

Record observed test totals and NFR values in the final report; do not replace evidence with estimates.

## Release-candidate evidence path

Candidate evidence is stored under `artifacts/release-candidates/rc1/`. The versioned release bundle is under `artifacts/release-candidates/v1.0/` and is validated with `node artifacts/release-candidates/v1.0/verify-manifest.mjs`. The release workflow validates the checked-out tag and uploads this bundle; a GitHub Release is created only by a pushed `v*.*.*` tag. Manual dispatch is validation-only and does not publish or create tags.

To validate a final tag locally without pushing:

```sh
git tag --annotate v1.0.0 --message "OperatorOS Platform v1.0.0"
git show --stat --oneline v1.0.0
git tag --delete v1.0.0
```
