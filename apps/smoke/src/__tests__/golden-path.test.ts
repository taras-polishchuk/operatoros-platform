import { describe, expect, it } from 'vitest';

import { SMOKE_PACKAGE_NAMES, assertGoldenPathPasses, runGoldenPath } from '../index.js';

describe('Golden-path smoke (RC1 integration evidence)', () => {
  it('lists all 12 production packages on the smoke surface', () => {
    expect(SMOKE_PACKAGE_NAMES).toContain('@operatoros-platform/contracts');
    expect(SMOKE_PACKAGE_NAMES).toContain('@operatoros-platform/evidence-service');
    expect(SMOKE_PACKAGE_NAMES).toContain('@operatoros-platform/workspace-service');
    expect(SMOKE_PACKAGE_NAMES).toContain('@operatoros-platform/governance-service');
    expect(SMOKE_PACKAGE_NAMES).toContain('@operatoros-platform/execution-service');
    expect(SMOKE_PACKAGE_NAMES).toContain('@operatoros-platform/recovery-service');
    expect(SMOKE_PACKAGE_NAMES).toContain('@operatoros-platform/secrets-service');
    expect(SMOKE_PACKAGE_NAMES).toContain('@operatoros-platform/interface-host');
    expect(SMOKE_PACKAGE_NAMES).toContain('@operatoros-platform/agent-execution');
    expect(SMOKE_PACKAGE_NAMES).toContain('@operatoros-platform/extension-runtime');
    expect(SMOKE_PACKAGE_NAMES).toContain('@operatoros-platform/hosted-runtime');
    expect(SMOKE_PACKAGE_NAMES).toContain('@operatoros-platform/distributed-coordination');
  });

  it('runs a one-shot golden path through every package surface', async () => {
    const report = await assertGoldenPathPasses();
    expect(report.contract_version).toBe('1.0.0');
    expect(report.operations_executed.length).toBeGreaterThanOrEqual(15);
    for (const op of report.operations_executed) {
      expect(report.conclusions[op]).toBe(true);
    }
  });

  it('runGoldenPath is idempotent and produces a stable operation count', async () => {
    const first = await runGoldenPath();
    const second = await runGoldenPath();
    expect(first.operations_executed.length).toBeGreaterThanOrEqual(15);
    expect(second.operations_executed.length).toBe(first.operations_executed.length);
  });
});
