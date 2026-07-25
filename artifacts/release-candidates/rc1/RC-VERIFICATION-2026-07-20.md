# 04 — Release Candidate Verification (RC-VERIFICATION-2026-07-20)

**Date**: 2026-07-20
**Repository**: `/home/taras/projects/operatoros-platform/`
**Verdict**: PASS for internal consistency. 5 operator items required to publish.

This document is published at the canonical Platform-repo location as
`/home/taras/projects/operatoros-platform/artifacts/release-candidates/rc1/RC-VERIFICATION-2026-07-20.md`
in parallel.

---

## Background

The prior mission `operatoros-platform-m0-m4-implementation-2026-07-19` produced the
RC1 candidate on 2026-07-20T09:16:55 UTC. This mission independently re-verified
every claim in that report and identified the release-readiness gaps that remain.

## Release candidate: `v1.0.0-rc1`

| Acceptance criterion                    | Status | Evidence                                   |
| --------------------------------------- | ------ | ------------------------------------------ |
| Architecture frozen + locked            | PASS   | SHA `1e79049d...` in `authority-lock.json` |
| 8/8 frozen authorities verified         | PASS   | `pnpm contracts:verify` exit 0             |
| 5/5 architecture invariants pass        | PASS   | `pnpm architecture:check` exit 0           |
| 132/132 tests pass                      | PASS   | `pnpm test` exit 0, 20 test files, 4.73s   |
| 13 packages implemented                 | PASS   | `ls operatoros-platform/packages/`         |
| 14/14 turbo tasks build                 | PASS   | `pnpm build` exit 0                        |
| No security vulnerabilities             | PASS   | `pnpm security:scan` exit 0                |
| Production-dependency licenses recorded | PASS   | `pnpm licenses:report` exit 0              |
| CycloneDX SBOM emitted                  | PASS   | `pnpm sbom` exit 0                         |
| NFR matrix met (perf/rel/use)           | PASS   | NFRs PASS as documented                    |
| Smoke golden path                       | PASS   | `apps/smoke` 3/3 tests, idempotent         |

## Release metadata reconciliation

This mission repaired one drift:

| Item                   | Before              | After       |
| ---------------------- | ------------------- | ----------- |
| `package.json#version` | `0.0.0-development` | `1.0.0-rc1` |

Rationale: narrative documents (README, RC manifest, release notes) consistently
refer to `v1.0.0-rc1`. Aligning the package version eliminates one source of
external confusion.

## Outstanding release-readiness items (operator-authority)

1. **First commit**: unborn `main` (operator item O-A)
2. **Remote + branch protection**: no remote configured (operator item O-A)
3. **LICENSE file**: `package.json#license` = `UNLICENSED` (operator item O-C)
4. **README.md permissions**: `-rw-------` (operator item O-D)
5. **Deployment target**: local vs. Tailscale vs. GitHub-public (operator item O-E)

These are reversible infrastructure-layer decisions. Implementation is complete
and self-consistent. Publication is blocked only on operator authority.

## Sibling findings

A previous subagent report claimed SHA drift `880ba39a → 1e79049d`. This is not
verified in current artifacts. The architecture is single-locked at
`1e79049d...`. See `deliverables/03-updated-gate-chain.md` for the full
investigation.
