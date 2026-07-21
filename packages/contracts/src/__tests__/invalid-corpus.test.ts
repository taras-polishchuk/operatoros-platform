import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { parseContract } from '../index.js';

const corpusSchema = z.object({
  schema_version: z.literal(1),
  cases: z.array(
    z.object({
      id: z.string().min(1),
      contract: z.string().min(1),
      value: z.unknown(),
      expected_issue_path: z.string().min(1),
    }),
  ),
});

describe('IP-002 invalid contract corpus', () => {
  it('rejects every versioned invalid sample at the declared boundary', async () => {
    const corpus = corpusSchema.parse(
      JSON.parse(await readFile(new URL('../../corpus/invalid.json', import.meta.url), 'utf8')),
    );

    expect(corpus.cases.length).toBeGreaterThan(0);
    for (const testCase of corpus.cases) {
      try {
        parseContract(testCase.contract, testCase.value);
        throw new Error(`INVALID_CORPUS_ACCEPTED: ${testCase.id}`);
      } catch (error) {
        expect(error).not.toHaveProperty('message', `INVALID_CORPUS_ACCEPTED: ${testCase.id}`);
        expect(error).toBeInstanceOf(z.ZodError);
        if (error instanceof z.ZodError) {
          expect(error.issues.map((issue) => issue.path.join('.'))).toContain(
            testCase.expected_issue_path,
          );
        }
      }
    }
  });
});
