import type { TableColumn } from 'typeorm';
import { AuthAddRefreshTokensRevokedReason20261018120012 } from '../migrations/20261018120012-auth-add-refresh-tokens-revoked-reason.js';
import { asQueryRunner, fakeQueryRunner } from './fake-query-runner.js';

describe('AuthAddRefreshTokensRevokedReason20261018120012', () => {
  const migration = new AuthAddRefreshTokensRevokedReason20261018120012();

  describe('up', () => {
    it('adds the column, then backfills', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(runner.calls).toEqual(['addColumn', 'query']);
    });

    it('adds revoked_reason varchar(32) as nullable', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      const [table, column] = runner.addColumn.mock.calls[0] as [string, TableColumn];
      expect(table).toBe('auth_refresh_tokens');
      expect([column.name, column.type, column.length, column.isNullable]).toEqual([
        'revoked_reason',
        'varchar',
        '32',
        true,
      ]);
    });

    it('sets rotated on revoked rows only, leaving unrevoked rows NULL', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(runner.query).toHaveBeenCalledWith(
        "UPDATE auth_refresh_tokens SET revoked_reason = 'rotated' WHERE revoked_at IS NOT NULL",
      );
    });
  });

  describe('down', () => {
    it('drops the column', async () => {
      const runner = fakeQueryRunner();

      await migration.down(asQueryRunner(runner));

      expect(runner.calls).toEqual(['dropColumn']);
      expect(runner.dropColumn).toHaveBeenCalledWith('auth_refresh_tokens', 'revoked_reason');
    });
  });
});
