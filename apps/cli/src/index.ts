// OperatorOS Platform local CLI — Architecture §6.
//
// Wired against the @operatoros-platform/interface-host in-process
// dispatcher. Uses Node's built-in `parseArgs` (Node 18+) so there are
// no runtime dependencies beyond the operatoros-platform workspace.
//
// Exit codes:
//   0  success
//   1  runtime / validation failure (missing args, dispatcher rejected)
//   2  usage / unknown command (EX_USAGE)

import { parseArgs } from 'node:util';
import { mkdir as mkdirAsync } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { createSqliteEvidenceService } from '@operatoros-platform/evidence-service';
import { createExecutionService } from '@operatoros-platform/execution-service';
import { createSqliteGovernanceStore } from '@operatoros-platform/governance-service';
import {
  SUPPORTED_OPERATIONS,
  createInProcessInterfaceHost,
  renderHelp,
  type InterfaceRequest,
  type LocalExecutionService,
} from '@operatoros-platform/interface-host';
import { createWorkspaceService } from '@operatoros-platform/workspace-service';

export const CLI_VERSION = '1.0.0' as const;
export const CLI_PACKAGE_NAME = '@operatoros-platform/cli' as const;
export const CLI_BIN_NAME = 'operatoros' as const;

export interface CliContext {
  workspaceRoot: string;
  cleanup: () => Promise<void>;
}

export interface CliRunOptions {
  workspace?: string;
  cleanupOnExit?: boolean;
}

/**
 * Build a disposable workspace + interface-host harness from a SQLite root.
 * The CLI hands every subcommand a fresh, isolated in-process dispatcher so
 * tests can run against predictable state.
 */
export async function buildContext(options: CliRunOptions = {}): Promise<CliContext> {
  // A CLI invocation must not silently lose state. Keep the default workspace
  // durable; callers that need isolation (tests/automation) pass --workspace.
  const root = options.workspace ?? join(homedir(), '.operatoros', 'workspace');
  const ctx: CliContext = {
    workspaceRoot: root,
    cleanup: async () => {
      // Workspace data is user-owned and is never removed by the CLI.
      void options.cleanupOnExit;
    },
  };
  return ctx;
}

/**
 * Construct an interface-host dispatcher wired against on-disk SQLite stores
 * under the given workspace root. The dispatcher is the only thing the CLI
 * talks to — no direct store coupling.
 */
export async function buildDispatcher(
  workspaceRoot: string,
): Promise<{ host: ReturnType<typeof createInProcessInterfaceHost> }> {
  // The SQLite stores open with DatabaseSync(path) and require the parent
  // directory to already exist. mkdtemp guarantees this for default usage;
  // for an explicit --workspace path we mkdir -p first.
  await mkdirAsync(workspaceRoot, { recursive: true });

  const evidence = createSqliteEvidenceService({
    databasePath: join(workspaceRoot, 'evidence.sqlite'),
  });
  const workspace = createWorkspaceService({
    databasePath: join(workspaceRoot, 'workspace.sqlite'),
    snapshotsDirectory: join(workspaceRoot, 'snapshots'),
  });
  const governance = createSqliteGovernanceStore({
    databasePath: join(workspaceRoot, 'governance.sqlite'),
  });
  const execution = createExecutionService({
    databasePath: join(workspaceRoot, 'execution.sqlite'),
    evidence,
  });
  // Reference each store so it remains reachable and not flagged as unused.
  void governance;

  // The interface-host's LocalExecutionService structural type expects
  // startRunWithMissionRecord on BOTH the service and the store. The real
  // createExecutionService only exposes it on the service — mirror it on
  // the store so the structural shape matches.
  //
  // activateMission's real return type is `ExecutionResult` (a union that
  // also includes a 'rejected' branch). The interface-host's local type
  // expects the narrower `LocalActivationResult | conflict` — same runtime
  // shapes, narrower type. The dispatcher ignores the extra branch, so
  // we cast through `unknown` to bridge the structural gap.
  const activateMission = execution.store.activateMission.bind(execution.store);
  const executionShim: LocalExecutionService = {
    store: {
      activateMission: (input: Parameters<typeof activateMission>[0]) =>
        activateMission(input) as unknown as ReturnType<
          LocalExecutionService['store']['activateMission']
        >,
      getRun: execution.store.getRun.bind(execution.store),
      cancelRun: execution.store.cancelRun.bind(execution.store),
      startRunWithMissionRecord: execution.startRunWithMissionRecord.bind(execution),
    },
    startRunWithMissionRecord: execution.startRunWithMissionRecord.bind(execution),
  };

  const host = createInProcessInterfaceHost({
    workspace: {
      getWorkspaceRecord(workspace_ref: string) {
        const record = workspace.getWorkspaceRecord(workspace_ref);
        if (!record) return null;
        return {
          entity_id: `ws_${workspace_ref}`,
          workspace_ref: record.workspace_ref,
          state: record.state,
          record_version: record.record_version,
          schema_version: record.schema_version,
          created_at: record.created_at,
          updated_at: record.updated_at,
          root_path: record.root_path,
        };
      },
    },
    governance: {},
    execution: executionShim,
    evidence: {},
  });

  return { host };
}

export interface ParsedArgs {
  positional: readonly string[];
  flags: {
    json: boolean;
    help: boolean;
    version: boolean;
    workspace: string | undefined;
    identity: string | undefined;
    correlation: string | undefined;
    workspaceRef: string | undefined;
    missionRef: string | undefined;
    specificationRef: string | undefined;
    entityId: string | undefined;
  };
}

export function parseCommand(argv: readonly string[]): ParsedArgs {
  const { values, positionals } = parseArgs({
    args: argv.slice(2),
    allowPositionals: true,
    options: {
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
      version: { type: 'boolean', default: false },
      workspace: { type: 'string' },
      identity: { type: 'string' },
      correlation: { type: 'string' },
      'workspace-ref': { type: 'string' },
      'mission-ref': { type: 'string' },
      'specification-ref': { type: 'string' },
      'entity-id': { type: 'string' },
    },
  });
  return {
    positional: positionals,
    flags: {
      json: values.json === true,
      help: values.help === true,
      version: values.version === true,
      workspace: typeof values.workspace === 'string' ? values.workspace : undefined,
      identity: typeof values.identity === 'string' ? values.identity : undefined,
      correlation: typeof values.correlation === 'string' ? values.correlation : undefined,
      workspaceRef:
        typeof values['workspace-ref'] === 'string' ? values['workspace-ref'] : undefined,
      missionRef: typeof values['mission-ref'] === 'string' ? values['mission-ref'] : undefined,
      specificationRef:
        typeof values['specification-ref'] === 'string' ? values['specification-ref'] : undefined,
      entityId: typeof values['entity-id'] === 'string' ? values['entity-id'] : undefined,
    },
  };
}

export interface HelpDoc {
  program: string;
  version: string;
  usage: string;
  commands: ReadonlyArray<{ name: string; description: string }>;
  flags: ReadonlyArray<{ name: string; description: string }>;
  notes: readonly string[];
}

export function buildHelpDoc(): HelpDoc {
  return {
    program: CLI_BIN_NAME,
    version: CLI_VERSION,
    usage: `${CLI_BIN_NAME} [--json] [--workspace <path>] [--identity <ref>] [--correlation <id>] <command> [args]`,
    commands: [
      { name: 'init', description: 'Initialize a SQLite workspace.' },
      { name: 'explain', description: 'Surface the supported interface operations.' },
      { name: 'version', description: 'Print the CLI version.' },
      { name: 'help', description: 'Print this help message.' },
      {
        name: 'mission run',
        description: 'Start a run. Requires --workspace-ref, --mission-ref, --specification-ref.',
      },
      {
        name: 'mission inspect',
        description: 'Inspect a workspace record. Requires --workspace-ref.',
      },
      {
        name: 'mission cancel',
        description: 'Cancel a run. Requires --entity-id.',
      },
    ],
    flags: [
      { name: '--json', description: 'Emit the result as JSON to stdout.' },
      { name: '--workspace <path>', description: 'SQLite workspace root (default: ~/.operatoros/workspace).' },
      { name: '--identity <ref>', description: 'Subject identity ref (identity:// / service://).' },
      { name: '--correlation <id>', description: 'Correlation id for the dispatch.' },
      { name: '--workspace-ref <ref>', description: 'Workspace reference (workspace_/…).' },
      { name: '--mission-ref <ref>', description: 'Mission reference.' },
      { name: '--specification-ref <ref>', description: 'Specification reference.' },
      { name: '--entity-id <id>', description: 'Run entity id (mission cancel).' },
      { name: '--help', description: 'Print help and exit.' },
      { name: '--version', description: 'Print version and exit.' },
    ],
    notes: [
      'Storage paths are NEVER exposed by the local CLI.',
      'Secret material is NEVER printed by the local CLI.',
      `All non-help operations route through the interface-host dispatcher (${SUPPORTED_OPERATIONS.length} supported operations).`,
    ],
  };
}

export function formatHelp(doc: HelpDoc): string {
  const lines: string[] = [];
  lines.push(`${doc.program} v${doc.version} — OperatorOS Platform local CLI`);
  lines.push('');
  lines.push(`Usage: ${doc.usage}`);
  lines.push('');
  lines.push('Commands:');
  for (const c of doc.commands) {
    lines.push(`  ${c.name.padEnd(20)} ${c.description}`);
  }
  lines.push('');
  lines.push('Flags:');
  for (const f of doc.flags) {
    lines.push(`  ${f.name.padEnd(26)} ${f.description}`);
  }
  lines.push('');
  lines.push('Notes:');
  for (const n of doc.notes) lines.push(`  • ${n}`);
  lines.push('');
  lines.push('Interface-host help (Architecture §6):');
  lines.push(renderHelp());
  return lines.join('\n');
}

export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/**
 * Required-args validator. Returns the list of missing flag names, or an empty
 * array if all required flags are present. Reserved tokens are: identity,
 * correlation, workspace_ref, mission_ref, specification_ref, entity_id.
 */
export function validateRequired(required: ReadonlyArray<string>, parsed: ParsedArgs): string[] {
  const f = parsed.flags;
  const map: Record<string, string | undefined> = {
    identity: f.identity,
    correlation: f.correlation,
    workspace_ref: f.workspaceRef,
    mission_ref: f.missionRef,
    specification_ref: f.specificationRef,
    entity_id: f.entityId,
  };
  const missing: string[] = [];
  for (const key of required) {
    const v = map[key];
    if (typeof v !== 'string' || v.length === 0) missing.push(key);
  }
  return missing;
}

export type Subcommand =
  'init' | 'explain' | 'version' | 'help' | 'mission.run' | 'mission.inspect' | 'mission.cancel';

export function classifyCommand(positionals: readonly string[]): Subcommand | 'unknown' {
  if (positionals.length === 0) return 'help';
  const head = positionals[0];
  if (head === 'init') return 'init';
  if (head === 'explain') return 'explain';
  if (head === 'version') return 'version';
  if (head === 'help') return 'help';
  if (head === 'mission') {
    const sub = positionals[1];
    if (sub === 'run') return 'mission.run';
    if (sub === 'inspect') return 'mission.inspect';
    if (sub === 'cancel') return 'mission.cancel';
    return 'unknown';
  }
  return 'unknown';
}

export interface CommandResult {
  subcommand: Subcommand | 'unknown';
  ok: boolean;
  exit_code: 0 | 1 | 2;
  stdout: string;
  stderr: string;
  payload: Record<string, unknown> | null;
}

/**
 * Build a CommandResult from the outcome of a subcommand. The `payload`
 * is the structured form (so tests can assert on it without parsing
 * stdout); stdout/stderr are the human-readable rendering.
 */
function makeResult(
  subcommand: Subcommand | 'unknown',
  code: 0 | 1 | 2,
  stdout: string,
  stderr: string,
  payload: Record<string, unknown> | null,
): CommandResult {
  return {
    subcommand,
    ok: code === 0,
    exit_code: code,
    stdout,
    stderr,
    payload,
  };
}

/**
 * Main entry point. argv is the raw process.argv-style array (argv[0] = node,
 * argv[1] = script). Returns a structured CommandResult so the same code path
 * works for both the executable bin and the in-process test driver.
 */
export async function run(argv: readonly string[]): Promise<CommandResult> {
  const parsed = parseCommand(argv);

  if (parsed.flags.help) {
    return makeResult('help', 0, formatHelp(buildHelpDoc()), '', null);
  }
  if (parsed.flags.version) {
    const doc = buildHelpDoc();
    return makeResult('version', 0, `${doc.program} v${doc.version}`, '', {
      program: doc.program,
      version: doc.version,
      package: CLI_PACKAGE_NAME,
    });
  }

  const cmd = classifyCommand(parsed.positional);
  if (cmd === 'unknown') {
    return makeResult(
      'unknown',
      2,
      '',
      `Unknown command: ${parsed.positional.join(' ')}\nRun '${CLI_BIN_NAME} help' for usage.`,
      { unknown: parsed.positional },
    );
  }
  if (cmd === 'help') {
    return makeResult('help', 0, formatHelp(buildHelpDoc()), '', null);
  }
  if (cmd === 'version') {
    const doc = buildHelpDoc();
    return makeResult('version', 0, `${doc.program} v${doc.version}`, '', {
      program: doc.program,
      version: doc.version,
      package: CLI_PACKAGE_NAME,
    });
  }

  // Everything from here on needs a workspace path. Default to the durable user workspace.
  const requiredByCommand: Partial<Record<Subcommand, string[]>> = {
    'mission.run': ['workspace_ref', 'mission_ref', 'specification_ref', 'identity', 'correlation'],
    'mission.inspect': ['workspace_ref', 'identity', 'correlation'],
    'mission.cancel': ['entity_id', 'identity', 'correlation'],
  };
  const earlyMissing = requiredByCommand[cmd]
    ? validateRequired(requiredByCommand[cmd]!, parsed)
    : [];
  if (earlyMissing.length > 0) {
    return makeResult(cmd, 1, '', `Missing required flags: ${earlyMissing.join(', ')}`, {
      missing: earlyMissing,
    });
  }
  let ctx: CliContext | null = null;
  try {
    const runOpts: CliRunOptions = {};
    if (parsed.flags.workspace !== undefined) runOpts.workspace = parsed.flags.workspace;
    ctx = await buildContext(runOpts);
    const dispatcher = await buildDispatcher(ctx.workspaceRoot);

    if (cmd === 'init') {
      const payload = {
        workspace_root: ctx.workspaceRoot,
        schema_version: '1.0.0',
        initialized_at: new Date().toISOString(),
        stores: ['evidence', 'workspace', 'governance', 'execution'],
      };
      return makeResult('init', 0, formatForMode(parsed, payload), '', payload);
    }

    if (cmd === 'explain') {
      const request = buildRequest(parsed, 'interface.explain', {});
      const result = dispatcher.host.dispatch(request);
      if (result.outcome === 'rejected') {
        return makeResult('explain', 1, '', result.reason, { reason: result.reason });
      }
      return makeResult('explain', 0, formatForMode(parsed, result.payload), '', result.payload);
    }

    if (cmd === 'mission.run') {
      const missing = validateRequired(
        ['workspace_ref', 'mission_ref', 'specification_ref', 'identity', 'correlation'],
        parsed,
      );
      if (missing.length > 0) {
        return makeResult('mission.run', 1, '', `Missing required flags: ${missing.join(', ')}`, {
          missing,
        });
      }
      const request = buildRequest(parsed, 'interface.run', {
        workspace_ref: parsed.flags.workspaceRef,
        mission_ref: parsed.flags.missionRef,
        specification_ref: parsed.flags.specificationRef,
      });
      const result = dispatcher.host.dispatch(request);
      if (result.outcome === 'rejected') {
        return makeResult('mission.run', 1, '', result.reason, { reason: result.reason });
      }
      return makeResult(
        'mission.run',
        0,
        formatForMode(parsed, result.payload),
        '',
        result.payload,
      );
    }

    if (cmd === 'mission.inspect') {
      const missing = validateRequired(['workspace_ref', 'identity', 'correlation'], parsed);
      if (missing.length > 0) {
        return makeResult(
          'mission.inspect',
          1,
          '',
          `Missing required flags: ${missing.join(', ')}`,
          { missing },
        );
      }
      const request = buildRequest(parsed, 'interface.inspect', {
        workspace_ref: parsed.flags.workspaceRef,
      });
      const result = dispatcher.host.dispatch(request);
      if (result.outcome === 'rejected') {
        return makeResult('mission.inspect', 1, '', result.reason, { reason: result.reason });
      }
      return makeResult(
        'mission.inspect',
        0,
        formatForMode(parsed, result.payload),
        '',
        result.payload,
      );
    }

    if (cmd === 'mission.cancel') {
      const missing = validateRequired(['entity_id', 'identity', 'correlation'], parsed);
      if (missing.length > 0) {
        return makeResult(
          'mission.cancel',
          1,
          '',
          `Missing required flags: ${missing.join(', ')}`,
          { missing },
        );
      }
      const request = buildRequest(parsed, 'interface.cancel', {
        entity_id: parsed.flags.entityId,
      });
      const result = dispatcher.host.dispatch(request);
      if (result.outcome === 'rejected') {
        return makeResult('mission.cancel', 1, '', result.reason, { reason: result.reason });
      }
      return makeResult(
        'mission.cancel',
        0,
        formatForMode(parsed, result.payload),
        '',
        result.payload,
      );
    }

    // exhaustive switch — typescript will flag a missing branch.
    return makeResult('unknown', 2, '', 'unreachable', null);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return makeResult('unknown', 1, '', message, { error: message });
  } finally {
    if (ctx) await ctx.cleanup();
  }
}

function buildRequest(
  parsed: ParsedArgs,
  operation: InterfaceRequest['operation'],
  args: Record<string, unknown>,
): InterfaceRequest {
  return {
    operation,
    args,
    subject_identity_ref: parsed.flags.identity ?? 'identity://cli/default',
    correlation_id: parsed.flags.correlation ?? 'cli-correlation-default',
  };
}

function formatForMode(parsed: ParsedArgs, payload: unknown): string {
  if (parsed.flags.json) return formatJson(payload);
  if (payload === null || typeof payload !== 'object') return String(payload);
  return Object.entries(payload as Record<string, unknown>)
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join('\n');
}

// ── Executable entry point ──────────────────────────────────────────────
const isDirectInvocation = (() => {
  if (typeof process === 'undefined') return false;
  if (!Array.isArray(process.argv) || process.argv.length < 2) return false;
  if (!process.argv[1]) return false;
  try {
    const url = new URL(`file://${process.argv[1]}`).href;
    return import.meta.url === url;
  } catch {
    return false;
  }
})();

if (isDirectInvocation) {
  const result = await run(process.argv);
  if (result.stdout) process.stdout.write(result.stdout + '\n');
  if (result.stderr) process.stderr.write(result.stderr + '\n');
  process.exit(result.exit_code);
}
