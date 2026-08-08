import type { Config } from 'jest';

// Jest itself always runs as CommonJS regardless of this package's
// "type": "module" — `@swc/jest` compiles each test/source `.ts` file to
// CommonJS for Jest's runtime (NestJS's own recommended Jest/SWC setup;
// unlike `ts-jest`, it isn't affected by `tsconfig.json`'s NodeNext module
// setting or by `package.json`'s "type": "module"), and `moduleNameMapper`
// strips the explicit `.js` extensions our NodeNext-style source imports
// use (e.g. `./auth.service.js`) so Jest resolves them back to the `.ts`
// source files.
const config: Config = {
  rootDir: 'src',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.(spec|e2e-spec)\\.ts$',
  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
          target: 'es2022',
        },
        module: { type: 'commonjs' },
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.spec.ts',
    '!**/*.e2e-spec.ts',
    // Bootstrap/wiring and TypeORM migrations are exercised by booting the
    // app and by `yarn migration:run`/`migration:revert` against a real
    // database (see docs/agents/architecture/backend.md), not by unit
    // tests — excluded here the same way `nest new`'s default Jest config
    // excludes `main.ts`.
    '!main.ts',
    '!app.module.ts',
    '!mail/mail.module.ts',
    '!database/**',
  ],
  coverageDirectory: '../coverage',
};

export default config;
