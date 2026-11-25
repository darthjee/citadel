import type { DataSource } from 'typeorm';
import { indexNames } from './schema-inspection.js';
import { createTestDataSource, resetDatabase, runMigrationsUpTo } from './test-data-source.js';

describe('TodoCreateListsAndItems20261125120016 (MySQL)', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await createTestDataSource();
  });

  beforeEach(async () => {
    await resetDatabase(ds);
    await runMigrationsUpTo(ds, 'TodoCreateListsAndItems20261125120016');
  });

  afterAll(async () => {
    await ds.destroy();
  });

  async function insertList(userId: number | null, organizationId: number | null): Promise<number> {
    const result: { insertId: number } = await ds.query(
      'INSERT INTO todo_lists (name, user_id, organization_id) VALUES (?, ?, ?)',
      ['list', userId, organizationId],
    );
    return result.insertId;
  }

  it('accepts a list owned by exactly one of a user or an organization', async () => {
    await expect(insertList(1, null)).resolves.toEqual(expect.any(Number));
    await expect(insertList(null, 1)).resolves.toEqual(expect.any(Number));
  });

  it.each([
    ['no owner', null, null],
    ['both owners', 1, 1],
  ])('rejects a list with %s', async (_label, userId, organizationId) => {
    await expect(insertList(userId, organizationId)).rejects.toThrow(/chk_todo_lists_exactly_one_owner/);
  });

  it('defaults done to false and refuses to delete a list that still has items', async () => {
    const listId = await insertList(1, null);
    await ds.query('INSERT INTO todo_items (list_id, description) VALUES (?, ?)', [listId, 'item']);

    const [{ done }]: Array<{ done: number }> = await ds.query('SELECT done FROM todo_items');
    expect(Number(done)).toBe(0);
    await expect(ds.query('DELETE FROM todo_lists WHERE id = ?', [listId])).rejects.toThrow(/foreign key constraint/i);
  });

  it('declares the owner and list indexes', async () => {
    expect(await indexNames(ds, 'todo_lists')).toEqual([
      'idx_todo_lists_organization_id',
      'idx_todo_lists_user_id',
      'PRIMARY',
    ]);
    expect(await indexNames(ds, 'todo_items')).toEqual(['idx_todo_items_list_id', 'PRIMARY']);
  });
});
