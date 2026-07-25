# Archive — Historical-Snapshot Retention

This directory holds **historical snapshots** of release-candidate artifacts
that are intentionally kept outside the canonical `artifacts/release-candidates/`
tree.

## Purpose

`artifacts/release-candidates/` is the **canonical** tree for the current and
most-recent release-candidate evidence (rc1, v1.0). Files there are updated as
release work progresses. Anything in `archive/` is a frozen historical snapshot
that must not be edited — its byte-identity is the evidence.

## Retention policy

- **What goes here:** older versions of release manifests, deprecated
  evidence pointers, and superseded release-bundle contents that an
  operator may still need to reference but should not accidentally edit.
- **What does not go here:** build outputs (`dist/`, `*.tsbuildinfo`,
  `.turbo/`), test fixtures, generated docs (`docs/api/`), or coverage
  reports — those are gitignored and regenerated automatically.
- **What must never be added:** product source, frozen authority files
  (`docs/authorities/*`, `authority-lock.json`), or anything that
  affects build/test/lint behavior. The archive is documentation, not code.

## Current contents

| Path                                   | Role                                                                                                                                                                                                                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `release-candidates/rc1-manifest.json` | Frozen **earlier-stage** snapshot of the v1.0.0-rc1 release manifest, predating the `artifacts/release-candidates/v1.0/rc1-manifest.json` (which is the canonical post-curation copy referenced by `MANIFEST.json`). Diff with the canonical copy shows the change history. |

## Verification

To verify the archive is consistent with the canonical tree:

```sh
diff -u archive/release-candidates/rc1-manifest.json \
        artifacts/release-candidates/v1.0/rc1-manifest.json | head -40
```

The two files **must differ** — if they become identical, the archive copy
should be removed (its historical role is over) or updated only with a
documented operator decision.

## Operational notes

- This directory is **not** gitignored. It is intentionally tracked so
  that the historical snapshot is preserved across clones.
- Edits require an explicit operator decision and should be documented
  in `CURRENT-PROJECT-STATE-AND-ROADMAP.md` or a successor
  mission-state document.
- See `docs/runbooks/REPO-CURATION-AND-RELEASE-HYGIENE.md` for the
  full curation methodology.
