# Release Validation Evidence — OperatorOS Platform v1.0

**Validation run:** 2026-07-24 final curation pass
**Current result:** fresh `pnpm test:coverage` reports 146/146 tests across 21 files; coverage 85.91 statements, 74.91 branches, 93.04 functions, 85.83 lines.
**Historical note:** earlier RC1 evidence recorded 132/132 across 20 files; those figures remain historical and are not the current release total.

---

## Gate summary

| #   | Gate               | Command                   | Expected                 | Observed                | Result |
| --- | ------------------ | ------------------------- | ------------------------ | ----------------------- | ------ |
| 1   | format:check       | `pnpm format:check`       | 0 exit                   | 0 exit                  | PASS   |
| 2   | lint               | `pnpm lint`               | 0 exit, --max-warnings 0 | 0 exit                  | PASS   |
| 3   | typecheck          | `pnpm typecheck`          | 0 exit                   | 0 exit                  | PASS   |
| 4   | test:coverage      | `pnpm test:coverage`      | 146/146 + 80/80/80/70    | 146/146 + 80/80/80/70   | PASS   |
| 5   | build              | `pnpm build`              | 0 exit, 14/14 tasks      | 0 exit                  | PASS   |
| 6   | contracts:verify   | `pnpm contracts:verify`   | 8/8 authorities          | 8/8 verified            | PASS   |
| 7   | architecture:check | `pnpm architecture:check` | 5/5 invariants           | 5/5 passed              | PASS   |
| 8   | docs:build         | `pnpm docs:build`         | typedoc, 0 exit          | 0 exit, html @ docs/api | PASS   |
| 9   | security:scan      | `pnpm security:scan`      | 0 vulnerabilities        | 0 vulnerabilities       | PASS   |
| 10  | licenses:report    | `pnpm licenses:report`    | 0 exit                   | 0 exit                  | PASS   |
| 11  | sbom               | `pnpm sbom`               | 0 exit                   | 0 exit                  | PASS   |

---

## Gate 1 — `pnpm format:check`

**Evidence:** `artifacts/reports/coverage/` (prettier 0-warning on a clean
working tree). Command runs Prettier in `--check` mode; the v1.0 tree is
formatted, so the command exits 0 with no diffs reported.

## Gate 2 — `pnpm lint`

**Evidence:** ESLint v9 + typescript-eslint, `--max-warnings 0`. Command
exits 0; no warnings or errors in any workspace package.

## Gate 3 — `pnpm typecheck`

**Evidence:** `tsc --noEmit` at the root + per-package `typecheck` tasks via
Turbo. All 13 packages + the apps/smoke workspace compile cleanly.

## Gate 4 — `pnpm test:coverage` (Gate K)

**Command:** `vitest run --coverage`
**Exit code:** 0
**Evidence file:** `artifacts/reports/gates/gate-K-tests.txt`

**Test totals:**

```
Test Files  21 passed (21)
     Tests  146 passed (146)
  Start at  11:08:58
  Duration  4.81s
```

**Coverage thresholds (enforced):**

- lines: 80%
- functions: 80%
- statements: 80%
- branches: 70%

**Test file breakdown (146 tests across 21 files):**

| File                                                                             | Tests   |
| -------------------------------------------------------------------------------- | ------- |
| packages/governance-service/src/**tests**/governance-service.test.ts             | 7       |
| packages/agent-execution/src/**tests**/agent-execution.test.ts                   | 9       |
| packages/evidence-service/src/**tests**/evidence-service.test.ts                 | 10      |
| packages/workspace-service/src/**tests**/workspace-service.test.ts               | 8       |
| packages/execution-service/src/**tests**/execution-service.test.ts               | 6       |
| spikes/nfr/src/**tests**/nfr.test.ts                                             | 1       |
| spikes/persistence/src/**tests**/sqlite-spike.test.ts                            | 9       |
| packages/interface-host/src/**tests**/interface-host.test.ts                     | 6       |
| packages/recovery-service/src/**tests**/recovery-service.test.ts                 | 7       |
| packages/distributed-coordination/src/**tests**/distributed-coordination.test.ts | 7       |
| tooling/**tests**/verify-authorities.test.ts                                     | 4       |
| packages/extension-runtime/src/**tests**/extension-runtime.test.ts               | 7       |
| packages/contracts/src/**tests**/contracts.test.ts                               | 13      |
| packages/contracts/src/**tests**/compatibility.test.ts                           | 4       |
| packages/hosted-runtime/src/**tests**/hosted-runtime.test.ts                     | 6       |
| spikes/persistence/src/**tests**/file-journal-spike.test.ts                      | 9       |
| packages/secrets-service/src/**tests**/secrets-service.test.ts                   | 9       |
| packages/contracts/src/**tests**/invalid-corpus.test.ts                          | 1       |
| packages/v08-importer/src/**tests**/v08-importer.test.ts                         | 6       |
| apps/smoke/src/**tests**/golden-path.test.ts                                     | 3       |
| apps/cli/src/**tests**/cli.test.ts                                               | 14      |
| **Total**                                                                        | **146** |

## Gate 5 — `pnpm build`

**Evidence:** Turbo build, 14/14 tasks pass (13 packages + apps/smoke).
Build artifacts land in each package's `dist/` directory.

## Gate 6 — `pnpm contracts:verify` (Gate E)

**Command:** `tsx tooling/verify-authorities.ts`
**Exit code:** 0
**Evidence file:** `artifacts/reports/gates/gate-E-contracts.json`

```json
{
  "ok": true,
  "verified": 8,
  "failures": []
}
```

**8 frozen authorities verified:**

1. `domain-model.md` — SHA-256 `14a99bff255ab54b9ed62165f976b365dbc3cf5969f64561674d5634e8ba71ab`
2. `functional-spec.md` — SHA-256 `5225023e2ac4e93d16ba37d437beb0bb3f0fd76da5f71c6472c58cf6d48d6005`
3. `architecture.md` — SHA-256 `1e79049d9ae5a328556378ff8235525cd0f692bfa317fd7da6dc2bcdb1f27610`
4. `architecture-validation.md` — SHA-256 `a2ff530baf89fb15c619e6c88725e6a0862c5a436975c8d8352f44f4bb8804e3`
5. `implementation-roadmap.md` — SHA-256 `add6035997d57639ca0c6b89dbd79ff57109a9e72053ce2ac3b7263103b547e1`
6. `test-strategy.md` — SHA-256 `07087550ba32857c6b5e0e5eb3504aaa22d42eabfe717ea169bfbca7be37afbc`
7. `final-consistency-audit.md` — SHA-256 `3004153bf175025a022c9d33607c4d63b13750085b823c7201a31d9b5ad3e795`
8. `final-design-report.md` — SHA-256 `a40301e4419ca104e25304319b25a15240330b6440bf234da61117fb0a3c7ad1`

The architecture SHA-256 is single-locked: no drift between validation, rc1,
and v1.0.

## Gate 7 — `pnpm architecture:check` (Gate G)

**Command:** `tsx tooling/check-architecture.ts`
**Exit code:** 0
**Evidence file:** `artifacts/reports/gates/gate-G-architecture.json`

```json
{
  "schema_version": 1,
  "architecture_sha256": "1e79049d9ae5a328556378ff8235525cd0f692bfa317fd7da6dc2bcdb1f27610",
  "checks": [
    { "name": "exactly-four-components", "passed": true, "evidence": "Architecture §3" },
    { "name": "exactly-fourteen-entities", "passed": true, "evidence": "Domain Model §5" },
    { "name": "separate-repository-boundary", "passed": true, "evidence": "Roadmap §2" },
    { "name": "local-profile-canonical", "passed": true, "evidence": "Architecture §2 and §12" },
    { "name": "runtime-owns-no-durable-authority", "passed": true, "evidence": "Architecture §2" }
  ],
  "passed": true
}
```

**5/5 invariants PASS.**

## Gate 8 — `pnpm docs:build`

**Command:** `typedoc --options typedoc.json`
**Exit code:** 0
**Evidence file:** `artifacts/reports/gates/gate-E-docs.txt`

```
html generated at ./docs/api
```

Five configured source entry points documented; local generated index at
`docs/api/index.html`. This output is ignored and is not a deployed site.

## Gate 9 — `pnpm security:scan` (part of Gate H)

**Command:** `pnpm audit --audit-level high && node tooling/security-scan.mjs`
**Exit code:** 0
**Evidence file:** `artifacts/reports/gates/gate-H-security.json`

```json
{
  "passed": true,
  "findings": []
}
```

`pnpm audit` reports "No known vulnerabilities found" at the
`--audit-level=high` threshold. The custom source-pattern scanner reports
zero findings.

## Gate 10 — `pnpm licenses:report` (part of Gate H)

**Command:** `node tooling/license-report.mjs`
**Exit code:** 0
**Evidence file:** `artifacts/reports/gates/gate-H-licenses.txt`

```
Wrote artifacts/reports/licenses/production-dependency-licenses.json
```

Production-dependency license inventory is written to
`artifacts/reports/licenses/production-dependency-licenses.json`.

## Gate 11 — `pnpm sbom` (part of Gate H)

**Command:** `node tooling/sbom.mjs`
**Exit code:** 0
**Evidence file:** `artifacts/reports/gates/gate-H-sbom.txt`

```
Wrote artifacts/reports/dependencies/sbom.cdx.json
```

CycloneDX-shaped SBOM is written to
`artifacts/reports/dependencies/sbom.cdx.json`.

---

## NFR matrix

| NFR                            | Target              | Observed                                          | Result |
| ------------------------------ | ------------------- | ------------------------------------------------- | ------ |
| NFR-PERF-1..3 throughput       | >= 1000 ops/sec     | 3602–4009 ops/sec across three 5000-mutation runs | PASS   |
| NFR-REL-2 RTO                  | < 30000 ms          | 40 ms                                             | PASS   |
| NFR-OPS-1 local deployment     | isolated workspaces | 2 distinct stores                                 | PASS   |
| NFR-USE-1 cold start           | < 5000 ms           | 88 ms                                             | PASS   |
| AV-O6 secret value never leaks | none                | none                                              | PASS   |

NFRs are exercised by `spikes/nfr/src/__tests__/nfr.test.ts`, which is part
of the 146-test count above.

## Final verdict

- 11/11 quality gates PASS.
- 146/146 tests PASS, 21/21 test files PASS, coverage thresholds met.
- 8/8 frozen authorities verified.
- 5/5 architecture invariants pass.
- 5/5 NFRs/AV checks pass.
- 13/13 packages build cleanly.
- Architecture SHA-256 unchanged from rc1, from validation, and from the
  original freeze.
