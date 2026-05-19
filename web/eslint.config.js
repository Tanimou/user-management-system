import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      'prefer-const': 'error',
      'no-console': 'warn',
      'no-var': 'error',
    },
  },
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**'],
  },
];