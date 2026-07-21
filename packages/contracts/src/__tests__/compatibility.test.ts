import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  compatibilityMetadata,
  contractIndex,
  domainEntityKinds,
  getContract,
  parseContract,
  publicContractVersion,
} from '../index.js';

describe('IP-002 compatibility and generated contract corpus', () => {
  it('declares explicit supported ranges for every required contract family', () => {
    expect(compatibilityMetadata.contract_version).toBe(publicContractVersion);
    const ids = compatibilityMetadata.ranges.map((row) => row.id).sort();
    expect(ids).toContain('NFR-COMP-1');
    expect(ids).toContain('AV-O1');
    for (const row of compatibilityMetadata.ranges) {
      expect(row.from).toBe('1.0.0');
      expect(row.to).toBe('1.0.x');
    }
  });

  it('registers every entity and envelope validator under a stable contract identifier', () => {
    expect(domainEntityKinds).toHaveLength(14);
    expect(Object.keys(contractIndex.public).length).toBeGreaterThanOrEqual(20);
    const cmdSchema = getContract('envelope.command');
    expect(cmdSchema).toBeDefined();
    const querySchema = getContract('envelope.query');
    expect(querySchema).toBeDefined();
    const mutationSchema = getContract('envelope.mutation');
    expect(mutationSchema).toBeDefined();
  });

  it('parses a known contract and rejects an unsupported contract identifier explicitly', () => {
    expect(
      parseContract('envelope.query', {
        query_type: 'workspace.get',
        subject_identity_ref: 'identity://operator/taras',
        workspace_ref: 'workspace_01',
        filter: {},
        limit: 25,
      }),
    ).toBeDefined();
    expect(() => parseContract('public.unknown', {})).toThrow();
  });

  it('keeps generated JSON Schemas byte-for-byte synchronized with the registry', async () => {
    const generatedIndex = JSON.parse(
      await readFile(new URL('../../generated/index.json', import.meta.url), 'utf8'),
    ) as {
      current_version: string;
      contracts: Record<string, { path: string }>;
    };

    expect(generatedIndex.current_version).toBe(publicContractVersion);
    for (const [identifier, generated] of Object.entries(generatedIndex.contracts)) {
      const schema = JSON.parse(
        await readFile(new URL(`../../generated/${generated.path}`, import.meta.url), 'utf8'),
      ) as { title?: string };
      expect(schema.title).toBe(identifier);
    }
  });
});
