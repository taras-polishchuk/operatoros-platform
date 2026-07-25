# ADR-W2-DR-001 — Workspace OS State Authority is Single-Host

**Status:** RATIFIED (canonical verdict: NO multi-host)
**Date:** 2026-07-22
**Deciders:** Taras Polishchuk (operator) + Workspace OS V2 architecture
**Mission:** workspace-os-v2-autonomous-impl-2026-07-22
**Cross-references:** FINAL-RELEASE-PLAN §1 v0.1-α R19; FINAL-WORK-PACKAGES WP-13

---

## 1. Decision

**Workspace OS v2 state authority is single-host only. Multi-host semantics are explicitly out of scope.**

- Workspace OS `state.db` (at `/home/taras/projects/.wsos/state.db`) is owned and written only by the WSL host (`dragon` / `100.97.71.14`).
- No remote writer to Workspace OS state will be added. The macbook-pro Factory consumer reaches Workspace OS state only via the kanban-bridge HTTP shim, which is a Hermes kanban writer (a separate concern), not a Workspace OS state writer.
- "Bridge reachability" (kanban-bridge listens on `100.97.71.14:7777` and is reachable from any Tailscale peer) is **distinct** from "Workspace OS state authority" — the bridge exposes Hermes kanban operations, not Workspace OS `state.db` writes.
- Future reconsideration triggers (all must hold to override this NO):
  1. A new product surface needs to write Workspace OS state from a non-WSL host, AND
  2. Tailscale ACL + R4 split-tokens + R23 firewall can be enforced atomically, AND
  3. A formal ADR supersedes this one with documented operational runbook for split-host reconciliation.

## 2. Tailscale peer audit (current state)

```
$ tailscale status
100.97.71.14    dragon       taras-polishchuk@  linux    -
100.101.162.38  dragon-1     taras-polishchuk@  windows  -
100.83.22.116   macbook-a    taras-polishchuk@  macOS    -
100.116.202.81    macbook-pro  taras-polishchuk@  macOS    active; direct 192.168.0.127:41641, tx 31852 rx 30460
```

| Peer                         | Host    | OS      | Role vs Workspace OS state                | Role vs Hermes kanban                                  |
| ---------------------------- | ------- | ------- | ----------------------------------------- | ------------------------------------------------------ |
| dragon (100.97.71.14)        | WSL     | linux   | **OWNER / sole writer**                   | Bridge listener host                                   |
| dragon-1 (100.101.162.38)    | Windows | windows | No writer (filesystem-only via WSL share) | No reader                                              |
| macbook-a (100.83.22.116)    | —       | macOS   | No writer                                 | No reader                                              |
| macbook-pro (100.116.202.81) | HomeLab | macOS   | No writer (cross-host forbidden)          | **HTTP reader/writer via kanban-bridge** (separate DB) |

**Conclusion:** Zero remote writers to Workspace OS state. macbook-pro reaches Hermes kanban (a separate DB at `/home/taras/.hermes/kanban.db`) through the bridge, not Workspace OS state.

## 3. Bounded single-host runtime

Workspace OS v2 runtime is bounded as:

- **State DB:** `state.db` lives at `/home/taras/projects/.wsos/state.db`, only on WSL host `dragon`.
- **Validator:** `bin/validate-workspace.sh` runs only on the WSL host (or as read-only inspection from anywhere, with no writes).
- **Mission registry:** `.project-state/<slug>/` directories are created only by the WSL host's CLI invocation.
- **CLI (`workspace-os`):** every `init`, `mission`, `validate`, `agent run` invocation targets the WSL host's state DB.

What is NOT bounded by this ADR:

- The kanban-bridge HTTP shim — it is a separate subsystem with its own audit log (`~/.hermes/bridge-audit.log`) and ACL.
- Knowledge OS / Factory / CCP — each owns its own runtime; their state is independent of Workspace OS state.

## 4. Why NO, not DEFER

The R9 / R11 deferral covers operational decisions that _might_ require multi-host in the future (e.g. distributed validator quorum). This ADR is different:

- R9/R11 = "We don't know yet, defer the question."
- R19 = "We have inspected the system; multi-host is not required for any current use case. Document the boundary explicitly so future maintainers don't infer multi-host from bridge exposure."

If a future need arises, it must be a separate ADR that supersedes this one, not an unstated extension.

## 5. Cross-references

| Document                               | Section    | Note                                                    |
| -------------------------------------- | ---------- | ------------------------------------------------------- |
| `FINAL-RELEASE-PLAN.md`                | §2 v0.1-α  | R19 listed in α scope; ADR required before v2.0-prod    |
| `FINAL-WORK-PACKAGES.md`               | WP-13      | Original WP definition                                  |
| `FINAL-DEPENDENCY-GRAPH.md`            | §3         | R19 listed under STOP-gate pair (paired with security)  |
| `FINAL-RISK-REGISTER.md`               | —          | R19 outcome feeds production gates                      |
| `GOVERNANCE/WORKSPACE-CONSTITUTION.md` | Article II | Tier-1 authority; this ADR is a Tier-2 product decision |

## 6. Acceptance criteria (binary)

| Criterion                                          | Status                                                     |
| -------------------------------------------------- | ---------------------------------------------------------- |
| All observed peers have read/write role documented | ✅ (4/4 peers in §2 table)                                 |
| No remote writer to Workspace OS state found       | ✅ (only dragon owns `state.db`)                           |
| Operator ratifies NO                               | ✅ (this ADR is the ratification; canonical verdict = NO)  |
| Docs do not infer multi-host from bridge exposure  | ✅ (§1 explicitly distinguishes bridge vs state authority) |

---

**Signature block:** This ADR is the canonical R19 ratification. Operators may override via a new ADR with strict supersession notice.
