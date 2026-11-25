import type { TodoItem } from '../entities/todo-item.entity.js';
import type { TodoList } from '../entities/todo-list.entity.js';
import {
  serializeTodoItem,
  serializeTodoList,
  serializeTodoListDetail,
  serializeTodoListSummary,
} from '../todo-response.js';

const createdAt = new Date('2026-01-01T00:00:00.000Z');
const updatedAt = new Date('2026-01-02T00:00:00.000Z');
const LIST: TodoList = { id: 1, name: 'Chores', userId: 7, organizationId: null, createdAt, updatedAt };
const ITEM: TodoItem = { id: 2, listId: 1, description: 'Dishes', done: true, createdAt, updatedAt };

describe('todo serializers', () => {
  it('serializes a list to exactly its public keys', () => {
    const body = serializeTodoList(LIST);

    expect(Object.keys(body).sort()).toEqual(['created_at', 'id', 'name', 'updated_at']);
    expect(body).toEqual({ id: 1, name: 'Chores', created_at: createdAt, updated_at: updatedAt });
  });

  it('serializes a list summary with its item count', () => {
    const body = serializeTodoListSummary(LIST, 3);

    expect(Object.keys(body).sort()).toEqual(['created_at', 'id', 'items_count', 'name', 'updated_at']);
    expect(body.items_count).toBe(3);
  });

  it('serializes an item without its list_id', () => {
    const body = serializeTodoItem(ITEM);

    expect(Object.keys(body).sort()).toEqual(['created_at', 'description', 'done', 'id', 'updated_at']);
    expect(body).toEqual({ id: 2, description: 'Dishes', done: true, created_at: createdAt, updated_at: updatedAt });
  });

  it('serializes a list detail with its serialized items', () => {
    const body = serializeTodoListDetail(LIST, [ITEM]);

    expect(Object.keys(body).sort()).toEqual(['created_at', 'id', 'items', 'name', 'updated_at']);
    expect(body.items).toEqual([serializeTodoItem(ITEM)]);
  });
});
