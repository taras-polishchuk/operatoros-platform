# Publication Boundary

OperatorOS Platform v1.0 is a repository-distributed product. The 13 workspace packages are private implementation units and are not published to a package registry.

## Current state

| Surface | Current repository state | Publication authority |
| --- | --- | --- |
| Git repository | Local checkout; remote publication is not asserted here | Owner |
| Git tag | Not created by product-completion work | Owner |
| GitHub Release | Not created by product-completion work | Owner/tag workflow |
| GitHub Pages | Workflow exists; deployment depends on an owner push | Owner/push workflow |
| Package registry | Not published; package manifests are private | Successor ADR plus owner |
| Container image | Not produced | Future decision |
| SBOM | Local generated evidence via `pnpm sbom` | Validation workflow |

## Binding v1.0 decision

- The monorepo is the product boundary.
- Source installation uses pnpm from a checked-out repository.
- No standalone SDK, HTTP API application, registry package, hosted service, or multi-host deployment is part of the Local v1.0 deliverable.
- `.github/workflows/release-candidate.yml` validates and uploads evidence only.
- `.github/workflows/release.yml` may publish a GitHub Release only after an owner pushes a matching tag; manual dispatch is validation-only.

## Future package publication

Publishing a workspace package requires all of:

1. A successor ADR defining the public package boundary and compatibility policy.
2. A stable API independent of unpublished workspace internals.
3. Trusted owner-controlled publication credentials.
4. A clean-consumer test that installs the published artifact and runs its documented path.
5. Updated architecture, security, release, and rollback evidence.

Until then, do not document registry installation commands for `@operatoros-platform/*` packages.
