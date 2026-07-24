# Contributing

Welcome! OperatorOS is built in the open around a frozen architecture and an operator-first safety model. Contributions should preserve human authority, durable evidence, and recoverable execution. Please follow the repository [Code of Conduct](CODE_OF_CONDUCT.md).

## Development setup

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm quality
```

`pnpm quality` runs formatting, lint, typechecking, coverage tests, build, contract verification, and architecture checks. Use `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm test apps/smoke` during iteration.

## Repository layout

- `packages/` — 13 private monorepo packages; none is published to npm in v1.0.
- `apps/` — executable and integration applications, including `apps/smoke/`.
- `tooling/` — verification, security, SBOM, and reporting tools.
- `docs/` — public guides, ADRs, frozen authorities, and a generated local source reference for five core entry points.
- `artifacts/` — release evidence and candidate bundles.

## Before opening a change

1. Read `docs/authorities/architecture.md` and `docs/authorities/implementation-roadmap.md`.
2. Map behavior changes to a Functional Specification ID (`FR-`, `AV-`, or `NFR-`).
3. Use RED-GREEN-REFACTOR: every fix or feature needs a focused test.
4. Do not change domain ownership, lifecycles, boundaries, or observable contracts without the formal successor-ADR path.

## Branching and pull requests

Work from `main`; use short-lived branches such as `docs/mission-guide` or `fix/evidence-retry`. Keep PRs focused. A PR should explain the problem, authority/requirement IDs, tests and quality commands run, compatibility impact, and any documentation or security implications. Do not commit generated reports, credentials, `.env` files, or secret-bearing evidence.

## Testing conventions

Place unit and contract tests beside the owning package or in its `test/` directory. Test public factories, schema boundaries, error codes, idempotency, optimistic conflicts, and recovery outcomes. Run the relevant package test first, then `pnpm test`, and finally the golden-path integration test in `apps/smoke/`. Tests must be deterministic and must not depend on the network or real customer data.

## Architecture authority and lock rules

The canonical guide is [`docs/authorities/architecture.md`](docs/authorities/architecture.md). `authority-lock.json` pins all frozen authorities. Do not modify `authority-lock.json`, and never change architecture SHA-256 `1e79049d9ae5a328556378ff8235525cd0f692bfa317fd7da6dc2bcdb1f27610`, except through an owner-approved successor-ADR and verified release process.

## Style and commits

- TypeScript for new production code; Zod at external boundaries; strict schemas.
- Use Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `build:`, `ci:`, or `chore:`.
- Keep JS methods/types camelCase and explicit wire fields snake_case.
- Never commit secrets or raw secret values.

## Issues and review

Use the repository issue templates for bug reports and feature requests. Questions and design discussion belong in GitHub Discussions; security reports follow [SECURITY.md](SECURITY.md).

## Release checklist

```sh
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm build
pnpm contracts:verify && pnpm architecture:check
```

See [docs/RELEASE-PROCESS.md](docs/RELEASE-PROCESS.md) for release branches and gates.
