# @operatoros-platform/cli

Executable CLI for the OperatorOS Platform. Wraps the in-process `@operatoros-platform/interface-host` dispatcher in a real command-line interface with conventional flags, exit codes, and JSON output.

## Install

Within the monorepo:

```sh
pnpm install
pnpm --filter @operatoros-platform/cli build
```

The compiled binary lives at `apps/cli/dist/index.js`. Expose it as `operatoros` by symlinking, or run it directly:

```sh
node apps/cli/dist/index.js --help
```

## Usage

```text
operatoros [--json] [--workspace <path>] [--identity <ref>] [--correlation <id>] <command> [args]
```

| Command           | Description                                                                      |
| ----------------- | -------------------------------------------------------------------------------- |
| `init`            | Initialize a SQLite workspace at `--workspace` (default: temp dir).              |
| `explain`         | Surface the supported interface operations (routes through interface-host).      |
| `version`         | Print the CLI version.                                                           |
| `help`            | Print the help message.                                                          |
| `mission run`     | Start a run. Requires `--workspace-ref`, `--mission-ref`, `--specification-ref`. |
| `mission inspect` | Inspect a workspace record. Requires `--workspace-ref`.                          |
| `mission cancel`  | Cancel a run. Requires `--entity-id`.                                            |

## Exit codes

- `0` — success
- `1` — runtime or validation failure (missing args, dispatcher rejected)
- `2` — usage error (unknown command)

## Example

```sh
$ node apps/cli/dist/index.js --workspace /tmp/ws init
{"workspace_root":"/tmp/ws","schema_version":"1.0.0","stores":["evidence","workspace","governance","execution"]}

$ node apps/cli/dist/index.js --workspace /tmp/ws mission run \
    --workspace-ref workspace_local:test \
    --mission-ref mission_local:m1 \
    --specification-ref spec_local:s1 \
    --identity identity://test \
    --correlation corr-1
{"run_ref":"run_corr-1","mission_record_ref":"mission_record_…","record_version":1}
```

## API

The CLI is importable as a library:

```ts
import { run, parseCommand, buildHelpDoc, formatHelp } from '@operatoros-platform/cli';
const result = await run(['node', 'operatoros', 'explain', '--json']);
```

## Architecture

The CLI is a thin wrapper around the in-process interface-host dispatcher. It does not couple to internal store types — see `packages/interface-host/src/index.ts` for the `LocalExecutionService` and `LocalWorkspaceService` structural shapes.

## Tests

```sh
pnpm --filter @operatoros-platform/cli test
```

14 CLI tests cover exit codes, parsing, help output, init, and explain end-to-end.
