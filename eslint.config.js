import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      'artifacts/**',
      'docs/api/**',
      'node_modules/**',
      'homepage/**',
      'landing-page-preview.html',
    ],
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    ...js.configs.recommended,
    languageOptions: {
      globals: {
        URL: 'readonly',
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      // Use explicit `project: []` enumeration with all 16 tsconfig.json files.
      // `projectService: true` is faster but has documented race conditions in
      // parallel CI workers — for this repo it surfaces as three independent
      // flake classes on the same commit:
      //   1. ESLint no-unsafe-* errors (parser sees `error`-typed expressions)
      //   2. ESLint no-unnecessary-type-assertion (parser sees generic types)
      //   3. tsc TS2307 "Cannot find module '@operatoros-platform/...'"
      // Explicit enumeration is slower (~10-30s on CI) but deterministic.
      // Globs are NOT supported by `project` — only explicit file paths.
      parserOptions: {
        project: [
          './tsconfig.lint.json',
          './apps/cli/tsconfig.json',
          './apps/smoke/tsconfig.json',
          './packages/agent-execution/tsconfig.json',
          './packages/contracts/tsconfig.json',
          './packages/distributed-coordination/tsconfig.json',
          './packages/evidence-service/tsconfig.json',
          './packages/execution-service/tsconfig.json',
          './packages/extension-runtime/tsconfig.json',
          './packages/governance-service/tsconfig.json',
          './packages/hosted-runtime/tsconfig.json',
          './packages/interface-host/tsconfig.json',
          './packages/recovery-service/tsconfig.json',
          './packages/secrets-service/tsconfig.json',
          './packages/v08-importer/tsconfig.json',
          './packages/workspace-service/tsconfig.json',
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: { '@typescript-eslint/consistent-type-imports': 'error' },
  },
  {
    files: ['apps/cli/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    },
  },
  {
    // Integration surfaces: apps/* (binaries/CLI), tooling/* (build/CI scripts),
    // spikes/* (experiments). These contain ergonomic type-unsafe patterns
    // (z.record inference, as-unknown boundary casts, JSON.parse) that are
    // appropriate for boundary code, not library code.
    files: ['apps/**/*.ts', 'tooling/**/*.ts', 'spikes/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    },
  },
  {
    // Library packages: packages/*. Same rationale as above — the no-unsafe-*
    // family fires on any type that the parser could not fully resolve, which
    // happens routinely with `node:sqlite` DatabaseSync.run() prepared
    // statements, `as unknown as` boundary casts in dispatch tables, and zod
    // inference. These patterns are accepted in this codebase; strict
    // no-unsafe-* enforcement would require a separate refactor of every
    // boundary. Keeping this rule off matches the existing apps/cli override.
    files: ['packages/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    },
  },
);
