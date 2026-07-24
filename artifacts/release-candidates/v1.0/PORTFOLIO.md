# OperatorOS Platform v1.0 — Portfolio Assets

This document catalogs the visual, narrative, and reference assets that ship
alongside the v1.0 release and that an operator or reviewer can use to
evaluate the platform without running it.

**Repository:** https://github.com/taras-polishchuk/operatoros-platform
**Release date:** 2026-07-24

---

## 1. Landing page (public-facing)

A self-contained, dark-themed single-page landing site that introduces the
project without requiring the reader to clone the repo.

| Asset                | Path                               | Description                                                 |
| -------------------- | ---------------------------------- | ----------------------------------------------------------- |
| Landing page (HTML)  | `homepage/index.html`              | Single-page dark-themed hero, features grid, install block. |
| Landing page styles  | `homepage/styles.css`              | Self-contained dark stylesheet, no external CSS framework.  |
| Landing page script  | `homepage/script.js`               | Mobile nav toggle, smooth-scroll UX.                        |
| Landing page logo    | `homepage/assets/logo.svg`         | Project logo (SVG).                                         |
| Architecture preview | `homepage/assets/architecture.svg` | Compact architecture diagram embedded in the landing page.  |

## 2. Architecture diagrams

| Asset                            | Path                            | Description                                        |
| -------------------------------- | ------------------------------- | -------------------------------------------------- |
| Full architecture diagram        | `docs/architecture.svg`         | Detailed component + entity diagram.               |
| Full diagram (text alt)          | `docs/architecture.svg.alt.txt` | Text alternative for screen readers and CI checks. |
| Logo (light)                     | `docs/logo-light.svg`           | Project logo, light variant.                       |
| Logo (dark)                      | `docs/logo.svg`                 | Project logo, dark variant.                        |
| Mission Run sequence (narrative) | `docs/sequence-mission-run.md`  | Sequence-of-events narrative for a Mission Run.    |

## 3. Public documentation

| Document               | Path                           | Audience    | Purpose                                  |
| ---------------------- | ------------------------------ | ----------- | ---------------------------------------- |
| Getting Started        | `docs/GETTING-STARTED.md`      | Operators   | 5-minute guided flow.                    |
| Installation           | `docs/INSTALLATION.md`         | Operators   | Node/pnpm requirements, lockfile policy. |
| Deployment             | `docs/DEPLOYMENT.md`           | Operators   | Local vs. hosted vs. distributed.        |
| FAQ                    | `docs/FAQ.md`                  | All         | Common operator and contributor Qs.      |
| Release process        | `docs/RELEASE-PROCESS.md`      | Maintainers | How a release is cut.                    |
| Architecture narrative | `docs/ARCHITECTURE.md`         | Reviewers   | High-level architecture narrative.       |
| Mission Run sequence   | `docs/sequence-mission-run.md` | Reviewers   | Per-step narrative of a Mission Run.     |

## 4. API reference (generated)

| Asset              | Path                            | Description                             |
| ------------------ | ------------------------------- | --------------------------------------- |
| TypeDoc index      | `docs/api/index.html`           | Generated local source-reference index. |
| TypeDoc stylesheet | `docs/api/assets/style.css`     | Reference stylesheet.                   |
| TypeDoc search     | `docs/api/assets/search.js`     | Client-side search for the reference.   |
| TypeDoc navigation | `docs/api/assets/navigation.js` | Tree navigation for the reference.      |

`typedoc.json` documents five configured source entry points: contracts,
workspace-service, execution-service, evidence-service, and interface-host.
`docs/api/` is ignored generated output and is not evidence of a live hosted site.

## 5. Project root files (public-facing)

| Asset           | Path                 | Purpose                                     |
| --------------- | -------------------- | ------------------------------------------- |
| README          | `README.md`          | Top-of-repo entry point.                    |
| LICENSE         | `LICENSE`            | Owner-gated (currently inherited, see B-1). |
| CHANGELOG       | `CHANGELOG.md`       | v1.0.0 + v1.0.0-rc1 release notes.          |
| CONTRIBUTING    | `CONTRIBUTING.md`    | Contributor guidance.                       |
| CODE_OF_CONDUCT | `CODE_OF_CONDUCT.md` | Community standards.                        |
| SECURITY        | `SECURITY.md`        | Vulnerability reporting.                    |
| SUPPORT         | `SUPPORT.md`         | Support channels.                           |
| CITATION        | `CITATION.cff`       | Machine-readable citation metadata.         |

## 6. Release bundle (this directory)

All v1.0 release artifacts are listed in `artifacts/release-candidates/v1.0/MANIFEST.json`.

| Artifact                   | Path                                                       |
| -------------------------- | ---------------------------------------------------------- |
| v1.0 manifest              | `artifacts/release-candidates/v1.0/rc1-manifest.json`      |
| v1.0 manifest-of-manifests | `artifacts/release-candidates/v1.0/MANIFEST.json`          |
| v1.0 changelog             | `artifacts/release-candidates/v1.0/CHANGELOG.md`           |
| v1.0 final report          | `artifacts/release-candidates/v1.0/final-report.md`        |
| v1.0 technical debt        | `artifacts/release-candidates/v1.0/technical-debt.md`      |
| v1.1 backlog               | `artifacts/release-candidates/v1.0/v1.1-backlog.md`        |
| v1.0 architecture deltas   | `artifacts/release-candidates/v1.0/architecture-deltas.md` |
| v1.0 v0.8 migration        | `artifacts/release-candidates/v1.0/migration-from-v08.md`  |
| v1.0 quality-gate evidence | `artifacts/release-candidates/v1.0/QUALITY-GATE.md`        |
| v1.0 portfolio index       | `artifacts/release-candidates/v1.0/PORTFOLIO.md`           |

## 7. Cross-references

- v1.0.0-rc1 release bundle: `artifacts/release-candidates/rc1/`
- Quality-gate evidence files: `artifacts/reports/gates/`
- Coverage reports: `artifacts/reports/coverage/`
- License reports: `artifacts/reports/licenses/`
- SBOM: `artifacts/reports/dependencies/sbom.cdx.json`
