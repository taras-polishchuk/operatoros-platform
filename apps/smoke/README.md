# Smoke app

> **Golden-path integration test · all 13 packages**

## What

`apps/smoke` is the repository's golden-path integration test, not the public CLI. It composes local stores, initializes a Workspace, exercises Mission/evidence, governance, agent, extension, hosted, and distributed coordination flows, then closes resources.

## How to run

From the repository root:

```sh
pnpm test apps/smoke
```

## Expected output

A passing run reports the smoke test as passed and includes its generated integration report, for example:

```text
✓ apps/smoke golden path
Test Files  1 passed
Tests       passed
```

The exact timing and report fields vary by environment. Use the totals printed by the current `pnpm quality` run; fixed counts in historical release evidence are not current acceptance proof.

## When it fails

- Confirm Node 22+ and run `pnpm install --frozen-lockfile`.
- Remove stale temporary smoke directories and rerun; the test creates isolated stores.
- For SQLite experimental warnings, see [Installation](../../docs/INSTALLATION.md); warnings are expected, failures are not.
- If a capability or authority assertion fails, run `pnpm contracts:verify` and `pnpm architecture:check` before opening an issue.
