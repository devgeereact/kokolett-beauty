// @ts-check
/**
 * Flat config. ESLint 9 stopped reading `.eslintrc.cjs` and ESLint 10 dropped
 * the compatibility path entirely, so this file replaces it — same rules, same
 * ignores, expressed the new way.
 *
 * Two things that do NOT carry over from the old file, and are easy to get
 * wrong:
 *
 * 1. `ignorePatterns` is now a standalone `{ ignores }` object, and it only
 *    applies globally when it is the ONLY key in that object. Adding a sibling
 *    key silently scopes it to that block instead.
 * 2. `env: { browser: true }` is gone. Globals come from the `globals` package
 *    via `languageOptions.globals`.
 *
 * Rules are unchanged from `.eslintrc.cjs`; docs/RULES.md §2 and §6 describe
 * what they enforce and why.
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
  // Global ignores. Must stay an object with `ignores` as its only key.
  {
    ignores: [
      'dist',
      'dev-dist',
      'coverage',
      'node_modules',
      'eslint.config.js',
      'postcss.config.js',
      'src/types/database.types.ts',
      // Deno, not Node: a different global scope and different module
      // resolution. CI typechecks these with `deno check` instead.
      'supabase/functions',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        // `projectService` rather than `project: ['./tsconfig.json']`. The
        // explicit-project form builds its own program and resolved `.at()`
        // (ES2022, reaching this codebase through @types/node) as an error
        // type, which made every expression downstream of it "unsafe" — four
        // files, twelve errors, none of them real. The project service reuses
        // the same resolution tsc does, so lint and typecheck agree.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        { allowExpressions: true },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  /**
   * `scripts/*.mjs` are one-off maintenance scripts that run against the live
   * Supabase project. ESLint 8 never looked at them (it did not lint `.mjs` by
   * default); ESLint 9+ does, and they fail to parse because tsconfig.json
   * deliberately does not include them.
   *
   * Linted rather than ignored — a careless edit to the demo-data seeder or the
   * subscriber cleanup is expensive in a way a lint error is not. Type-aware
   * rules are switched off because there is no program to check them against;
   * `console` is expected in a CLI script.
   */
  {
    files: ['scripts/**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: false, project: false },
    },
    rules: {
      'no-console': 'off',
      // Plain JavaScript: there are no type annotations to require.
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },

  /**
   * Playwright E2E — real TypeScript, so kept type-checked (unlike the plain
   * `scripts/*.mjs` above), but `tsconfig.json`'s own `include` deliberately
   * excludes it (it's Node-side test code, not app code the production build
   * should sweep). `allowDefaultProject` gives the project service a
   * single-file program for each instead of requiring a dedicated tsconfig.
   */
  {
    files: ['e2e/**/*.ts', 'playwright.config.ts'],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: { allowDefaultProject: ['e2e/*.ts', 'playwright.config.ts'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
);
