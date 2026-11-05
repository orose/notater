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
    files: ['src/server/**/*.ts', '*.config.{ts,js}', 'e2e/**/*.ts', 'scripts/**/*.{js,mjs,ts}', 'test-vault-tools/**/*.{js,mjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    // Verktøy-konfig krever default export.
    files: ['*.config.{ts,js}'],
    rules: { 'no-restricted-syntax': 'off' },
  },
);
