import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'tooling/**/*.test.ts',
      'packages/**/*.test.ts',
      'apps/**/*.test.ts',
      'spikes/**/*.test.ts',
      '**/__tests__/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      reportsDirectory: 'artifacts/reports/coverage',
      thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 },
    },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
