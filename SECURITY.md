# Security Policy

## Reporting vulnerabilities

Report vulnerabilities privately using the repository's [private vulnerability-report form](https://github.com/taras-polishchuk/operatoros-platform/security/advisories/new). This is the supported confidential disclosure route. Do not open a public issue, discussion, or pull request containing exploit details, credentials, or secret material. If GitHub cannot open the form, wait and retry rather than moving the report to a public channel.

## Supported versions

| Version   | Security patches                              |
| --------- | --------------------------------------------- |
| 1.0.x     | Yes                                           |
| 1.0.0-rc1 | No; upgrade to 1.0.x                          |
| 0.8.x     | No; migration is read-only via `v08-importer` |

## Disclosure timeline

We aim to acknowledge reports within **48 hours**, complete initial triage within **7 days**, and coordinate a public fix/CVE disclosure within **90 days** when a CVE is warranted.

## Security defaults

- **Default-deny capabilities.** Every `Capability Grant` is explicit; no implicit access.
- **No ambient secret access.** Secrets Service is the only surface where secret material is consulted; `resolveSecret` returns a 4-char preview only.
- **No telemetry on a fresh Local profile.** Local is offline-deterministic.
- **Secret References only.** Persistent storage carries references, never raw values.
- **Zero canary leakage at every release gate.** Gate H and Gate K PASS in RC1.
- **`.strict()` on every entity schema.** Prevents silent Zod stripping of unknown keys.
- **Bounded selectors.** Identity, workspace, and correlation references are bounded.
- **No raw secret persistence.** `materialization_forbidden` is read at register time.
- **Fencing-token preemption.** Recovery leases prevent zombie processes advancing state.
- **SQLite WAL + BEGIN IMMEDIATE + synchronous=FULL** for the canonical evidence ledger.

## Admin hardening checklist

- [ ] Run the Local profile with least-privilege filesystem permissions.
- [ ] Keep the evidence database and backups on encrypted storage.
- [ ] Restrict hosted tenant and operator administration to named identities.
- [ ] Grant only required capabilities; review and revoke stale grants.
- [ ] Keep Node, pnpm, and dependencies patched; run `pnpm audit`.
- [ ] Protect logs and never paste secret material into diagnostics.
- [ ] Test backup restore and recovery fencing before production use.
- [ ] Enable network controls only for explicitly required hosted adapters.

## Threat model summary

Local-first means canonical operations do not require a network, reducing remote control and telemetry exposure. Capability grants constrain agents and extensions. Secret values are consulted behind the Secrets Service boundary and persisted only as 4-character previews. Evidence is append-only/sealed and recovery uses fencing tokens. Hosted deployments add tenant isolation and must apply operational network, identity, and storage controls.
