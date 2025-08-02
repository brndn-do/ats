import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';
import pluginPrettier from 'eslint-plugin-prettier';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  {
    ignores: ['node_modules/', 'coverage/'],
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    plugins: {
      js,
      prettier: pluginPrettier,
    },
    extends: ['js/recommended', prettier],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'prettier/prettier': 'error',

      // Best Practices
      eqeqeq: ['error', 'always'],
      'no-console': 'warn', // allow for debugging, but warn
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'consistent-return': 'error',

      // Stylistic
      curly: ['error', 'all'],
      'no-multiple-empty-lines': ['warn', { max: 1 }],
      'padding-line-between-statements': [
        'warn',
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: 'import', next: '*' },
        { blankLine: 'any', prev: 'import', next: 'import' },
      ],

      // Node.js/Express specific
      'callback-return': 'warn',
      'handle-callback-err': ['warn', '^err'],
      'no-process-exit': 'error',

      // Supertest/test-oriented
      'no-undef': 'off',
      'prefer-const': 'error',
      'no-await-in-loop': 'warn',
    },
  },
]);
