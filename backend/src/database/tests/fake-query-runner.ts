import type { QueryRunner } from 'typeorm';

const METHODS = [
  'addColumn',
  'addColumns',
  'changeColumn',
  'createIndex',
  'createTable',
  'dropColumn',
  'dropIndex',
  'dropTable',
  'query',
] as const;

export type FakeQueryRunnerMocks = Record<(typeof METHODS)[number], jest.Mock> & { calls: string[] };

export function fakeQueryRunner(): FakeQueryRunnerMocks {
  const calls: string[] = [];
  const runner = { calls } as FakeQueryRunnerMocks;
  for (const method of METHODS) {
    runner[method] = jest.fn(async () => {
      calls.push(method);
    });
  }
  return runner;
}

export function asQueryRunner(runner: FakeQueryRunnerMocks): QueryRunner {
  return runner as unknown as QueryRunner;
}
