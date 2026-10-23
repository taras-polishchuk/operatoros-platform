# USING-OPERATOROS-PLATFORM.md

> **For whom.** This document is for someone who has the OperatorOS Platform repository on disk and wants to know what to actually do with it. It does not explain the architecture. It explains the daily workflow.

> **TL;DR (one paragraph).** OperatorOS Platform is a frozen-architecture TypeScript monorepo that defines a _contract_ for running Missions durably and observing them through an evidence ledger. It is **not** a daily-use tool. It is **not** something you `npm install` into your product. It is a repository you clone once, build, run `pnpm test apps/smoke` against to see the golden path, and otherwise leave alone. Real consumers (like AI Factory or any future product) will eventually import it as a TypeScript library; **today, no consumer does**. Your daily workflow lives in `workspace-os`, not in `operatoros-platform`. When you need a new capability from the platform, you write a v1.1 backlog candidate and let consumer demand drive it.

---

## 1. What exactly is OperatorOS Platform?

**OperatorOS Platform is a frozen-architecture TypeScript monorepo that defines a contract for executing Missions durably against an evidence ledger.**

In plain words:

- It is a **TypeScript code base**. 13 packages + 2 apps + 2 spikes.
- It implements one specific thing: **Missions are executed as Runs, every mutation is appended to an evidence ledger, and the ledger is integrity-checked**.
- It exposes a **public surface** of four operations: `interface.run`, `interface.explain`, `interface.inspect`, `interface.cancel`. That is the entire public API.
- The architecture (how those four operations are implemented in components) is **frozen at SHA `1e79049d…`**. You cannot redesign it. You cannot add a fifth operation.
- The implementation is **complete** and the code is **published at GitHub** as a tagged `v1.0.0` release. There is no further engineering work to do on v1.0.

What it is **not**:

- It is not a service that runs in the background. There is no daemon. There is no long-lived process you start.
- It is not a CLI you install. The CLI is in the repo (`apps/cli/dist/index.js`) and you invoke it directly from the repo root. It is not on your `PATH`.
- It is not something you import into your daily work today. No consumer in your workspace currently imports it. It is a **platform that is waiting for products**.
- It is not hosted, distributed, or multi-tenant. Those profiles are explicitly deferred to v1.1+ and v2.0+.

**One-line summary:** OperatorOS Platform is a frozen-contract TypeScript library that defines how Missions run. You clone it, build it, prove it works with a smoke test, and then it sits there until a real product needs it.

---

## 2. Workspace OS vs OperatorOS Platform

You have both directories in `/home/taras/projects/`. They are **completely different things** despite the similar names.

|                  | Workspace OS                                                                 | OperatorOS Platform                                            |
| ---------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Language**     | Python                                                                       | TypeScript                                                     |
| **Install**      | `pip install -e .` — `workspace-os` CLI is on PATH                           | Not installed. Lives in repo.                                  |
| **State**        | SQLite + `~/.local/share/workspace-os/state.db`                              | SQLite stores inside each workspace you `init`                 |
| **What it does** | Manages YOUR actual daily work: missions, validators, agent runs, audit logs | Defines a contract for how missions _should_ run durably       |
| **Used how**     | Every day, by you, through the CLI                                           | Rarely, by you, only to verify the platform works              |
| **Maturity**     | v2.0.0 (about to GA)                                                         | v1.0.0 LTS (released, lifecycle closed)                        |
| **Relationship** | Operational kernel — _runs_ your work                                        | Reference platform — _defines_ what durably running looks like |

**Why do both exist?**

- **Workspace OS** is your operational substrate. It manages your real missions today, in Python, with a SQLite state DB. It is installed in your system.
- **OperatorOS Platform** is a **frozen TypeScript contract** that says: "if you want a mission system with strict durability, evidence-ledger integrity, and capability-scoped agents, here is the architecture." It is a _reference_ and a _platform_ for future products.

**Why are they separate repositories?**

Because they have different languages, different install models, different lifecycles, and different audiences. Workspace OS is a daily tool. OperatorOS Platform is a frozen-contract library for product builders.

**What belongs in each?**

- **Workspace OS** (`/home/taras/projects/workspace-os/`): your daily work, mission state files (`.project-state/<slug>/`), agent runs, validators.
- **OperatorOS Platform** (`/home/taras/projects/operatoros-platform/`): the 13 packages + 2 apps + 2 spikes, plus its docs, tests, release artifacts. Nothing from your daily work goes here.

**Concrete example:** if you start a new mission today for "fix the validation bug", that mission lives in `/home/taras/projects/.project-state/<slug>/` and is operated by `workspace-os`. It has nothing to do with OperatorOS Platform. OperatorOS Platform defines what a _proper_ mission-execution architecture would look like — which is a different question.

---

## 3. How do the repositories in `/home/taras/projects/` work together?

You have many sibling directories under `/home/taras/projects/`. Here is the expected relationship:

```
/home/taras/projects/
│
├── workspace-os/                  ← Operational kernel (installed CLI)
│                                   You use this daily.
│
├── operatoros-platform/            ← Frozen-contract platform library
│                                   You rarely touch this.
│
├── .project-state/<slug>/          ← Mission state files
│                                   Created by `workspace-os mission new`.
│
├── knowledge-os/                  ← Parallel durable knowledge substrate
│
├── factory/                       ← AI Content Factory (consumer product)
│
├── career/                        ← Career OS
│
├── product-team/                  ← AI Job Application Assistant
│
├── homelab-staging/               ← Infrastructure registry
│
└── (other products, archives, etc.)
```

**The relationship:**

- **Workspace OS** _operates_ your missions. It is your CLI.
- **OperatorOS Platform** _defines_ what a durable Mission-execution contract would look like. It is a frozen reference.
- **The products** (knowledge-os, factory, career, product-team, homelab-staging) are _consumers_. They are real products that you build.
- **Mission State files** (`.project-state/<slug>/`) are _artifacts_ created when you run a mission through `workspace-os`.

**Today, no product imports OperatorOS Platform.** That is intentional. OperatorOS Platform v1.0 was released as a frozen contract; consumers will eventually adopt it when they need its durability guarantees. Until then, the Platform is a _standing offer_ — "if you build a product and need a durable mission-execution backend, here is the contract; integrate against it."

**Practical consequence:** when you are working in `/home/taras/projects/`, your daily operations live in `workspace-os`, your products live in their respective directories, and `operatoros-platform/` is the one you mostly leave alone except when you want to verify the platform still works or when you need to study the contract.

---

## 4. How do I personally use OperatorOS Platform in my daily work?

**Honest answer: mostly you do not.**

OperatorOS Platform is not part of your daily workflow. It is part of your _long-term infrastructure_. Here is what your daily workflow actually looks like:

**A normal day:**

1. **Morning.** You open your terminal. You might run `workspace-os mission list` to see what's in flight. You do **not** `cd` into `operatoros-platform/`.
2. **Pick a product.** Maybe `product-team/`, maybe `career/`, maybe a new idea. You `cd` into that product's directory.
3. **Work on the product.** You use Claude Code or your editor of choice. You write code. You run tests within that product. You commit.
4. **Use `workspace-os` to track missions.** When you start a real piece of work, you run `workspace-os mission new <slug>` and you get a directory at `.project-state/<slug>/` with 8 standard artifacts (`source-task.md`, `progress.md`, `decisions.md`, `blockers.md`, `artifacts.md`, `environment.md`, `execution-log.md`, `final-report.md`).
5. **Run agents, validators.** `workspace-os agent run -- <cmd>` for sub-agents, `workspace-os validate` to check the workspace.
6. **Ship the product.** Commit, push, deploy. Whatever the product's lifecycle is.

**Where does OperatorOS Platform appear in this flow?**

- **It does not appear.** Not today.

**When might it appear?**

- If `product-team` (or any future consumer) decides to import OperatorOS Platform's `interface-host` package to get durable mission execution, then `product-team/` would have an OperatorOS Platform dependency in its `package.json`. **Today, it does not.**

**So how do I ever use OperatorOS Platform?**

You use it in **three specific situations**:

1. **Once when you first encounter it:** you clone, install, run the smoke test to see what the platform does. That's the "first day" workflow (see §13 Example A).
2. **Rarely when you need to verify the platform is still working:** `cd operatoros-platform && pnpm test apps/smoke`. This takes 2 seconds and proves the contract is intact.
3. **If you ever write code that integrates with OperatorOS Platform:** then you would read the `OPERATOROS-PLATFORM-v1.0.0-CANONICAL-CONTEXT.md`, study the `interface-host` package, and import it. This is hypothetical for you today, but it is the future direction.

**Things you should NOT do with OperatorOS Platform daily:**

- Do not `cd` into it every morning.
- Do not run its tests as part of your product workflow (those tests are for the platform, not for you).
- Do not edit its code (architecture is frozen; if you find a real defect, file an issue).
- Do not try to install it as a global CLI.
- Do not import it from a product unless you have explicitly decided that product needs the durable-mission-execution guarantee.

---

## 5. Someone clones the GitHub repository. Now what?

**User journey: from `git clone` to "actually using the platform".**

### Step 1: Clone

```bash
git clone https://github.com/taras-polishchuk/operatoros-platform.git
cd operatoros-platform
```

### Step 2: Verify your environment

The platform requires:

- Node.js 22+ (check with `node --version`)
- pnpm 9.15.9 (check with `pnpm --version`)
- Linux/macOS/WSL

### Step 3: Install dependencies

```bash
corepack enable
pnpm install --frozen-lockfile
```

This installs 12 devDeps (TypeScript, Vitest, ESLint, Prettier, Turbo, typedoc, pnpm overrides, etc.). It does **not** install any production dependencies — the platform has zero production deps because it is private and not published to npm.

### Step 4: Verify the platform works

Two equivalent ways:

```bash
# Option A: the canonical quality gate (14 steps; ~6 seconds)
pnpm quality

# Option B: just the smoke test (3 tests; ~2 seconds)
pnpm test apps/smoke
```

If both succeed, the platform works. You should see:

- `Test Files 22 passed (22)`
- `Tests 154 passed (154)`
- `Architecture SHA-256 unchanged`
- `Contracts: 8/8 verified`

### Step 5: Try the demo

```bash
pnpm demo
```

This runs the golden-path smoke, prints the NFR matrix (throughput, RTO, cold start), and verifies the architecture is still pinned. It is the easiest way to _see_ what the platform does.

### Step 6: Try the CLI manually

```bash
# Build the CLI
pnpm --filter @operatoros-platform/cli build

# Initialize a fresh workspace
node apps/cli/dist/index.js --workspace /tmp/my-test-ws init

# Inspect what you just created
ls /tmp/my-test-ws
# Should show: evidence.sqlite governance.sqlite execution.sqlite workspace.sqlite

# Start a Mission run
node apps/cli/dist/index.js --workspace /tmp/my-test-ws mission run \
  --workspace-ref workspace_local:test \
  --mission-ref mission_local:m1 \
  --specification-ref spec_local:s1 \
  --identity identity://test \
  --correlation corr-1
```

You should get a JSON response with a `run_ref` and a `mission_record_ref`. The CLI just executed a Mission end-to-end.

### Step 7: Read the canonical context

```bash
# Inside the repo root, open:
OPERATOROS-PLATFORM-v1.0.0-CANONICAL-CONTEXT.md
# And:
AI-CONTEXT-OPERATOROS.md
```

These two documents explain everything about the platform without you having to explore the source code.

### What you have just done

You have:

- Cloned a frozen-contract TypeScript monorepo.
- Installed its devDeps.
- Verified the contract is intact (8/8 authorities, 5/5 invariants, 154 tests pass).
- Run the smoke test (3 tests that prove end-to-end mission execution works).
- Run the demo (which prints NFR numbers and confirms architecture SHA is unchanged).
- Built and invoked the CLI (init + mission run).
- Read the canonical context.

**That is the entire onboarding journey.** It takes about 10 minutes.

### What you can build with it (the realistic answer)

**Today, in the immediate term: nothing.** The platform is a _contract_. It defines how a future consumer would integrate. There is no consumer in your workspace today that imports it.

**In the medium term, when AI Factory (or another product) integrates:** the product would import `@operatoros-platform/interface-host` to get durable mission execution. That integration work is real engineering and is part of the v1.1+ roadmap.

**The honest framing:** OperatorOS Platform is a _standing offer_ to future product builders, not a current tool. You have it in your workspace because you wrote it, not because your daily work uses it.

---

## 6. Is OperatorOS Platform supposed to run continuously?

**No.**

OperatorOS Platform is **not** a long-running service. There is no daemon. There is no background process. There is no "OperatorOS server" you start.

What actually happens:

- **The CLI binary** (`apps/cli/dist/index.js`) runs when you invoke it. It starts, processes one command (init / mission run / explain / version / help / inspect / cancel), prints JSON, and exits. Total runtime: ~50–500ms.
- **The SQLite stores** that `init` creates live in the workspace directory you specify. They persist between CLI invocations but **no process owns them** between calls.
- **The smoke test** (`apps/smoke/`) is a test that runs once when you execute `pnpm test apps/smoke`. It creates a temporary workspace, runs the golden path, asserts the results, and tears down. Total runtime: ~2 seconds.

So how would you describe what OperatorOS Platform is?

- **A library.** The 13 packages are importable TypeScript code.
- **A CLI.** The `apps/cli/dist/index.js` binary is a thin wrapper around the library's interface-host dispatcher.
- **A reference architecture.** The frozen SHA `1e79049d…` is the contract.

It is **not** a framework. You do not extend OperatorOS Platform by subclassing it.

It is **not** a runtime. There is no host process.

It is **not** a toolkit in the casual sense. It is a tightly-scoped, frozen-contract monorepo.

**The cleanest description:** OperatorOS Platform is a **library + CLI + frozen contract**. The library is the 13 packages. The CLI is the executable wrapper. The contract is the architecture SHA.

If a future consumer (AI Factory, Knowledge OS, etc.) wants to use it, they:

1. Add `@operatoros-platform/interface-host` (and friends) to their `package.json`.
2. Call the four operations.
3. Get durable mission execution with evidence-ledger integrity.

That integration is real engineering work and is the future v1.1+ direction.

---

## 7. How would AI Factory use it? How would another product use it?

**Concrete workflow examples.**

### AI Factory example (hypothetical, future)

Imagine `factory/` decides it needs durable mission execution for its content-production pipeline. The integration would look like:

```ts
// In factory's pipeline code (hypothetical):
import { interfaceHost } from '@operatoros-platform/interface-host';
import { initWorkspace } from '@operatoros-platform/workspace-service';

const ws = await initWorkspace('/var/factory/workspaces/content-pipeline');
const result = await interfaceHost.run({
  workspace_ref: 'workspace_factory_content',
  mission_ref: 'mission_production_run_42',
  specification_ref: 'spec_publish_pipeline',
  identity: 'identity://factory-production-bot',
  correlation: 'corr_2026_07_25_run_42',
});

// result.run_ref is the durable identifier.
// Every mutation is in the evidence ledger.
// If the process crashes, recovery resumes from the last checkpoint.
```

In this scenario:

- `factory/` declares `@operatoros-platform/interface-host` as a workspace dependency in `factory/package.json`.
- `factory/` invokes the four operations through the in-process dispatcher.
- The SQLite stores (`evidence.sqlite`, `workspace.sqlite`, etc.) live in `/var/factory/workspaces/`.
- Every Mission run produces an evidence record that `factory/` can audit later.
- Recovery, fencing tokens, capability grants — all handled by OperatorOS Platform, not by `factory/`.

**What factory would gain:** durable mission execution with integrity-checked evidence, recovery from crashes, and capability-scoped agent invocation. **What factory would NOT need to build:** checkpoint logic, ledger integrity, fencing-token preemption.

### Another product example (hypothetical)

A future product that wants to be "AI-native with durability" would:

1. Add OperatorOS Platform as a workspace dependency.
2. Use the 4 interface operations as the only way it talks to "durable state".
3. Read `OPERATOROS-PLATFORM-v1.0.0-CANONICAL-CONTEXT.md` to understand the contract.
4. Treat the architecture SHA as a binding constraint.

**This is real future engineering work.** Today, no consumer does this. Tomorrow, AI Factory might.

---

## 8. Where does OperatorOS Platform fit in my day?

Here is your day, with OperatorOS Platform's exact position:

```
Morning
  ↓
Pick a product (product-team, career, factory, etc.)
  ↓
Open that product's directory
  ↓
Work in that product (code, test, commit)
  ↓
If a mission is in flight, use workspace-os to update progress
  ↓
If a real defect appears in OperatorOS Platform (rare), open it
  ↓
Ship the product
```

**OperatorOS Platform's position in this flow:**

- **Does not appear in 99% of your day.**
- Appears only when:
  - You want to verify the platform contract is intact (rare; `pnpm test apps/smoke`).
  - You find a real defect in the platform itself (very rare; LTS means no real defects expected).
  - You are studying the contract for a future integration (planning work, in `.project-state/<slug>/`).
  - You are writing a v1.1 backlog candidate (planning work).

**There is no morning step where you `cd operatoros-platform`.**

---

## 9. What parts of the repository are only for developers of the Platform itself?

### For Platform developers (people who maintain OperatorOS Platform):

| Path                                                   | What it is                                                                                                           |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `packages/`                                            | 13 packages implementing the architecture. If you are fixing a real defect, you edit here.                           |
| `apps/cli/`                                            | The CLI wrapper.                                                                                                     |
| `apps/smoke/`                                          | The smoke test.                                                                                                      |
| `spikes/`                                              | Performance/persistence experiments.                                                                                 |
| `docs/authorities/`                                    | **Frozen.** You do NOT edit these unless you are doing a successor-ADR.                                              |
| `authority-lock.json`                                  | **Frozen.** You do NOT edit this.                                                                                    |
| `tooling/`                                             | Verification scripts (contracts:verify, architecture:check, security:scan, license-report, sbom, verify-clean-tree). |
| `scripts/`                                             | Tag creation, demo.                                                                                                  |
| `.github/`                                             | CI workflows, dependabot, CODEOWNERS.                                                                                |
| `artifacts/release-candidates/v1.0/`                   | The release bundle (11 SHA-verified artifacts).                                                                      |
| `CHANGELOG.md`, `CURRENT-PROJECT-STATE-AND-ROADMAP.md` | Historical record.                                                                                                   |

### For people using the Platform:

| Path                                              | What it is                                |
| ------------------------------------------------- | ----------------------------------------- |
| `OPERATOROS-PLATFORM-v1.0.0-CANONICAL-CONTEXT.md` | The long-term reference for users.        |
| `AI-CONTEXT-OPERATOROS.md`                        | The compact AI-ready reference for users. |
| `README.md`                                       | The public overview.                      |
| `docs/INSTALLATION.md`                            | How to install.                           |
| `docs/GETTING-STARTED.md`                         | How to start.                             |
| `docs/DEPLOYMENT.md`                              | What is deployed where.                   |
| `docs/FAQ.md`                                     | Common questions.                         |
| `docs/RELEASE-PUBLICATION.md`                     | What is and is not published.             |
| `apps/cli/README.md`                              | CLI reference.                            |
| `packages/<name>/README.md` (13 files)            | Per-package reference.                    |
| `homepage/`                                       | The landing page (browser-viewable).      |

**The split is clean:** Platform developers live in `packages/`, `apps/`, `spikes/`, `tooling/`, `docs/authorities/`. Platform users live in `OPERATOROS-PLATFORM-v1.0.0-CANONICAL-CONTEXT.md`, `AI-CONTEXT-OPERATOROS.md`, `README.md`, `docs/`, and the per-package READMEs.

If you are a Platform **user**, you almost never need to open `packages/`. You read the canonical context, study the contract, and (when integrating) import from `@operatoros-platform/interface-host`.

---

## 10. When should I NOT open this repository?

**You should NOT open `operatoros-platform/` when:**

1. **You are doing your daily work in `workspace-os`.** Mission state, validators, agent runs — none of that uses OperatorOS Platform.
2. **You are working on a product** (`product-team/`, `career/`, `factory/`, etc.) and there is no integration with OperatorOS Platform. Today: every product.
3. **You are tempted to "fix" something in OperatorOS Platform because it looks wrong.** Architecture is frozen. If you think something is wrong, file an issue; do not edit.
4. **You want to add a new feature.** OperatorOS Platform v1.0 is closed. New features go in v1.1+ which is gated by consumer demand and successor-ADR.
5. **You want to "modernize" the code.** It is already on TypeScript strict, ESLint type-checked, zero `any`, zero `@ts-ignore`. There is nothing to modernize.
6. **You are bored and want to refactor.** No. The contract is the contract.
7. **You think the README is wrong.** Edit the README, not the architecture.
8. **You want to test something quickly.** Use `pnpm test apps/smoke` from inside the repo. Don't open every file.
9. **You want to understand Workspace OS.** Workspace OS is in `workspace-os/`, not `operatoros-platform/`.

**The strongest signal you should not open it:** if your task has nothing to do with the platform contract, mission durability, evidence-ledger integrity, or capability-scoped agents, then OperatorOS Platform is irrelevant to your work.

---

## 11. When SHOULD I open this repository?

**Concrete examples where opening `operatoros-platform/` is the right move:**

1. **You are studying the contract** to plan a future integration. Example: AI Factory team is considering importing `@operatoros-platform/interface-host` for durable execution. You open the canonical context, study the 4 interface operations, understand the evidence model.
2. **You found a real defect** in a consumer that is traced back to OperatorOS Platform. Example: a test in `product-team/` reveals a bug in mission-cancellation logic. You open the relevant package, file a clear bug report with reproduction.
3. **You want to verify the platform still works** after a long pause. Example: it's been 3 months since you last touched it. You run `pnpm quality` and confirm 14/14 still pass.
4. **You are writing a v1.1 backlog candidate.** Example: "consumer X needs durable agent-output streaming." You open the architecture, study what would change, write a candidate backlog item.
5. **You are onboarding a new collaborator** who needs to understand the contract. You point them at `OPERATOROS-PLATFORM-v1.0.0-CANONICAL-CONTEXT.md` and `AI-CONTEXT-OPERATOROS.md`.
6. **You are documenting the platform** for a public audience. You open the canonical context, the homepage, the per-package READMEs.
7. **You are doing the AI Ecosystem pilot** and want to integrate OperatorOS Platform with Knowledge OS / CCP / Factory. You study the architecture and plan the integration.
8. **You are running the smoke test as part of a CI check** for a product that _does_ depend on the platform. The smoke runs `pnpm test apps/smoke` from the platform repo as a precondition.

**The strongest signal you SHOULD open it:** if your task is about the platform contract, durability guarantees, evidence integrity, or planning an integration.

---

## 12. How will I know a product has discovered a real Platform limitation?

**The decision rule: "Is this a consumer problem or a platform problem?"**

You have discovered a **Platform limitation** (not a consumer problem) when:

1. **Multiple consumers hit the same wall.** If only `product-team` is complaining, it's probably a consumer problem. If `product-team`, `knowledge-os`, and `factory` all hit the same wall, it's a Platform problem.
2. **The wall is in the contract.** The contract is the 4 interface operations + the evidence ledger + the recovery model. If your consumer needs something outside that contract, that's a Platform limitation.
3. **The fix would require a successor-ADR.** If the proposed change touches the architecture SHA, it is by definition a Platform limitation.
4. **The wall is durable.** A transient bug that can be fixed in a v1.0.x patch is a Platform bug, not a Platform limitation.

You have discovered a **consumer problem** (not a Platform limitation) when:

1. **Only one consumer is affected.** Even if it's painful for that one consumer.
2. **The wall is in the consumer's code.** The consumer is mis-using the API; the contract is fine.
3. **The fix is in the consumer.** Change the consumer, not the platform.
4. **The consumer can work around it.** If a workaround exists, it is a consumer problem.

**The litmus test:**

- "I should change OperatorOS Platform" — when the consumer is correctly using the contract, the contract is being followed, and the consumer still cannot accomplish its goal **because the contract itself is too restrictive**.
- "I should change the consumer (e.g. AI Factory)" — when the consumer is trying to do something the contract intentionally does not support, or has a bug in its integration code.

**Examples:**

| Symptom                                                                                                                  | Likely diagnosis                                                       |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| AI Factory wants to publish agent outputs as a stream, but the contract is `interface.run` returns a single final result | Platform limitation (or scope decision)                                |
| AI Factory is mis-using `--workspace-ref` and getting a validation error                                                 | Consumer problem                                                       |
| Knowledge OS wants to query historical runs in bulk, but `interface.inspect` returns one record                          | Platform limitation                                                    |
| Product-team is trying to call a 5th interface operation that doesn't exist                                              | Platform limitation (or "no, that's v1.1 work")                        |
| A consumer's Mission run is failing because of a SQLite WAL bug                                                          | Platform bug (fix in v1.0.x)                                           |
| A consumer wants npm-distributed packages                                                                                | Platform scope (out of v1.0; deferred per docs/RELEASE-PUBLICATION.md) |

**When in doubt:** the Platform is right by default. The contract is the contract. If a consumer cannot accomplish its goal, the right answer is usually to change the consumer, not to re-open the platform.

---

## 13. Three complete example workflows

### Example A: A new developer clones the repository

**Context:** A friend sees your GitHub repo and clones it to study the architecture.

```bash
# 1. Clone
git clone https://github.com/taras-polishchuk/operatoros-platform.git
cd operatoros-platform

# 2. Verify environment
node --version    # 22+
pnpm --version    # 9.15.9

# 3. Install
corepack enable
pnpm install --frozen-lockfile
# (installs 12 devDeps; no production deps)

# 4. Run the canonical quality gate
pnpm quality
# Output (after ~10 seconds):
#   format:check        PASS
#   lint                PASS
#   typecheck           PASS
#   test:coverage       PASS (154/154, 80/80/80/70)
#   build               PASS (15/15 turbo tasks)
#   contracts:verify    PASS (8/8 authorities)
#   architecture:check  PASS (5/5 invariants, SHA 1e79049d...)

# 5. Run the demo
pnpm demo
# Output:
#   > Running golden-path smoke: pnpm test apps/smoke
#   ✓ apps/smoke/src/__tests__/golden-path.test.ts (3 tests) 1771ms
#   > Verifying frozen architecture SHA-256...
#     ✓ architecture SHA-256 unchanged
#       1e79049d9ae5a328556378ff8235525cd0f692bfa317fd7da6dc2bcdb1f27610
#   > Observed NFR matrix (v1.0 release)
#     throughput: 3602–4009 ops/s
#     RTO: 40 ms
#     cold start: 88 ms

# 6. Try the CLI manually
pnpm --filter @operatoros-platform/cli build
node apps/cli/dist/index.js --workspace /tmp/newcomer-ws init
# {"workspace_root":"/tmp/newcomer-ws","schema_version":"1.0.0","stores":["evidence","workspace","governance","execution"]}

ls /tmp/newcomer-ws
# evidence.sqlite  governance.sqlite  execution.sqlite  workspace.sqlite

node apps/cli/dist/index.js --workspace /tmp/newcomer-ws mission run \
  --workspace-ref workspace_local:test \
  --mission-ref mission_local:m1 \
  --specification-ref spec_local:s1 \
  --identity identity://test \
  --correlation newcomer-1
# {"run_ref":"run_newcomer-1","mission_record_ref":"mission_record_...","record_version":1}

# 7. Read the canonical context
less OPERATOROS-PLATFORM-v1.0.0-CANONICAL-CONTEXT.md
less AI-CONTEXT-OPERATOROS.md

# Done. The developer now has a complete picture of what OperatorOS Platform is.
```

**Time: ~10 minutes. Outcome: complete understanding of the platform.**

### Example B: I build AI Factory using OperatorOS Platform

**Context:** Hypothetical future. AI Factory decides it needs durable mission execution.

**Step 1: Decide to integrate.**

AI Factory team opens `OPERATOROS-PLATFORM-v1.0.0-CANONICAL-CONTEXT.md` and `AI-CONTEXT-OPERATOROS.md`. They read the contract: 4 operations, evidence ledger, recovery model.

**Step 2: Add as workspace dependency.**

```yaml
# In factory/pnpm-workspace.yaml
packages:
  - '.'
  - '../operatoros-platform/packages/*'
  - '../operatoros-platform/apps/*'
```

```json
// In factory/package.json
{
  "dependencies": {
    "@operatoros-platform/interface-host": "workspace:*",
    "@operatoros-platform/workspace-service": "workspace:*"
  }
}
```

**Step 3: Use the interface.**

```ts
// In factory/src/pipeline/run.ts
import { interfaceHost } from '@operatoros-platform/interface-host';

export async function runContentPipeline(spec: ContentSpec): Promise<RunResult> {
  return interfaceHost.run({
    workspace_ref: `workspace_factory_${spec.id}`,
    mission_ref: `mission_publish_${spec.id}`,
    specification_ref: 'spec_publish_pipeline',
    identity: 'identity://factory-content-bot',
    correlation: spec.correlation_id,
  });
}
```

**Step 4: Run the smoke test as a CI check.**

```bash
# In factory CI:
cd ../operatoros-platform
pnpm test apps/smoke   # 3 tests, 2 seconds
cd ../../factory
pnpm test              # factory's own tests
```

**Step 5: Audit and ship.**

The factory can now audit every Mission run through the evidence ledger. Recovery from crashes is handled. Capability grants are explicit. AI Factory's content pipeline has durability guarantees it did not have before.

**Time: real engineering work, weeks not minutes.** This is the future direction.

### Example C: Six months later, I need a new Platform capability

**Context:** A consumer has hit a Platform limitation and you need to extend the Platform.

**Step 1: Confirm it is a Platform limitation (not a consumer bug).**

Use the rule from §12. Multiple consumers hitting the same wall? Is the wall in the contract? Would the fix require a successor-ADR?

If yes, it is a Platform limitation. Move to step 2.

**Step 2: Write a v1.1 backlog candidate.**

Open `/home/taras/projects/operatoros-platform/artifacts/release-candidates/v1.0/v1.1-backlog.md`. Add a candidate entry:

```markdown
## v1.1 Candidate: Streaming agent outputs

**Problem.** AI Factory's content pipeline needs to stream agent outputs in real-time.
The current contract (`interface.run`) returns a single final result, blocking until
the entire run is complete.

**Consumer.** AI Factory (`factory/`).

**Evidence.** Production logs from 2026-Q4 show average wait times of 45 seconds
for content-production runs. Streaming would reduce this to <5 seconds perceived latency.

**Proposed change.** Add a `interface.stream` operation that returns a streaming
response. Touches the architecture SHA (new interface operation).

**Status.** Backlog candidate. Awaiting successor-ADR + operator decision.
```

**Step 3: Trigger the successor-ADR cycle.**

Operator decides: should this become a v1.1 work item? If yes:

1. Open a new `successor-ADR` document explaining the architectural change.
2. Update the architecture with a new SHA (different from `1e79049d…`).
3. Update `authority-lock.json` to reference the new SHA.
4. Implement the change.
5. Update all 8 frozen authorities.
6. Run all 4 release gates.
7. Publish a new GitHub Release `v1.1.0`.

**Step 4: If operator says NO.**

The candidate stays in v1.1 backlog. No work is done on v1.0. Consumers continue with the existing contract.

**Time: from backlog candidate to v1.1 release, weeks to months.** This is real engineering work that happens only when justified by consumer demand.

---

## 14. Common misconceptions

### "OperatorOS Platform is a daily tool."

**Wrong.** It is a frozen-contract monorepo. Your daily tool is `workspace-os`. You rarely open OperatorOS Platform.

### "OperatorOS Platform should be installed globally as `operatoros` CLI."

**Wrong.** The CLI binary is at `apps/cli/dist/index.js` and you run it from there. It is **not** on your PATH. It is **not** meant to be on your PATH. The 13 packages are `private: true` and not published to npm.

### "I should `npm install @operatoros-platform/interface-host` in my product."

**Wrong (today).** The packages are private. The right move is to add OperatorOS Platform as a workspace dependency in your monorepo (see Example B). When (if) the Platform ever publishes to npm, this would change — but per `docs/RELEASE-PUBLICATION.md`, npm publication is explicitly deferred and requires a successor ADR.

### "OperatorOS Platform is the same as Workspace OS."

**Wrong.** Workspace OS is an installed Python CLI that runs your daily work. OperatorOS Platform is a frozen-contract TypeScript monorepo that defines what a durable mission-execution architecture would look like. They are different languages, different install models, different lifecycles.

### "I should re-design OperatorOS Platform to be more flexible."

**Wrong.** Architecture is frozen at SHA `1e79049d…`. The whole point is that it is _not_ flexible. It is a contract. If you need flexibility, build a consumer that adapts to the contract, not the other way around.

### "OperatorOS Platform should run as a service."

**Wrong.** There is no daemon. There is no long-lived process. The CLI runs when you invoke it and exits. The smoke test runs when you invoke it and tears down.

### "OperatorOS Platform v1.1 is already underway."

**Wrong.** The v1.1 backlog is published and scoped, but no v1.1 work has been started. v1.1 development is gated by consumer demand and the successor-ADR process. v1.0 is in Long-Term Maintenance, not in active development.

### "I can add a 5th interface operation."

**Wrong (in v1.0).** The public surface is exactly 4 operations: `interface.run`, `interface.explain`, `interface.inspect`, `interface.cancel`. Adding a 5th requires a successor-ADR cycle and a new architecture SHA. That is v1.1+ work, not v1.0 work.

### "OperatorOS Platform is the next v0.8.x."

**Wrong.** OperatorOS v0.8.x is a frozen compatibility line. OperatorOS Platform is a separate, bounded, frozen-contract successor product. They are different release lines. Migration from v0.8.x to Platform is one-way via the `v08-importer` package.

### "OperatorOS Platform will eventually replace Workspace OS."

**Wrong.** They serve different purposes. Workspace OS is your operational substrate. OperatorOS Platform is a reference contract for future product builders. They will coexist indefinitely.

---

## 15. One-page cheat sheet

### What OperatorOS Platform IS

- A frozen-contract TypeScript monorepo (13 packages + 2 apps + 2 spikes).
- A reference architecture for durable Mission execution.
- A 4-operation public surface (`interface.run`, `interface.explain`, `interface.inspect`, `interface.cancel`).
- A standing offer to future product builders (AI Factory, Knowledge OS, etc.).
- Released as v1.0.0 LTS, with architecture SHA `1e79049d…` permanently locked.
- Available at github.com/taras-polishchuk/operatoros-platform.

### What OperatorOS Platform is NOT

- A daily-use tool. (That's `workspace-os`.)
- An installed CLI on your PATH. (It's at `apps/cli/dist/index.js` in the repo.)
- An npm-published package. (All 13 packages are `private: true`.)
- A long-running service or daemon. (The CLI runs and exits.)
- A flexible framework you extend. (Architecture is frozen.)
- A v1.1+ work-in-progress. (v1.1 backlog is published but not started.)
- The same as Workspace OS. (Different language, install model, lifecycle.)

### When to USE OperatorOS Platform

- Studying the contract for a future integration.
- Verifying the platform contract is intact (`pnpm test apps/smoke`).
- Documenting the platform for a public audience.
- Writing a v1.1 backlog candidate.
- Demonstrating the smoke test as a CI check for a consumer.
- Onboarding a new collaborator to the contract.

### When NOT to use OperatorOS Platform

- Doing your daily work in `workspace-os`.
- Working on a product that doesn't integrate with the Platform. (Today: every product.)
- Tempted to "fix" something in the architecture. (Architecture is frozen.)
- Adding a new feature. (v1.0 is closed; new features go to v1.1+ backlog.)
- Modernizing or refactoring the code. (Already on TypeScript strict, zero `any`.)
- Understanding Workspace OS. (Workspace OS is in `workspace-os/`.)

### Where it fits in my Workspace

```
/home/taras/projects/
├── workspace-os/         ← daily tool, installed Python CLI  ← YOU LIVE HERE
├── operatoros-platform/  ← frozen contract, monorepo         ← YOU RARELY GO HERE
├── .project-state/       ← mission state, by workspace-os
├── knowledge-os/         ← parallel knowledge substrate
├── factory/              ← consumer product (future Platform user)
├── career/               ← consumer product
├── product-team/         ← consumer product
└── homelab-staging/      ← infrastructure
```

### What my daily workflow looks like

1. **Morning.** Open terminal. Maybe `workspace-os mission list`.
2. **Pick a product.** `cd product-team/` (or `career/`, `factory/`, etc.).
3. **Work in the product.** Code, test, commit.
4. **Use `workspace-os` for missions.** `workspace-os mission new <slug>`.
5. **Ship the product.** Commit, push, deploy.
6. **OperatorOS Platform.** Not in the daily path. Open only when verifying the contract, studying for an integration, or writing a v1.1 candidate.

### What my rare OperatorOS Platform interactions look like

- **Once.** Clone, install, run `pnpm quality`, run `pnpm demo`, read canonical context. Done.
- **Quarterly.** Run `pnpm test apps/smoke` to confirm contract is intact. ~2 seconds.
- **When planning a v1.1 candidate.** Open `v1.1-backlog.md`, study the architecture, write a candidate.
- **When a real defect is found.** File an issue with reproduction. Do not edit the architecture.

### The decision rule

- **Daily work** → `workspace-os` (and your product directory).
- **Verifying the platform** → `operatoros-platform` (rare).
- **Building a new consumer** → add OperatorOS Platform as workspace dep, use the 4 operations.
- **Founding a Platform limitation** → file a v1.1 backlog candidate, wait for successor-ADR.

### The two documents to read first

1. **`OPERATOROS-PLATFORM-v1.0.0-CANONICAL-CONTEXT.md`** — the long-term reference.
2. **`AI-CONTEXT-OPERATOROS.md`** — the compact AI-ready version.

Both live in `/home/taras/projects/operatoros-platform/`. Read them once. Done.

---

**Bottom line: OperatorOS Platform is a frozen-contract monorepo you rarely open. Your daily tool is `workspace-os`. Your work happens in product directories. OperatorOS Platform is the standing offer for future products. Read the canonical context once, run the smoke test occasionally, and otherwise leave it alone.**
