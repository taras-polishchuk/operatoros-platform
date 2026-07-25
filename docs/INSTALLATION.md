# Installation

## Prerequisites

- Node.js 22 or newer
- pnpm 9 (the repository pins pnpm 9.15.9)
- 2 GB RAM for the complete quality/build workflow

## Installation boundary

OperatorOS Platform v1.0 is distributed as this repository. All workspace packages are private implementation units and are not published as registry packages.

## From source

```sh
git clone https://github.com/taras-polishchuk/operatoros-platform.git
cd operatoros-platform
corepack enable
pnpm install --frozen-lockfile
pnpm quality
```

## Verify the installation

```sh
pnpm test
```

A release-ready checkout should report the test count printed by the current checkout; do not rely on a stale fixed total in documentation.

## Troubleshooting

- **`pnpm` is not found:** run `corepack enable`, then retry. Use Node 22+.
- **Port conflict:** the Local profile needs no network port. Stop another development server or choose an unused port when exercising hosted/interface adapters.
- **SQLite experimental warning:** `node:sqlite` is currently experimental (TD-001). The warning is expected; OperatorOS uses one adapter per package and SQLite WAL for canonical evidence.
- **Out of memory:** close other build processes and provide at least 2 GB RAM before running `pnpm quality`.
- **Frozen lockfile failure:** use the repository's pnpm version and do not regenerate the lockfile casually; run `pnpm install` only when intentionally updating dependencies.
- **Coverage mismatch:** run `pnpm test:coverage` from the repository root so all packages are included.
