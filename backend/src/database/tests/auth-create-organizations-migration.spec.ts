import type { Table } from 'typeorm';
import { asQueryRunner, fakeQueryRunner } from './fake-query-runner.js';
import { AuthCreateOrganizations20261107120015 } from '../migrations/20261107120015-auth-create-organizations.js';

describe('AuthCreateOrganizations20261107120015', () => {
  const migration = new AuthCreateOrganizations20261107120015();

  async function createdTables(): Promise<Array<[Table, boolean]>> {
    const runner = fakeQueryRunner();
    await migration.up(asQueryRunner(runner));
    return runner.createTable.mock.calls as Array<[Table, boolean]>;
  }

  describe('up', () => {
    it('creates the organizations table, then the memberships table, and nothing else', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(runner.calls).toEqual(['createTable', 'createTable']);
      const names = (runner.createTable.mock.calls as Array<[Table, boolean]>).map(([table]) => table.name);
      expect(names).toEqual(['auth_organizations', 'auth_organization_memberships']);
      expect(runner.query).not.toHaveBeenCalled();
    });

    it('creates both tables only if they do not exist', async () => {
      const calls = await createdTables();

      expect(calls.map(([, ifNotExist]) => ifNotExist)).toEqual([true, true]);
    });

    it('creates auth_organizations with id, name and timestamps', async () => {
      const [[table]] = await createdTables();

      expect(table.columns.map((c) => [c.name, c.type, c.length, c.isPrimary])).toEqual([
        ['id', 'int', '', true],
        ['name', 'varchar', '255', false],
        ['created_at', 'datetime', '', false],
        ['updated_at', 'datetime', '', false],
      ]);
      expect(table.columns[0].isGenerated).toBe(true);
      expect(table.columns[0].generationStrategy).toBe('increment');
      expect(table.indices).toEqual([]);
      expect(table.foreignKeys).toEqual([]);
    });

    it('creates auth_organization_memberships with its columns', async () => {
      const [, [table]] = await createdTables();

      expect(table.columns.map((c) => [c.name, c.type, c.length, c.isPrimary])).toEqual([
        ['id', 'int', '', true],
        ['organization_id', 'int', '', false],
        ['user_id', 'int', '', false],
        ['role', 'varchar', '16', false],
        ['created_at', 'datetime', '', false],
        ['updated_at', 'datetime', '', false],
      ]);
    });

    it('declares the unique (organization_id, user_id) index and the user_id index', async () => {
      const [, [table]] = await createdTables();

      expect(table.indices.map((i) => [i.name, i.columnNames, i.isUnique])).toEqual([
        ['idx_auth_organization_memberships_organization_id_user_id', ['organization_id', 'user_id'], true],
        ['idx_auth_organization_memberships_user_id', ['user_id'], false],
      ]);
    });

    it('declares both foreign keys with ON DELETE RESTRICT', async () => {
      const [, [table]] = await createdTables();

      expect(
        table.foreignKeys.map((fk) => [
          fk.name,
          fk.columnNames,
          fk.referencedTableName,
          fk.referencedColumnNames,
          fk.onDelete,
        ]),
      ).toEqual([
        ['fk_auth_organization_memberships_organization_id', ['organization_id'], 'auth_organizations', ['id'], 'RESTRICT'],
        ['fk_auth_organization_memberships_user_id', ['user_id'], 'auth_users', ['id'], 'RESTRICT'],
      ]);
    });
  });

  describe('down', () => {
    it('drops the memberships table (with its FKs and indexes), then the organizations table', async () => {
      const runner = fakeQueryRunner();

      await migration.down(asQueryRunner(runner));

      expect(runner.calls).toEqual(['dropTable', 'dropTable']);
      expect(runner.dropTable).toHaveBeenNthCalledWith(1, 'auth_organization_memberships', true, true, true);
      expect(runner.dropTable).toHaveBeenNthCalledWith(2, 'auth_organizations', true);
    });
  });
});
