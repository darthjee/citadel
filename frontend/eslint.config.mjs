import js from '@eslint/js';
import complexity from 'eslint-plugin-complexity';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jasmine from 'eslint-plugin-jasmine';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';

// No-op stand-ins for Codacy-only rules (Codacy runs a broader ESLint-based rule set than this
// project installs). They are never enabled in `rules` below — they exist solely so ESLint
// recognizes the rule IDs referenced by narrowly-scoped `eslint-disable-next-line` comments
// suppressing confirmed Codacy false positives; without a matching rule definition, ESLint
// itself errors with "Definition for rule ... was not found" on those disable comments.
const codacyRuleStubs = {
  xss: { rules: { 'no-mixed-html': { create: () => ({}) } } },
  security: { rules: { 'detect-object-injection': { create: () => ({}) } } },
  '@typescript-eslint': { rules: { 'no-extraneous-class': { create: () => ({}) } } },
  'security-node': { rules: { 'non-literal-reg-expr': { create: () => ({}) } } },
};

export default [
  { ignores: ['node_modules/**/*.js', 'dist/**/*.js', 'report/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    plugins: {
      complexity, react, 'react-hooks': reactHooks, jsdoc, ...codacyRuleStubs,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node, ...globals.es2021 },
    },
    settings: { react: { version: 'detect' } },
    rules: {
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
      'no-empty-function': 'error',
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'jsdoc/require-jsdoc': ['error', {
        require: { ClassDeclaration: true, MethodDefinition: true, FunctionDeclaration: true },
        publicOnly: true,
      }],
      'jsdoc/require-param': 'error',
      'jsdoc/require-param-description': 'error',
      'jsdoc/require-returns': 'error',
      'jsdoc/require-returns-description': 'error',
      'jsdoc/require-description': 'error',
    },
  },
  {
    // Test files: relax JSDoc rules and enable Jasmine globals
    files: ['specs/**/*.{js,jsx,mjs}'],
    plugins: { jasmine },
    languageOptions: { globals: { ...globals.jasmine } },
    rules: {
      'jasmine/no-focused-tests': 'error',
      'jasmine/no-disabled-tests': 'warn',
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/require-param': 'off',
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/require-returns-description': 'off',
      'jsdoc/require-description': 'off',
    },
  },
  {
    // The `codacyRuleStubs` above are always off in this project's own lint run (they exist
    // only so the rule IDs resolve), so any `eslint-disable-next-line` referencing them is,
    // from this config's point of view, always "unused". Silencing that meta-warning is scoped
    // to just the files carrying those Codacy-only suppressions, so unused-directive detection
    // stays intact everywhere else.
    files: [
      'assets/js/components/resources/admin/pages/helpers/AdminUsersHelper.jsx',
    ],
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
];
