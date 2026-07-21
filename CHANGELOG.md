# Changelog

All notable changes to OperatorOS Platform are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-rc1] - 2026-07-20

First Release Candidate of OperatorOS Platform — the canonical successor to OperatorOS v0.8.x.

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

| NFR                            | Target              | Observed          |
| ------------------------------ | ------------------- | ----------------- |
| NFR-PERF throughput            | >= 1000 ops/sec     | 3850 ops/sec      |
| NFR-REL-2 RTO                  | < 30000 ms          | 40 ms             |
| NFR-OPS-1 local deployment     | isolated workspaces | 2 distinct stores |
| NFR-USE-1 cold start           | < 5000 ms           | 88 ms             |
| AV-O6 secret value never leaks | none                | none              |

### Test totals

132 tests across 20 test files, coverage thresholds 80%/80%/80%/70% (lines/functions/statements/branches).

### Notes

- Architecture SHA-256 unchanged: `1e79049d9ae5a328556378ff8235525cd0f692bfa317fd7da6dc2bcdb1f27610`.
- All 8 frozen authorities verified via `authority-lock.json`.
- LICENSE selection (B-1 authority blocker) is owner-gated; release is publishable once LICENSE is set.

For the release notes bundled with this RC, see `artifacts/release-candidates/rc1/CHANGELOG.md`.
