# ADR-0001: TypeScript pnpm monorepo toolchain

- Status: Accepted
- Date: 2026-07-19
- Scope: Implementation mechanism only

## Context

The Roadmap mandates a separate `operatoros-platform` boundary, TypeScript-first packages, generated contracts, and runtime validation at every external boundary.

## Decision

Use Node.js 22, pnpm workspaces, TypeScript strict mode, Turbo task orchestration, Vitest, Zod, ESLint, Prettier, TypeDoc, CodeQL, dependency audit, license reporting, and CycloneDX SBOM generation.

## Consequences

This selects build/package tooling only. It does not change entities, authority, lifecycle, component responsibility, or observable behavior. Storage remains unselected until IP-003 crash-tested spikes complete.
