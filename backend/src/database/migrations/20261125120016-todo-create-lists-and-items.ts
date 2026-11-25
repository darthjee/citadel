import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table, TableForeignKey, TableIndex } from 'typeorm';
import { createdAtColumn, idColumn, updatedAtColumn } from './helpers.js';

const LISTS = 'todo_lists';
const ITEMS = 'todo_items';
const OWNER_CHECK = 'chk_todo_lists_exactly_one_owner';
const OWNER_CHECK_EXPRESSION = '(`user_id` IS NULL) <> (`organization_id` IS NULL)';

/**
 * Creates the Todo module's `todo_lists` and `todo_items` tables (see
 * `docs/agents/modules/todo.md`). A list is owned by exactly one of a user or
 * an organization: `user_id` and `organization_id` are **logical** references
 * to `auth` tables (they cross modules, so there is no physical FK), indexed
 * for the per-owner lookups, and the `chk_todo_lists_exactly_one_owner` CHECK
 * (enforced by MySQL 8.0.16+) guarantees exactly one of them is set. The
 * CHECK is added with a raw `ALTER TABLE`: TypeORM's MySQL driver silently
 * ignores `Table#checks` in `createTable` (and refuses `createCheckConstraint`).
 * Items have no owner columns — they inherit the owner through their list —
 * and `list_id` is a **real** FK (both tables are owned by `todo`) with
 * `ON DELETE RESTRICT`, so a list with items can never be deleted.
 */
export class TodoCreateListsAndItems20261125120016 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: LISTS,
        columns: [
          idColumn(),
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'user_id', type: 'int', isNullable: true },
          { name: 'organization_id', type: 'int', isNullable: true },
          createdAtColumn(),
          updatedAtColumn(),
        ],
        indices: [
          new TableIndex({ name: 'idx_todo_lists_user_id', columnNames: ['user_id'] }),
          new TableIndex({ name: 'idx_todo_lists_organization_id', columnNames: ['organization_id'] }),
        ],
      }),
      true,
    );
    await queryRunner.query(
      `ALTER TABLE \`${LISTS}\` ADD CONSTRAINT \`${OWNER_CHECK}\` CHECK (${OWNER_CHECK_EXPRESSION})`,
    );

    await queryRunner.createTable(
      new Table({
        name: ITEMS,
        columns: [
          idColumn(),
          { name: 'list_id', type: 'int' },
          { name: 'description', type: 'varchar', length: '255' },
          { name: 'done', type: 'boolean', default: false },
          createdAtColumn(),
          updatedAtColumn(),
        ],
        indices: [new TableIndex({ name: 'idx_todo_items_list_id', columnNames: ['list_id'] })],
        foreignKeys: [
          new TableForeignKey({
            name: 'fk_todo_items_list_id',
            columnNames: ['list_id'],
            referencedTableName: LISTS,
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          }),
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(ITEMS, true, true, true);
    await queryRunner.dropTable(LISTS, true, true, true);
  }
}
