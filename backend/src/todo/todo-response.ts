import type { TodoItem } from './entities/todo-item.entity.js';
import type { TodoList } from './entities/todo-list.entity.js';

/** The public view of a list. Never carries `user_id`/`organization_id`. */
export interface TodoListResponse {
  id: number;
  name: string;
  created_at: Date;
  updated_at: Date;
}

/** The public view of a list in the index, with its item count. */
export interface TodoListSummaryResponse extends TodoListResponse {
  items_count: number;
}

/** The public view of an item. Never carries `list_id`. */
export interface TodoItemResponse {
  id: number;
  description: string;
  done: boolean;
  created_at: Date;
  updated_at: Date;
}

/** The public view of a list with its items. */
export interface TodoListDetailResponse extends TodoListResponse {
  items: TodoItemResponse[];
}

/**
 * Serializes a list into its public view (an allowlist: entities are never returned).
 * @param {TodoList} list - The list to serialize.
 * @returns {TodoListResponse} Exactly `{ id, name, created_at, updated_at }`.
 */
export function serializeTodoList(list: TodoList): TodoListResponse {
  return { id: list.id, name: list.name, created_at: list.createdAt, updated_at: list.updatedAt };
}

/**
 * Serializes a list with its item count, for the index.
 * @param {TodoList} list - The list to serialize.
 * @param {number} itemsCount - Its (owner-scoped) item count.
 * @returns {TodoListSummaryResponse} Exactly `{ id, name, items_count, created_at, updated_at }`.
 */
export function serializeTodoListSummary(list: TodoList, itemsCount: number): TodoListSummaryResponse {
  return {
    id: list.id,
    name: list.name,
    items_count: itemsCount,
    created_at: list.createdAt,
    updated_at: list.updatedAt,
  };
}

/**
 * Serializes an item into its public view (an allowlist: entities are never returned).
 * @param {TodoItem} item - The item to serialize.
 * @returns {TodoItemResponse} Exactly `{ id, description, done, created_at, updated_at }`.
 */
export function serializeTodoItem(item: TodoItem): TodoItemResponse {
  return {
    id: item.id,
    description: item.description,
    done: item.done,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

/**
 * Serializes a list with its items, for the show page.
 * @param {TodoList} list - The list to serialize.
 * @param {TodoItem[]} items - Its items, already ordered by id.
 * @returns {TodoListDetailResponse} Exactly `{ id, name, created_at, updated_at, items }`.
 */
export function serializeTodoListDetail(list: TodoList, items: TodoItem[]): TodoListDetailResponse {
  return { ...serializeTodoList(list), items: items.map(serializeTodoItem) };
}
