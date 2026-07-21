# Security Policy

## Reporting vulnerabilities

Report vulnerabilities privately to the repository owner (Taras). Do not open public issues containing exploit details or secret material.

## Security defaults (RC1)

- **Default-deny capabilities.** Every `Capability Grant` is explicit; no implicit access.
- **No ambient secret access.** The Secrets Service is the only surface where secret material is consulted; `resolveSecret` returns a 4-char preview only.
- **No telemetry on a fresh Local profile.** The Local profile is offline-deterministic.
- **Secret References only.** Persistent storage carries `SecretReference` records, never raw values.
- **Zero canary leakage at every release gate.** Gate H (security/license/SBOM) and Gate K (release readiness) both PASS in RC1.
- **`.strict()` on every entity schema.** Prevents silent Zod strip of unknown keys.
- **Bounded selectors.** `identityReference`, `workspaceReference`, `correlationReference` regexes are bounded.
- **No raw secret persistence.** `materialization_forbidden` flag is read at register time.
- **Fencing token preemption on recovery leases.** Prevents zombie processes from advancing state.
- **SQLite WAL + BEGIN IMMEDIATE + synchronous=FULL** for the canonical evidence ledger.
