# Changelog

## [1.0.0] - 2026-07-24

**OperatorOS Platform v1.0.0 — local release-candidate bundle; publication pending.**

This is the locally validated v1.0.0 candidate cut. No public repository release,
tag, npm package, or hosted service is implied. The architecture is **unchanged from
v1.0.0-rc1**: the canonical architecture document is still pinned at SHA-256
`1e79049d9ae5a328556378ff8235525cd0f692bfa317fd7da6dc2bcdb1f27610`. The 4-day gap
between rc1 and final was spent on public-readiness work only — landing page,
public docs, a five-entry-point source reference, and repository URL standardization. No
contracts, no package APIs, no architecture deltas.

### What landed between rc1 and v1.0

- **Public landing page** (`homepage/`) — `index.html` + `styles.css` + `script.js`,
  dark-themed, self-contained. Uses the project's `architecture.svg` and `logo.svg`.
- **Public documentation** under `docs/` — `GETTING-STARTED.md`, `INSTALLATION.md`,
  `DEPLOYMENT.md`, `FAQ.md`, `RELEASE-PROCESS.md`, `ARCHITECTURE.md`,
  `sequence-mission-run.md`.
- **Local source reference** for contracts, workspace, execution, evidence, and
  interface-host entry points, generated to ignored `docs/api/` via `typedoc`.
- **Repository URL standardized** to `https://github.com/taras-polishchuk/operatoros-platform`
  across all artifacts.
- **Root `package.json` description tightened** for repository metadata:
  _"Local-first Mission execution platform. Operator-controlled runs, durable
  evidence ledger, and recoverable checkpoints."_
- **v1.0 release bundle** created at `artifacts/release-candidates/v1.0/` with
  manifest, manifest-of-manifests (`MANIFEST.json`), portfolio asset index
  (`PORTFOLIO.md`), and consolidated quality-gate evidence (`QUALITY-GATE.md`).

### Verified unchanged

- `architecture_sha256` = `1e79049d9ae5a328556378ff8235525cd0f692bfa317fd7da6dc2bcdb1f27610`
- `authority-lock.json` byte-identical
- 13 packages, 146/146 tests passing across 21 test files
- 5/5 architecture invariants, 8/8 frozen authorities
- All NFRs (PERF, REL-2, OPS-1, USE-1, AV-O6) PASS

### Carry-forward

- All technical debt (TD-001..TD-006) carried forward verbatim — see
  `artifacts/release-candidates/v1.0/technical-debt.md`.
- v1.1 backlog unchanged — see `artifacts/release-candidates/v1.0/v1.1-backlog.md`.
- All architecture deltas (D-001..D-006) carried forward — see
  `artifacts/release-candidates/v1.0/architecture-deltas.md`.
- v0.8 → v1.0 migration notes unchanged — see
  `artifacts/release-candidates/v1.0/migration-from-v08.md`.

- LICENSE is MIT and is present at the repository root. Package metadata and the shipped license are consistent.

---

## [1.0.0-rc1] - 2026-07-20

The release-candidate snapshot recorded 132 tests across 20 files; the final v1.0 release added 14 CLI tests.

### Milestones closed

- **M0 Local Bedrock** — IP-001..IP-012 + IP-V0.
- **M1 Agent Execution** — IP-101..IP-104 + IP-V1.
- **M2 Extensibility** — IP-201..IP-205 + IP-V2.
- **M3 Operator-hosted** — IP-301..IP-304 + IP-V3.
- **M4 Distributed** — IP-401..IP-403 + IP-V4.

### Release gates

| Gate                         | Status |
| ---------------------------- | ------ |
| E (architecture consistency) | PASS   |
| G (implementation readiness) | PASS   |
| H (production hardening)     | PASS   |
| K (release readiness)        | PASS   |

### NFR matrix

| NFR                            | Target              | Observed                                          |
| ------------------------------ | ------------------- | ------------------------------------------------- |
| NFR-PERF throughput            | >= 1000 ops/sec     | 3602–4009 ops/sec across three 5000-mutation runs |
| NFR-REL-2 RTO                  | < 30000 ms          | 40 ms                                             |
| NFR-OPS-1 local deployment     | isolated workspaces | 2 distinct stores                                 |
| NFR-USE-1 cold start           | < 5000 ms           | 88 ms                                             |
| AV-O6 secret value never leaks | none                | none                                              |

### Test totals

146 tests across 21 test files, coverage thresholds 80%/80%/80%/70% (lines/functions/statements/branches).

### Notes

- Architecture SHA-256 unchanged: `1e79049d9ae5a328556378ff8235525cd0f692bfa317fd7da6dc2bcdb1f27610`.
- Public-clone authority verification is self-contained: `authority-lock.json` uses repository-relative `docs/authorities/` sources and `pnpm contracts:verify` verifies 8/8 snapshots.
- LICENSE selection (B-1 authority blocker) is owner-gated; release is publishable once LICENSE is set.

For the release notes bundled with this RC, see `artifacts/release-candidates/rc1/CHANGELOG.md`.
