import type { TableColumn, TableIndex } from 'typeorm';
import { AuthAddRefreshTokensSession20261018120011 } from '../migrations/20261018120011-auth-add-refresh-tokens-session.js';
import { asQueryRunner, fakeQueryRunner } from './fake-query-runner.js';

describe('AuthAddRefreshTokensSession20261018120011', () => {
  const migration = new AuthAddRefreshTokensSession20261018120011();

  describe('up', () => {
    it('adds the columns nullable, backfills, makes them NOT NULL, then indexes session_uuid', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(runner.calls).toEqual([
        'addColumns',
        'query',
        'changeColumn',
        'changeColumn',
        'createIndex',
      ]);
    });

    it('adds session_uuid varchar(36) and started_at datetime as nullable', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      const [table, columns] = runner.addColumns.mock.calls[0] as [string, TableColumn[]];
      expect(table).toBe('auth_refresh_tokens');
      expect(columns.map((c) => [c.name, c.type, c.length, c.isNullable])).toEqual([
        ['session_uuid', 'varchar', '36', true],
        ['started_at', 'datetime', '', true],
      ]);
    });

    it('backfills every row as its own session started at issued_at', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(runner.query).toHaveBeenCalledWith(
        'UPDATE auth_refresh_tokens SET session_uuid = UUID(), started_at = issued_at',
      );
    });

    it('makes both columns NOT NULL', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      const changes = runner.changeColumn.mock.calls as [string, string, TableColumn][];
      expect(changes.map(([table, name, column]) => [table, name, column.name, column.isNullable])).toEqual([
        ['auth_refresh_tokens', 'session_uuid', 'session_uuid', false],
        ['auth_refresh_tokens', 'started_at', 'started_at', false],
      ]);
      expect(changes[0][2].length).toBe('36');
      expect(changes[1][2].type).toBe('datetime');
    });

    it('creates the non-unique session_uuid index', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      const [table, index] = runner.createIndex.mock.calls[0] as [string, TableIndex];
      expect(table).toBe('auth_refresh_tokens');
      expect(index.name).toBe('idx_auth_refresh_tokens_session_uuid');
      expect(index.columnNames).toEqual(['session_uuid']);
      expect(index.isUnique).toBe(false);
    });
  });

  describe('down', () => {
    it('drops the index, then both columns', async () => {
      const runner = fakeQueryRunner();

      await migration.down(asQueryRunner(runner));

      expect(runner.calls).toEqual(['dropIndex', 'dropColumn', 'dropColumn']);
      expect(runner.dropIndex).toHaveBeenCalledWith(
        'auth_refresh_tokens',
        'idx_auth_refresh_tokens_session_uuid',
      );
      expect(runner.dropColumn.mock.calls).toEqual([
        ['auth_refresh_tokens', 'started_at'],
        ['auth_refresh_tokens', 'session_uuid'],
      ]);
    });
  });
});
