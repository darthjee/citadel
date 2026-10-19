import type { Table, TableIndex } from 'typeorm';
import { AuthDropSessions20261018120013 } from '../migrations/20261018120013-auth-drop-sessions.js';
import { asQueryRunner, fakeQueryRunner } from './fake-query-runner.js';

describe('AuthDropSessions20261018120013', () => {
  const migration = new AuthDropSessions20261018120013();

  describe('up', () => {
    it('drops auth_sessions if it exists', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(runner.calls).toEqual(['dropTable']);
      expect(runner.dropTable).toHaveBeenCalledWith('auth_sessions', true);
    });
  });

  describe('down', () => {
    it('recreates the table, then its user_id index, inserting no rows', async () => {
      const runner = fakeQueryRunner();

      await migration.down(asQueryRunner(runner));

      expect(runner.calls).toEqual(['createTable', 'createIndex']);
      expect(runner.query).not.toHaveBeenCalled();
    });

    it('recreates the original shape', async () => {
      const runner = fakeQueryRunner();

      await migration.down(asQueryRunner(runner));

      const [table, ifNotExist] = runner.createTable.mock.calls[0] as [Table, boolean];
      expect(table.name).toBe('auth_sessions');
      expect(ifNotExist).toBe(true);
      expect(table.columns.map((c) => [c.name, c.type, c.isPrimary, c.default])).toEqual([
        ['id', 'int', true, undefined],
        ['user_id', 'int', false, undefined],
        ['created_at', 'datetime', false, 'CURRENT_TIMESTAMP'],
        ['last_seen_at', 'datetime', false, 'CURRENT_TIMESTAMP'],
      ]);
      expect(table.columns[0].isGenerated).toBe(true);
      expect(table.columns[0].generationStrategy).toBe('increment');
    });

    it('recreates the user_id index', async () => {
      const runner = fakeQueryRunner();

      await migration.down(asQueryRunner(runner));

      const [tableName, index] = runner.createIndex.mock.calls[0] as [string, TableIndex];
      expect(tableName).toBe('auth_sessions');
      expect(index.name).toBe('idx_auth_sessions_user_id');
      expect(index.columnNames).toEqual(['user_id']);
    });
  });
});
