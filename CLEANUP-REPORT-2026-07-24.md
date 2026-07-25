# Repository Cleanup Report — 2026-07-24

> **Scope:** Audit and curation pass for the v1.0 release mission.
> **Authority:** Repository operator (Taras Polishchuk).
> **Constraints honored:** no npm, no GitHub Release, no `git push`;
> frozen authorities untouched; product source untouched; historical
> evidence preserved.

## 1. Classification summary

The pre-pass working tree contained 93 distinct entries (39 modified,
49 untracked, 6 staged-for-deletion). They fall into the following
classes per the canonical rubric in
`docs/runbooks/REPO-CURATION-AND-RELEASE-HYGIENE.md` §2:

| Class                                                                                                                                                                                                                                                                                                                                                                                                                                         |                          Count | Disposition                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -----------------------------: | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Generated debris** (gitignored: `dist/`, `*.tsbuildinfo`, `.turbo/`, `docs/api/`, `artifacts/reports/**`, `coverage/`)                                                                                                                                                                                                                                                                                                                      | 54 (excluded from working set) | Already correctly ignored; no action.                                                                                                         |
| **Scratch / temp** (`.hermes-tmp.*`, `*.tmp`, etc.)                                                                                                                                                                                                                                                                                                                                                                                           |                     1 (staged) | Removed.                                                                                                                                      |
| **Build-cache** (`tsconfig.tsbuildinfo`)                                                                                                                                                                                                                                                                                                                                                                                                      |                     5 (staged) | Removed.                                                                                                                                      |
| **Frozen authority** (`docs/authorities/*`, `authority-lock.json`)                                                                                                                                                                                                                                                                                                                                                                            |                        9 paths | **Untouched.** Verified by `git diff` returning empty.                                                                                        |
| **Product source** (`packages/*/src/`, `apps/*/src/`, `spikes/*/`, `tooling/`, `__tests__/`)                                                                                                                                                                                                                                                                                                                                                  |                  39 (modified) | **Untouched.** These are part of the v1.0 curation (legitimate field-persistence fixes, package-manifest updates) — out of scope for cleanup. |
| **Public-readiness curation** (`homepage/`, `apps/cli/`, `docs/RELEASE-PUBLICATION.md`, `docs/{GETTING-STARTED,INSTALLATION,DEPLOYMENT,FAQ,RELEASE-PROCESS,ARCHITECTURE,BADGES}.md`, per-package `README.md`, `.github/CODEOWNERS`, `.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/workflows/{pages,release}.yml`, `CITATION.cff`, `CODE_OF_CONDUCT.md`, `LICENSE`, `SUPPORT.md`, `.editorconfig`, `.gitattributes`) |                ~45 (untracked) | **Preserved** as intentional v1.0 additions. Verified against `artifacts/release-candidates/v1.0/MANIFEST.json`.                              |
| **Mission / knowledge artifact** (`CURRENT-PROJECT-STATE-AND-ROADMAP.md`, `artifacts/release-candidates/`, `archive/`, `docs/adr/ADR-W2-DR-001-...`, `docs/{architecture.svg,class-evidence.md,comparison.md,logo*.svg,roadmap.md,sequence-mission-run.md,architecture.svg.alt.txt}`, `docs/screenshots/`)                                                                                                                                    |                ~22 (untracked) | **Preserved.**                                                                                                                                |
| **Knowledge OS runbook** (this cleanup pass)                                                                                                                                                                                                                                                                                                                                                                                                  |                          2 new | Added: `docs/runbooks/REPO-CURATION-AND-RELEASE-HYGIENE.md`, this report.                                                                     |

## 2. Files removed

Committed in `chore(cleanup): remove generated build artifacts and scratch file`
(commit `d1a1863`):

| Path                                              | Reason                                                                                                                                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts/corpus/.hermes-tmp.n0naLW`    | Hermes session-local scratch file with random suffix. Verified not referenced by source, tests, build scripts, or docs via `grep -R` across `packages/`, `apps/`, `spikes/`, `tooling/`, `docs/`. |
| `packages/contracts/tsconfig.tsbuildinfo`         | TypeScript incremental-build cache. Already covered by `*.tsbuildinfo` in `.gitignore`. Regenerates on next build.                                                                                |
| `packages/evidence-service/tsconfig.tsbuildinfo`  | Same as above.                                                                                                                                                                                    |
| `packages/execution-service/tsconfig.tsbuildinfo` | Same as above.                                                                                                                                                                                    |
| `packages/interface-host/tsconfig.tsbuildinfo`    | Same as above.                                                                                                                                                                                    |
| `packages/workspace-service/tsconfig.tsbuildinfo` | Same as above.                                                                                                                                                                                    |

Total: **6 files, 159 lines deleted, 0 lines added.**

## 3. Files NOT removed (and why)

The following categories were explicitly preserved despite being either
untracked, gitignored, or appearing disposable at first glance:

- **All 54 gitignored generated artifacts** (`dist/`, `*.tsbuildinfo`,
  `.turbo/`, `docs/api/`, `artifacts/reports/**`, `coverage/`) —
  correctly ignored, regenerable, never tracked. Removing them from
  disk would be wasted effort.
- **`homepage/` and `docs/api/`** — gitignored, but canonical content
  for the v1.0 release bundle. Not touched; will be regenerated by
  `pnpm build` and `pnpm docs:build` when needed.
- **`archive/release-candidates/rc1-manifest.json`** — historical
  earlier-stage snapshot, intentionally distinct from
  `artifacts/release-candidates/v1.0/rc1-manifest.json`. The diff
  between the two is the historical evidence; deduplicating would
  destroy it.
- **All modified product source** (`packages/*/src/index.ts`,
  `packages/*/src/__tests__/*`, `spikes/nfr/*`, `tooling/*`,
  `vitest.config.ts`, `pnpm-lock.yaml`, `eslint.config.js`,
  `package.json` and per-package `package.json`) — these are
  legitimate v1.0 curation changes (field-persistence fixes,
  manifest updates, lint config, lockfile). Cleanup is **not** the
  place to revert or modify them.
- **All untracked curation files** (`homepage/`, `apps/cli/`, new
  `docs/*.md`, per-package `README.md`, `.github/CODEOWNERS`,
  `.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md`,
  `.github/workflows/{pages,release}.yml`, `CITATION.cff`,
  `CODE_OF_CONDUCT.md`, `LICENSE`, `SUPPORT.md`, `.editorconfig`,
  `.gitattributes`) — intentional v1.0 additions, all referenced in
  `artifacts/release-candidates/v1.0/MANIFEST.json`.
- **Frozen authorities** (`docs/authorities/*`, `authority-lock.json`)
  — never touched in cleanup passes; byte-stability verified.

## 4. Knowledge OS artifacts added

| Path                                                 | Role                                                                                                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/runbooks/REPO-CURATION-AND-RELEASE-HYGIENE.md` | Durable operator-curation runbook: invariants, classification rubric, 7-step workflow, edge cases, verification commands, append-only cleanup-pass log. |
| `archive/README.md`                                  | Documents the archive's purpose (historical-snapshot retention), retention policy, current contents, and verification commands.                         |
| `CLEANUP-REPORT-2026-07-24.md` (this file)           | Per-pass cleanup report. Sibling to `CURRENT-PROJECT-STATE-AND-ROADMAP.md`.                                                                             |

## 5. Verification performed

```sh
# Confirm cleanup commit identity matches HEAD's committer (Taras Polishchuk).
$ git log -2 --format="%H %an <%ae>" --date=iso
d1a1863152b84c83ad81c291a4123a1272a339eb Taras Polishchuk <poli.taras.shchuk@gmail.com> 2026-07-24 22:08:12 +0000
2760f5d268c358e93b12a17731ce77ceb172bba6 Taras Polishchuk <poli.taras.shchuk@gmail.com> 2026-07-21 09:43:56 +0000

# Confirm no generated files are tracked.
$ git ls-files | grep -E "(\.tsbuildinfo$|dist/|\.turbo/)" || echo "OK: no generated files tracked"
OK: no generated files tracked

# Confirm frozen authorities byte-stable.
$ git diff docs/authorities/ authority-lock.json | wc -l
0

# Confirm zero scratch files remain.
$ find . -name ".hermes-tmp.*" -not -path "*/node_modules/*"
(empty)

# Confirm zero tsbuildinfo files remain.
$ find . -name "*.tsbuildinfo" -not -path "*/node_modules/*"
(empty)
```

Quality gates (`pnpm build`, `pnpm test:coverage`, `pnpm contracts:verify`,
`pnpm architecture:check`) were not re-run during this pass because
the committed changes are deletion-only and cannot affect
build/test/lint behavior; the parent commit (`2760f5d`) already had
the canonical 146/146-test + 5/5-invariants + 8/8-authorities state
per `CURRENT-PROJECT-STATE-AND-ROADMAP.md` §1.

## 6. Operational notes for the next operator

- **Do not push.** This pass is local-only per the explicit
  no-push/no-release constraint.
- **Do not rebase.** The cleanup commit (`d1a1863`) is a small,
  self-contained deletion-only change; it sits cleanly on top of
  the v1.0 working tree.
- **If you continue the v1.0 curation**, the 39 modified files and
  49 untracked files are the next items to address. They are
  documented in §1 above and in `CURRENT-PROJECT-STATE-AND-ROADMAP.md`.
- **If you run another cleanup pass**, append to the log in
  `docs/runbooks/REPO-CURATION-AND-RELEASE-HYGIENE.md` §6 and
  create a sibling `CLEANUP-REPORT-<DATE>.md` at the repo root.

## 7. Cross-references

- `CURRENT-PROJECT-STATE-AND-ROADMAP.md` — canonical project-state assessment.
- `docs/runbooks/REPO-CURATION-AND-RELEASE-HYGIENE.md` — durable
  curation runbook (Knowledge OS).
- `archive/README.md` — archive retention policy.
- `artifacts/release-candidates/v1.0/MANIFEST.json` — v1.0 release-bundle manifest.
- `authority-lock.json` — frozen-authority byte-locks (untouched).
- `/home/taras/projects/CLAUDE.md` — global agent rules.
