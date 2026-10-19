import type { TableColumn } from 'typeorm';
import { asQueryRunner, fakeQueryRunner } from './fake-query-runner.js';
import { AuthAddUsersStatus20261019120014 } from '../migrations/20261019120014-auth-add-users-status.js';

describe('AuthAddUsersStatus20261019120014', () => {
  const migration = new AuthAddUsersStatus20261019120014();

  describe('up', () => {
    it('adds the column nullable, backfills, then makes it NOT NULL', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(runner.calls).toEqual(['addColumn', 'query', 'changeColumn']);
    });

    it('adds status varchar(16) as nullable', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      const [table, column] = runner.addColumn.mock.calls[0] as [string, TableColumn];
      expect(table).toBe('auth_users');
      expect([column.name, column.type, column.length, column.isNullable]).toEqual([
        'status',
        'varchar',
        '16',
        true,
      ]);
    });

    it('backfills every existing user as approved', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(runner.query).toHaveBeenCalledWith("UPDATE auth_users SET status = 'approved'");
    });

    it('makes the column NOT NULL with no default', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      const [table, name, column] = runner.changeColumn.mock.calls[0] as [string, string, TableColumn];
      expect([table, name, column.name, column.type, column.length, column.isNullable]).toEqual([
        'auth_users',
        'status',
        'status',
        'varchar',
        '16',
        false,
      ]);
      expect(column.default).toBeUndefined();
    });
  });

  describe('down', () => {
    it('drops the column', async () => {
      const runner = fakeQueryRunner();

      await migration.down(asQueryRunner(runner));

      expect(runner.calls).toEqual(['dropColumn']);
      expect(runner.dropColumn).toHaveBeenCalledWith('auth_users', 'status');
    });
  });
});
