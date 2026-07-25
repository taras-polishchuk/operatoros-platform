#!/usr/bin/env bash
# OperatorOS Platform v1.0 Demo
# Runs the golden-path smoke and prints the observed NFR values.
# Requires: Node.js 22+, pnpm 9, working tree at repo root.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

# ─── Header ───────────────────────────────────────────────────────────────
cat <<'HEADER'

  ┌──────────────────────────────────────────────────────────────┐
  │             OperatorOS Platform v1.0 Demo                    │
  │                                                              │
  │  Local-first Mission execution with an evidence ledger.       │
  │  Architecture SHA-256:                                        │
  │  1e79049d9ae5a328556378ff8235525cd0f692bfa317fd7da6dc2bcdb1f27610 │
  └──────────────────────────────────────────────────────────────┘

HEADER

# ─── Sanity checks ───────────────────────────────────────────────────────
if ! command -v pnpm >/dev/null 2>&1; then
  echo "ERROR: pnpm not found. Install with 'corepack enable && corepack prepare pnpm@9.15.9 --activate'." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not found. OperatorOS Platform requires Node.js 22+." >&2
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [[ "${NODE_MAJOR}" -lt 22 ]]; then
  echo "ERROR: Node.js 22+ required; found $(node --version)." >&2
  exit 1
fi

# ─── Install if node_modules is missing ──────────────────────────────────
if [[ ! -d "${REPO_ROOT}/node_modules" ]]; then
  echo "› Installing dependencies with pnpm..."
  pnpm install --frozen-lockfile
fi

# ─── Run the golden-path smoke ───────────────────────────────────────────
echo "› Running golden-path smoke: pnpm test apps/smoke"
echo "──────────────────────────────────────────────────────────────"
pnpm test apps/smoke 2>&1 | tail -40
echo "──────────────────────────────────────────────────────────────"

# ─── Verify architecture is still pinned ─────────────────────────────────
echo "› Verifying frozen architecture SHA-256..."
pnpm --silent contracts:verify >/dev/null
pnpm --silent architecture:check >/dev/null
echo "  ✓ architecture SHA-256 unchanged"
echo "    1e79049d9ae5a328556378ff8235525cd0f692bfa317fd7da6dc2bcdb1f27610"

# ─── Observed NFR values (from v1.0 release evidence) ───────────────────
cat <<'NFR'

  ┌──────────────────────────────────────────────────────────────┐
  │          Observed NFR matrix (v1.0 release)                  │
  ├──────────────────────────────┬──────────────┬────────────────┤
  │ NFR                          │ Target       │ Observed       │
  ├──────────────────────────────┼──────────────┼────────────────┤
  │ NFR-PERF throughput          │ ≥ 1000 ops/s │ 3602–4009      │
  │ NFR-REL-2 RTO                │ < 30000 ms   │ 40 ms          │
  │ NFR-OPS-1 local deployment   │ isolated ws  │ 2 distinct     │
  │ NFR-USE-1 cold start         │ < 5000 ms    │ 88 ms          │
  │ AV-O6 secret value never leaks│ none         │ none           │
  └──────────────────────────────┴──────────────┴────────────────┘

NFR

echo "  ✓ OperatorOS Platform v1.0 — golden path PASSED"
echo "    13 packages · current test totals are reported by pnpm quality · 8 authorities locked"
echo "    See docs/ and README.md for the canonical reference."
