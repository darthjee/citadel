import js from '@eslint/js';
import complexity from 'eslint-plugin-complexity';
import importPlugin from 'eslint-plugin-import';
import jsdoc from 'eslint-plugin-jsdoc';
import sortClassMembers from 'eslint-plugin-sort-class-members';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['node_modules/**/*.js', 'coverage/**', 'report/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs}'],
    plugins: {
      complexity,
      jsdoc,
      'import': importPlugin,
      'sort-class-members': sortClassMembers,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    settings: {
      'import/resolver': {
        node: { extensions: ['.js', '.mjs'] },
      },
    },
    rules: {
      'import/order': ['error', {
        alphabetize: { order: 'asc', caseInsensitive: true },
        'newlines-between': 'never',
        groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
      }],

      'no-trailing-spaces': ['error', { skipBlankLines: false, ignoreComments: false }],
      'no-multi-spaces': ['error', { ignoreEOLComments: true }],

      complexity: ['warn', { max: 10 }],
      'max-lines': ['warn', { max: 300 }],
      'max-depth': ['warn', { max: 4 }],

      indent: ['error', 2, { SwitchCase: 1 }],
      'linebreak-style': ['error', 'unix'],
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'always'],

      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',

      'sort-class-members/sort-class-members': ['error', {
        order: [
          '[static-properties]',
          '[static-methods]',
          '[properties]',
          'constructor',
          { type: 'method', private: false },
          { type: 'method', private: true },
        ],
        accessorPairPositioning: 'getThenSet',
      }],

      'jsdoc/check-alignment': 'warn',
      'jsdoc/check-param-names': 'error',
      'jsdoc/check-tag-names': 'error',
      'jsdoc/check-types': 'warn',
      'jsdoc/require-param-description': 'warn',
      'jsdoc/require-returns-description': 'warn',
    },
  },
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ['**/*.ts'] })),
  {
    files: ['**/*.ts'],
    plugins: {
      complexity,
      jsdoc,
      'import': importPlugin,
      'sort-class-members': sortClassMembers,
    },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    settings: {
      'import/resolver': {
        node: { extensions: ['.ts', '.js'] },
      },
    },
    rules: {
      'import/order': ['error', {
        alphabetize: { order: 'asc', caseInsensitive: true },
        'newlines-between': 'never',
        groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
      }],

      'no-trailing-spaces': ['error', { skipBlankLines: false, ignoreComments: false }],
      'no-multi-spaces': ['error', { ignoreEOLComments: true }],

      complexity: ['warn', { max: 10 }],
      'max-lines': ['warn', { max: 300 }],
      'max-depth': ['warn', { max: 4 }],

      indent: ['error', 2, { SwitchCase: 1 }],
      'linebreak-style': ['error', 'unix'],
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'always'],

      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',

      // TypeScript's own compiler (via `strict`/`noImplicitAny`, see
      // tsconfig.json) already catches unused vars/undefined members with
      // more precision than the JS-oriented rules below.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // NestJS decorators (`@Entity()`, `@Column()`, DTO classes, ...) and
      // TypeORM's column typing rely on empty/declaration-only constructs
      // that this rule otherwise flags.
      '@typescript-eslint/no-empty-object-type': 'off',

      'sort-class-members/sort-class-members': ['error', {
        order: [
          '[static-properties]',
          '[static-methods]',
          '[properties]',
          'constructor',
          { type: 'method', private: false },
          { type: 'method', private: true },
        ],
        accessorPairPositioning: 'getThenSet',
      }],

      'jsdoc/check-alignment': 'warn',
      'jsdoc/check-param-names': 'error',
      'jsdoc/check-tag-names': 'error',
      'jsdoc/check-types': 'warn',
      'jsdoc/require-param-description': 'warn',
      'jsdoc/require-returns-description': 'warn',
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      // Test doubles/fixtures legitimately grow past the source file limit.
      'max-lines': 'off',
    },
  },
];
