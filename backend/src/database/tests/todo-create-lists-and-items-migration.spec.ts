import type { Table } from 'typeorm';
import { asQueryRunner, fakeQueryRunner } from './fake-query-runner.js';
import { TodoCreateListsAndItems20261125120016 } from '../migrations/20261125120016-todo-create-lists-and-items.js';

describe('TodoCreateListsAndItems20261125120016', () => {
  const migration = new TodoCreateListsAndItems20261125120016();

  async function createdTables(): Promise<Array<[Table, boolean]>> {
    const runner = fakeQueryRunner();
    await migration.up(asQueryRunner(runner));
    return runner.createTable.mock.calls as Array<[Table, boolean]>;
  }

  describe('up', () => {
    it('creates todo_lists, adds its owner CHECK, then creates todo_items, only if they do not exist', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(runner.calls).toEqual(['createTable', 'query', 'createTable']);
      const calls = runner.createTable.mock.calls as Array<[Table, boolean]>;
      expect(calls.map(([table, ifNotExist]) => [table.name, ifNotExist])).toEqual([
        ['todo_lists', true],
        ['todo_items', true],
      ]);
    });

    it('creates todo_lists with nullable owner columns', async () => {
      const [[table]] = await createdTables();

      expect(table.columns.map((c) => [c.name, c.type, c.length, c.isNullable])).toEqual([
        ['id', 'int', '', false],
        ['name', 'varchar', '255', false],
        ['user_id', 'int', '', true],
        ['organization_id', 'int', '', true],
        ['created_at', 'datetime', '', false],
        ['updated_at', 'datetime', '', false],
      ]);
      expect(table.columns[0].isPrimary).toBe(true);
    });

    it('indexes both owner columns and declares no FK on them (logical references)', async () => {
      const [[table]] = await createdTables();

      expect(table.indices.map((i) => [i.name, i.columnNames, i.isUnique])).toEqual([
        ['idx_todo_lists_user_id', ['user_id'], false],
        ['idx_todo_lists_organization_id', ['organization_id'], false],
      ]);
      expect(table.foreignKeys).toEqual([]);
    });

    it('adds a CHECK that exactly one owner is set', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(runner.query).toHaveBeenCalledTimes(1);
      expect(runner.query).toHaveBeenCalledWith(
        'ALTER TABLE `todo_lists` ADD CONSTRAINT `chk_todo_lists_exactly_one_owner` ' +
        'CHECK ((`user_id` IS NULL) <> (`organization_id` IS NULL))',
      );
    });

    it('creates todo_items with list_id, description and done (default false)', async () => {
      const [, [table]] = await createdTables();

      expect(table.columns.map((c) => [c.name, c.type, c.length, c.isNullable])).toEqual([
        ['id', 'int', '', false],
        ['list_id', 'int', '', false],
        ['description', 'varchar', '255', false],
        ['done', 'boolean', '', false],
        ['created_at', 'datetime', '', false],
        ['updated_at', 'datetime', '', false],
      ]);
      expect(table.columns[3].default).toBe(false);
    });

    it('indexes list_id and declares a real FK to todo_lists with ON DELETE RESTRICT', async () => {
      const [, [table]] = await createdTables();

      expect(table.indices.map((i) => [i.name, i.columnNames])).toEqual([['idx_todo_items_list_id', ['list_id']]]);
      expect(
        table.foreignKeys.map((fk) => [
          fk.name,
          fk.columnNames,
          fk.referencedTableName,
          fk.referencedColumnNames,
          fk.onDelete,
        ]),
      ).toEqual([['fk_todo_items_list_id', ['list_id'], 'todo_lists', ['id'], 'RESTRICT']]);
    });
  });

  describe('down', () => {
    it('drops todo_items, then todo_lists', async () => {
      const runner = fakeQueryRunner();

      await migration.down(asQueryRunner(runner));

      expect(runner.calls).toEqual(['dropTable', 'dropTable']);
      expect(runner.dropTable).toHaveBeenNthCalledWith(1, 'todo_items', true, true, true);
      expect(runner.dropTable).toHaveBeenNthCalledWith(2, 'todo_lists', true, true, true);
    });
  });
});
