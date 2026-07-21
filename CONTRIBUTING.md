# Contributing

This is a Release Candidate (`v1.0.0-rc1`). The architecture is frozen. All changes go through the formal successor-ADR path.

## Before opening a change

1. Read `docs/authorities/architecture.md` and `docs/authorities/implementation-roadmap.md`.
2. Map every behavior change to a Functional Specification ID (FR-/AV-/NFR-).
3. Follow RED-GREEN-REFACTOR: a failing test exists for every fix or feature.
4. Do not change Domain entities, lifecycles, authorities, component boundaries, or observable contracts without the formal successor-ADR path.
5. Do not modify `authority-lock.json` without rerunning `pnpm contracts:verify`.

## Local development

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm quality
```

## Pre-commit checklist

```sh
pnpm format
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm build
pnpm contracts:verify
pnpm architecture:check
pnpm run docs:build
pnpm security:scan
pnpm licenses:report
pnpm sbom
```

## Style

- TypeScript for new web packages.
- Zod for runtime validation at every external boundary.
- Drizzle ORM for typed SQL when relational access is needed.
- `.strict()` on every entity schema to prevent Zod silent strip.
- No commit of secrets, `.env` files, generated reports, or evidence containing secret values.

## Mission State

Every multi-hour autonomous mission lives at `/home/taras/projects/.project-state/<slug>/` with the standard 8 file set. A new mission MUST NOT be added inside this repository (enforced by `bin/validate-workspace.sh` if configured).

## Release process

1. Bump package versions across all 13 packages (each is currently `1.0.0-rc1`).
2. Run the full quality gate plus `pnpm docs:build`.
3. Assemble RC artifacts under `artifacts/release-candidates/<n>/` mirroring the RC1 layout.
4. The license is owner-gated (B-1 authority blocker). Releases are publishable once LICENSE is selected.
