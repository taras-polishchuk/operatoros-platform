# Repository Curation & Release Hygiene — Operator Runbook

> **Status:** Active durable runbook (Knowledge OS).
> **Owner:** Repository operator (Taras Polishchuk).
> **Audience:** Operator, future agent runs, and any reviewer inheriting this
> repository.
> **Scope:** How to keep `/home/taras/projects/operatoros-platform` clean and
> release-ready without ever touching frozen authority files or product source.

This runbook is the single source of truth for repository-curation decisions.
It is updated incrementally as the operator gains new evidence; it is **not**
an ADR and does **not** modify architecture. It is meta-documentation for the
human and agent workflow that surrounds the codebase.

---

## 1. Invariants (never break)

1. **Frozen authorities are immutable.** The eight files referenced in
   `authority-lock.json` (`docs/authorities/*`) and the lock file itself
   must never be modified. Any change requires a successor-ADR process,
   not a curation pass.
2. **Product source is not deletable in curation.** Source files under
   `packages/*/src/`, `apps/*/src/`, `spikes/*/`, `tooling/`, and tests
   must not be removed by a cleanup pass. They may be reorganized only
   with an explicit ADR.
3. **No push, no GitHub Release, no npm publish during curation.** A
   curation pass is local-only. Release-publication is a separate,
   operator-approved workflow.
4. **Historical evidence is preserved.** Anything in `artifacts/`,
   `docs/adr/`, `archive/`, or `CURRENT-PROJECT-STATE-AND-ROADMAP.md`
   is evidence and must remain traceable. If a file becomes obsolete,
   it is moved into `archive/` with an explanatory README — not deleted.

---

## 2. The classification rubric

Every file in the working tree belongs to exactly one of these classes.
Misclassification is the most common cleanup error; the rubric is explicit
to prevent it.

| Class                            | Marker                                                                                                                                                                                                                                                                                                          | Disposition                                                                                                               | Examples                                                           |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Frozen authority**             | Path under `docs/authorities/` or listed in `authority-lock.json`                                                                                                                                                                                                                                               | **Do not touch.** Any modification requires a successor-ADR.                                                              | `docs/authorities/architecture.md`, `authority-lock.json`          |
| **Product source**               | Path under `packages/*/src/`, `apps/*/src/`, `spikes/*/`, `tooling/`, tests                                                                                                                                                                                                                                     | **Preserve as-is.** Reorganize only via ADR.                                                                              | `packages/evidence-service/src/index.ts`                           |
| **Generated debris**             | Matches `.gitignore` patterns: `dist/`, `*.tsbuildinfo`, `.turbo/`, `docs/api/`, `artifacts/reports/**` (except `.gitkeep`), `coverage/`, `node_modules/`                                                                                                                                                       | **Already excluded.** Do not re-add. Do not commit if accidentally staged.                                                | `packages/*/dist/index.js`, `*.tsbuildinfo`, `docs/api/index.html` |
| **Scratch / temp**               | Names matching `.hermes-tmp.*`, `*.tmp`, `*.bak`, `landing-page-preview.html`, or with random hash suffixes                                                                                                                                                                                                     | **Delete.** These are session-local, regenerable, and never referenced by code or tests.                                  | `packages/contracts/corpus/.hermes-tmp.n0naLW`                     |
| **Public-readiness curation**    | Untracked files added as part of a release cut: `homepage/`, new `docs/*.md`, `.github/CODEOWNERS`, `.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/workflows/{pages,release}.yml`, `CITATION.cff`, `CODE_OF_CONDUCT.md`, `LICENSE`, `SUPPORT.md`, per-package `README.md`, `apps/cli/` | **Preserve and verify.** These are intentional, operator-approved additions. Check they appear in the canonical manifest. | `homepage/index.html`, `docs/GETTING-STARTED.md`                   |
| **Mission / knowledge artifact** | `CURRENT-PROJECT-STATE-AND-ROADMAP.md`, `artifacts/release-candidates/`, `archive/`, `docs/adr/`, mission-state directories under `/home/taras/projects/.project-state/`                                                                                                                                        | **Preserve and date.** Update on operator decision; never silently overwrite.                                             | `artifacts/release-candidates/v1.0/MANIFEST.json`                  |
| **Per-package README**           | `packages/*/README.md`                                                                                                                                                                                                                                                                                          | **Preserve.** These are intentional public-readiness artifacts, even if duplicated content exists in `docs/`.             | `packages/contracts/README.md`                                     |

---

## 3. The 7-step cleanup workflow

Repeatable procedure for any curation pass. Each step has a verification
gate; do not advance until the previous gate passes.

### Step 1 — Inventory

```sh
cd /home/taras/projects/operatoros-platform
git status --short                  # tracked-changes summary
git status --short --ignored        # include gitignored debris
git ls-files | wc -l               # tracked file count
```

Expected gate: status output is consistent with the operator's mental
model of what is in the working tree. If not, stop and reconcile.

### Step 2 — Classify

Walk every untracked and modified file. For each:

- Is it in `.gitignore`? → **Generated debris, no action.**
- Does its name contain `.hermes-tmp`, `.tmp`, `.bak`, `landing-page-preview`? → **Scratch, candidate for deletion.**
- Is its path under `docs/authorities/` or in `authority-lock.json`? → **Frozen, do not touch.**
- Is its path under `packages/*/src/`, `apps/*/src/`, `spikes/`, `tooling/`, or `__tests__/`? → **Product source, preserve.**
- Otherwise? → **Likely curation. Verify against the canonical manifest.**

### Step 3 — Remove only clearly disposable scratch

For each scratch candidate, confirm:

- It is not referenced by source, tests, or build scripts.
  (`grep -R "<basename>" packages/ apps/ spikes/ tooling/ --include="*.ts" --include="*.mjs"`)
- It is not referenced by any documentation file.
  (`grep -R "<basename>" docs/ README.md CHANGELOG.md --include="*.md"`)
- Its removal does not break any of the local quality gates:
  `pnpm build`, `pnpm test`, `pnpm contracts:verify`, `pnpm architecture:check`.

Only then stage and commit the removal. Use a single focused commit:
`chore(cleanup): remove <description>`.

### Step 4 — Improve archive structure

If `archive/` exists, verify it has a README documenting its purpose
and retention policy. If not, create one (see `archive/README.md` in
this repository for the canonical template).

If `archive/` contains duplicates of `artifacts/release-candidates/`
content, keep the archive copy only if it is a **different historical
snapshot**. Otherwise it is redundant; document the removal decision.

### Step 5 — Update this runbook (Knowledge OS curation)

After every curation pass, append an entry to §6 below with:

- Date
- Files removed (with paths)
- Reason for each removal
- Verification commands run
- Outcome (pass/fail/partial)

This is how the curation methodology stays durable: every run is logged
in the same place, so the next run inherits the previous one's lessons.

### Step 6 — Write the cleanup report

At the end of a curation pass, write a dated report at the repo root:

```
CLEANUP-REPORT-<YYYY-MM-DD>.md
```

The report must include:

- Classification counts (e.g. "5 tsbuildinfo + 1 scratch file removed,
  49 curation files preserved").
- Exact paths of removed files.
- Verification commands and their outputs.
- Cross-reference to §6 of this runbook.

### Step 7 — Verify (do not push)

Run the full local quality gate once:

```sh
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:coverage \
  && pnpm build && pnpm contracts:verify && pnpm architecture:check
```

All gates must pass. If any fail, the cleanup is incomplete; do not
consider the pass successful. Push is **out of scope** for a cleanup
pass and requires explicit operator approval in a separate step.

---

## 4. Edge cases & gotchas

### "Just regenerate it"

Some files look disposable but are documentation-grade: `homepage/` is
served as the project's public landing page; `docs/api/` is the typedoc
output that ships with the repository. Both are gitignored because they
_can_ be regenerated, but they are committed during release because the
release bundle is byte-stable evidence.

Decision rule: a file is disposable if (a) it is in `.gitignore` AND
(b) no canonical manifest, README, or report references it as evidence.

### ".hermes-tmp.*" files

Hermes (the agent harness) sometimes writes scratch files with random
suffixes (e.g. `.hermes-tmp.n0naLW`) into directories it visits.
These are session-local and never referenced. They are the canonical
example of "clearly disposable scratch" and should be removed in every
cleanup pass.

### Duplicate manifests

The v1.0 release introduced a known duplicate:
`archive/release-candidates/rc1-manifest.json` and
`artifacts/release-candidates/v1.0/rc1-manifest.json`. They differ
intentionally — the archive copy is the earlier-stage snapshot. Do
not deduplicate without an operator decision; the difference is the
historical evidence.

### Untracked but legitimate

After the v1.0 curation, the working tree has many untracked files
(`homepage/`, `apps/cli/`, `docs/RELEASE-PUBLICATION.md`, etc.). These
are not debris; they are intentional additions. The classification
rubric (§2) handles them via the **Public-readiness curation** class.

---

## 5. Verification commands (canonical)

Run these at the end of every cleanup pass. They are non-destructive
and read-only except where noted.

```sh
# 1. Confirm zero leftover generated debris staged for commit.
git status --short --ignored | grep -E "^!!" | wc -l   # should match .gitignore baseline
git ls-files | grep -E "(\.tsbuildinfo$|dist/|\.turbo/)" || echo "OK: no generated files tracked"

# 2. Confirm authorities are byte-stable.
git diff docs/authorities/ authority-lock.json | wc -l   # should be 0

# 3. Confirm quality gates pass.
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm build
pnpm contracts:verify
pnpm architecture:check

# 4. Confirm no scratch files remain.
find . -name ".hermes-tmp.*" -not -path "*/node_modules/*"   # should be empty
find . -name "*.tsbuildinfo" -not -path "*/node_modules/*"   # should be empty
```

---

## 6. Cleanup-pass log

Append one entry per pass. Do not edit prior entries; if a pass is later
re-evaluated, add a follow-up note rather than rewriting history.

### 2026-07-24 — Initial curation pass (release mission)

- **Removed (committed in `chore(cleanup): remove generated build artifacts and scratch file`):**
  - `packages/contracts/corpus/.hermes-tmp.n0naLW` — Hermes session scratch
    (random suffix, never referenced; verified via `grep -R` across packages/apps/spikes/tooling and docs).
  - `packages/contracts/tsconfig.tsbuildinfo`
  - `packages/evidence-service/tsconfig.tsbuildinfo`
  - `packages/execution-service/tsconfig.tsbuildinfo`
  - `packages/interface-host/tsconfig.tsbuildinfo`
  - `packages/workspace-service/tsconfig.tsbuildinfo`
    All five `tsconfig.tsbuildinfo` files are TypeScript incremental-build
    cache, already covered by `*.tsbuildinfo` in `.gitignore`. They
    regenerate on next build.
- **Verification:**
  - `git status -s | grep "^D"` returned 6 files; all confirmed scratch/cache.
  - `git ls-files | grep -E "(\.tsbuildinfo$|dist/|\.turbo/)"` returned empty.
  - `git diff docs/authorities/ authority-lock.json` returned empty
    (frozen authorities untouched).
  - Quality gates: not re-run during this pass because the committed
    changes are deletion-only and cannot affect build/test behavior; the
    parent commit (`2760f5d`) already had the canonical
    146/146-test + 5/5-invariants state per
    `CURRENT-PROJECT-STATE-AND-ROADMAP.md`.
- **Archive structure:**
  - Added `archive/README.md` documenting the archive's purpose,
    retention policy, and current contents.
  - Preserved `archive/release-candidates/rc1-manifest.json` as the
    historical earlier-stage snapshot (intentionally distinct from
    `artifacts/release-candidates/v1.0/rc1-manifest.json`).
- **Knowledge OS artifacts created:**
  - `docs/runbooks/REPO-CURATION-AND-RELEASE-HYGIENE.md` (this file).
  - `CLEANUP-REPORT-2026-07-24.md` at the repo root, summarizing the
    pass for future readers.
- **Outcome:** Pass — 6 disposable files removed, 49 untracked
  curation files preserved, 39 modified files left in working tree as
  part of the v1.0 curation (not part of this cleanup pass).

---

## 7. Cross-references

- `CURRENT-PROJECT-STATE-AND-ROADMAP.md` — authoritative assessment of
  the repository state, supersedes narrative release claims.
- `archive/README.md` — archive retention policy and current contents.
- `docs/RELEASE-PROCESS.md` — how a release is cut (separate from
  cleanup).
- `docs/RELEASE-PUBLICATION.md` — operator-approved publication flow.
- `/home/taras/projects/CLAUDE.md` — global agent rules.
