// CLI-level tests for @operatoros-platform/cli. The CLI is intentionally
// importable as a library (run() returns a structured CommandResult) so the
// test driver can assert exit codes + payloads without spawning a subprocess.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  CLI_BIN_NAME,
  CLI_VERSION,
  buildHelpDoc,
  classifyCommand,
  formatHelp,
  formatJson,
  parseCommand,
  run,
  validateRequired,
} from '../index.js';

describe('@operatoros-platform/cli — exit codes (UX-CLI-02)', () => {
  it('--help exits 0 with the help text on stdout', async () => {
    const result = await run(['node', CLI_BIN_NAME, '--help']);
    expect(result.exit_code).toBe(0);
    expect(result.ok).toBe(true);
    expect(result.subcommand).toBe('help');
    expect(result.stdout).toContain('OperatorOS Platform local CLI');
    expect(result.stdout).toContain('Usage:');
    expect(result.stdout).toContain('init');
    expect(result.stdout).toContain('mission run');
  });

  it('--version exits 0 with the version string on stdout', async () => {
    const result = await run(['node', CLI_BIN_NAME, '--version']);
    expect(result.exit_code).toBe(0);
    expect(result.ok).toBe(true);
    expect(result.subcommand).toBe('version');
    expect(result.stdout).toContain(CLI_BIN_NAME);
    expect(result.stdout).toContain(CLI_VERSION);
  });

  it('unknown command exits 2 (EX_USAGE)', async () => {
    const result = await run(['node', CLI_BIN_NAME, 'bogus-cmd']);
    expect(result.exit_code).toBe(2);
    expect(result.ok).toBe(false);
    expect(result.subcommand).toBe('unknown');
    expect(result.stderr).toContain('Unknown command');
    expect(result.stderr).toContain('bogus-cmd');
  });

  it('mission run with missing required args exits 1', async () => {
    const result = await run(['node', CLI_BIN_NAME, 'mission', 'run']);
    expect(result.exit_code).toBe(1);
    expect(result.ok).toBe(false);
    expect(result.subcommand).toBe('mission.run');
    expect(result.stderr).toContain('Missing required flags');
    expect(result.stderr).toContain('workspace_ref');
    expect(result.stderr).toContain('mission_ref');
    expect(result.stderr).toContain('specification_ref');
  });

  it('mission inspect with missing --workspace-ref exits 1', async () => {
    const result = await run([
      'node',
      CLI_BIN_NAME,
      'mission',
      'inspect',
      '--identity',
      'identity://test',
      '--correlation',
      'corr-test',
    ]);
    expect(result.exit_code).toBe(1);
    expect(result.subcommand).toBe('mission.inspect');
    expect(result.stderr).toContain('workspace_ref');
  });

  it('mission cancel with missing --entity-id exits 1', async () => {
    const result = await run([
      'node',
      CLI_BIN_NAME,
      'mission',
      'cancel',
      '--identity',
      'identity://test',
      '--correlation',
      'corr-test',
    ]);
    expect(result.exit_code).toBe(1);
    expect(result.subcommand).toBe('mission.cancel');
    expect(result.stderr).toContain('entity_id');
  });
});

describe('@operatoros-platform/cli — init workflow (UX-EX-02)', () => {
  let tempWorkspace: string;

  beforeEach(async () => {
    tempWorkspace = await mkdtemp(join(tmpdir(), 'operatoros-cli-test-'));
  });

  afterEach(async () => {
    if (tempWorkspace && existsSync(tempWorkspace)) {
      await rm(tempWorkspace, { recursive: true, force: true });
    }
  });

  it('init --workspace <path> succeeds and creates a SQLite workspace', async () => {
    const wsPath = join(tempWorkspace, 'ws');
    const result = await run(['node', CLI_BIN_NAME, 'init', '--workspace', wsPath]);
    expect(result.exit_code).toBe(0);
    expect(result.ok).toBe(true);
    expect(result.subcommand).toBe('init');
    // The init payload should expose the workspace root.
    const payloadText = result.stdout;
    expect(payloadText).toContain(wsPath);
    // The SQLite databases should exist on disk (Architecture §6).
    expect(existsSync(join(wsPath, 'workspace.sqlite'))).toBe(true);
    expect(existsSync(join(wsPath, 'evidence.sqlite'))).toBe(true);
    expect(existsSync(join(wsPath, 'governance.sqlite'))).toBe(true);
    expect(existsSync(join(wsPath, 'execution.sqlite'))).toBe(true);
  });

  it('init --json emits JSON output', async () => {
    const wsPath = join(tempWorkspace, 'ws-json');
    const result = await run(['node', CLI_BIN_NAME, 'init', '--workspace', wsPath, '--json']);
    expect(result.exit_code).toBe(0);
    const parsed = JSON.parse(result.stdout) as { workspace_root: string; stores: string[] };
    expect(parsed.workspace_root).toBe(wsPath);
    expect(parsed.stores).toContain('evidence');
    expect(parsed.stores).toContain('workspace');
    expect(parsed.stores).toContain('execution');
  });

  it('explain routes through the in-process interface-host dispatcher', async () => {
    const wsPath = join(tempWorkspace, 'ws-explain');
    const result = await run([
      'node',
      CLI_BIN_NAME,
      '--workspace',
      wsPath,
      'explain',
      '--identity',
      'identity://cli',
      '--correlation',
      'corr-explain',
      '--json',
    ]);
    expect(result.exit_code).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      contract_version: string;
      supported_operations: string[];
      routing: string;
    };
    expect(payload.contract_version).toBe('1.0.0');
    expect(payload.routing).toBe('in-process');
    expect(payload.supported_operations).toContain('interface.run');
    expect(payload.supported_operations).toContain('interface.explain');
    expect(payload.supported_operations).toContain('interface.inspect');
    expect(payload.supported_operations).toContain('interface.cancel');
  });
});

describe('@operatoros-platform/cli — parser helpers', () => {
  it('classifyCommand maps positional tokens to subcommands', () => {
    expect(classifyCommand([])).toBe('help');
    expect(classifyCommand(['init'])).toBe('init');
    expect(classifyCommand(['version'])).toBe('version');
    expect(classifyCommand(['explain'])).toBe('explain');
    expect(classifyCommand(['help'])).toBe('help');
    expect(classifyCommand(['mission', 'new'])).toBe('unknown');
    expect(classifyCommand(['mission', 'run'])).toBe('mission.run');
    expect(classifyCommand(['mission', 'inspect'])).toBe('mission.inspect');
    expect(classifyCommand(['mission', 'cancel'])).toBe('mission.cancel');
    expect(classifyCommand(['mission', 'nope'])).toBe('unknown');
    expect(classifyCommand(['garbage'])).toBe('unknown');
  });

  it('parseCommand extracts --json, --workspace, --identity, --correlation, and dash-case flags', () => {
    const parsed = parseCommand([
      'node',
      'operatoros',
      '--json',
      '--workspace',
      '/tmp/x',
      '--identity',
      'identity://x',
      '--correlation',
      'corr-1',
      '--workspace-ref',
      'workspace_local:abc',
      '--mission-ref',
      'mission_local:xyz',
      '--specification-ref',
      'spec_local:qrs',
      'mission',
      'run',
    ]);
    expect(parsed.flags.json).toBe(true);
    expect(parsed.flags.workspace).toBe('/tmp/x');
    expect(parsed.flags.identity).toBe('identity://x');
    expect(parsed.flags.correlation).toBe('corr-1');
    expect(parsed.flags.workspaceRef).toBe('workspace_local:abc');
    expect(parsed.flags.missionRef).toBe('mission_local:xyz');
    expect(parsed.flags.specificationRef).toBe('spec_local:qrs');
    expect(parsed.positional).toEqual(['mission', 'run']);
  });

  it('validateRequired returns the list of missing flag names', () => {
    const empty = parseCommand(['node', 'operatoros']);
    expect(validateRequired(['workspace_ref', 'mission_ref'], empty)).toEqual([
      'workspace_ref',
      'mission_ref',
    ]);
    const partial = parseCommand(['node', 'operatoros', '--workspace-ref', 'workspace_local:abc']);
    expect(validateRequired(['workspace_ref', 'mission_ref'], partial)).toEqual(['mission_ref']);
  });

  it('formatHelp renders the program name, version, and the documented subcommands', () => {
    const help = formatHelp(buildHelpDoc());
    expect(help).toContain(CLI_BIN_NAME);
    expect(help).toContain(CLI_VERSION);
    expect(help).not.toContain('Stub operation');
    expect(help).not.toContain('mission new');
    expect(help).toContain('mission run');
    expect(help).toContain('mission inspect');
    expect(help).toContain('mission cancel');
    expect(help).toContain('Storage paths are NEVER exposed');
  });

  it('formatJson produces valid JSON with 2-space indent', () => {
    const out = formatJson({ a: 1, b: ['x', 'y'] });
    expect(out).toBe('{\n  "a": 1,\n  "b": [\n    "x",\n    "y"\n  ]\n}');
  });
});
