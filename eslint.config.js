import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Håndhever teamreglene fra briefen (B3/B5): ingen default exports, ingen star-imports.
const teamRules = {
  'no-restricted-syntax': [
    'error',
    {
      selector: 'ExportDefaultDeclaration',
      message: 'Bruk named exports (B3).',
    },
    {
      selector: 'ImportNamespaceSpecifier',
      message: 'Ingen star-imports (B5). Importer navngitte medlemmer.',
    },
  ],
};

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'test-vault', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: teamRules,
  },
  {
    files: ['src/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    // ADR-011: terminalen bruker server-features og (etter K1–K4) src/core – aldri web-koden eller React.
    files: ['src/terminal/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'Terminalen bruker ikke React (ADR-011 §3).' },
            { name: 'react-dom', message: 'Terminalen bruker ikke React (ADR-011 §3).' },
          ],
          patterns: [{ group: ['**/web/**', '**/web'], message: 'Terminalen importerer ikke web-koden; flytt delt logikk til src/core (ADR-011 §1).' }],
        },
      ],
    },
  },
  {
    // ADR-011 §1 / AR-3-01: src/core er ren TS uten plattform. Ingen globals (verken browser eller node);
    // tsc håndhever resten, fordi kjernen typesjekkes både i web-prosjektet (uten Node) og server-prosjektet (uten DOM).
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'Kjernen er ren TS uten React (ADR-011 §1).' },
            { name: 'react-dom', message: 'Kjernen er ren TS uten React (ADR-011 §1).' },
          ],
          patterns: [
            { group: ['node:*'], message: 'Kjernen bruker ikke Node-API-er (ADR-011 §1).' },
            { group: ['**/web/**', '**/web', '**/server/**', '**/server', '**/terminal/**', '**/terminal'], message: 'Kjernen importerer bare src/shared og rene pakker (ADR-011 §1).' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/server/**/*.ts', '*.config.{ts,js}', 'e2e/**/*.ts', 'scripts/**/*.{js,mjs,ts}', 'test-vault-tools/**/*.{js,mjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    // Verktøy-konfig krever default export.
    files: ['*.config.{ts,js}'],
    rules: { 'no-restricted-syntax': 'off' },
  },
);
