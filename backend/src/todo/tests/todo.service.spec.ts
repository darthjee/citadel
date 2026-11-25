import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { In, IsNull, QueryFailedError, type Repository } from 'typeorm';
import { type OwnerScope } from '../../core/owner-context.js';
import type { TodoItem } from '../entities/todo-item.entity.js';
import type { TodoList } from '../entities/todo-list.entity.js';
import { TodoService } from '../todo.service.js';

const PERSONAL: OwnerScope = { kind: 'user', userId: 7 };
const ORGANIZATION: OwnerScope = { kind: 'organization', organizationId: 3 };
const PERSONAL_WHERE = { userId: 7, organizationId: IsNull() };
const ORGANIZATION_WHERE = { userId: IsNull(), organizationId: 3 };

function list(id: number, attrs: Partial<TodoList> = {}): TodoList {
  return { id, name: `List ${id}`, userId: 7, organizationId: null, createdAt: new Date(), updatedAt: new Date(), ...attrs };
}

function item(id: number, listId: number, attrs: Partial<TodoItem> = {}): TodoItem {
  return { id, listId, description: `Item ${id}`, done: false, createdAt: new Date(), updatedAt: new Date(), ...attrs };
}

function repoDouble() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    create: jest.fn((attrs: object) => ({ ...attrs })),
    save: jest.fn(async (entity: object) => ({ id: 1, ...entity })),
    delete: jest.fn(async () => ({ affected: 1 })),
  };
}

function rowIsReferencedError(driverError: object): QueryFailedError {
  return new QueryFailedError('DELETE', [], Object.assign(new Error('fk'), driverError));
}

describe('TodoService', () => {
  let lists: ReturnType<typeof repoDouble>;
  let items: ReturnType<typeof repoDouble>;
  let service: TodoService;

  beforeEach(() => {
    lists = repoDouble();
    items = repoDouble();
    service = new TodoService(lists as unknown as Repository<TodoList>, items as unknown as Repository<TodoItem>);
  });

  describe('listLists', () => {
    it('scopes the lists to the owner, ordered by id, and counts items only over those lists', async () => {
      lists.find.mockResolvedValue([list(1), list(2)]);
      items.find.mockResolvedValue([item(10, 1), item(11, 1), item(12, 2)]);

      const result = await service.listLists(PERSONAL);

      expect(lists.find).toHaveBeenCalledWith({ where: PERSONAL_WHERE, order: { id: 'ASC' } });
      expect(items.find).toHaveBeenCalledWith({ where: { listId: In([1, 2]) }, select: { id: true, listId: true } });
      expect(result.map(({ list: l, itemsCount }) => [l.id, itemsCount])).toEqual([[1, 2], [2, 1]]);
    });

    it('answers 0 for an empty list', async () => {
      lists.find.mockResolvedValue([list(1)]);
      items.find.mockResolvedValue([]);

      expect((await service.listLists(PERSONAL))[0].itemsCount).toBe(0);
    });

    it('skips the item query when the owner has no lists', async () => {
      lists.find.mockResolvedValue([]);

      expect(await service.listLists(ORGANIZATION)).toEqual([]);
      expect(lists.find).toHaveBeenCalledWith({ where: ORGANIZATION_WHERE, order: { id: 'ASC' } });
      expect(items.find).not.toHaveBeenCalled();
    });
  });

  describe('createList', () => {
    it('sets a personal owner from the context only', async () => {
      await service.createList(PERSONAL, 'Chores');

      expect(lists.create).toHaveBeenCalledWith({ name: 'Chores', userId: 7, organizationId: null });
    });

    it('sets an organization owner from the context only', async () => {
      await service.createList(ORGANIZATION, 'Chores');

      expect(lists.create).toHaveBeenCalledWith({ name: 'Chores', userId: null, organizationId: 3 });
    });
  });

  describe('showList', () => {
    it('looks the list up under the owner and loads its items ordered by id', async () => {
      lists.findOne.mockResolvedValue(list(4));
      items.find.mockResolvedValue([item(1, 4)]);

      const result = await service.showList(ORGANIZATION, 4);

      expect(lists.findOne).toHaveBeenCalledWith({ where: { id: 4, ...ORGANIZATION_WHERE } });
      expect(items.find).toHaveBeenCalledWith({ where: { listId: 4 }, order: { id: 'ASC' } });
      expect(result.items).toHaveLength(1);
    });

    it('answers the uniform 404 for a miss', async () => {
      lists.findOne.mockResolvedValue(null);

      await expect(service.showList(PERSONAL, 4)).rejects.toBeInstanceOf(NotFoundException);
      expect(items.find).not.toHaveBeenCalled();
    });
  });

  describe('renameList', () => {
    it('renames the owner-scoped list', async () => {
      lists.findOne.mockResolvedValue(list(4));

      await service.renameList(PERSONAL, 4, 'New');

      expect(lists.findOne).toHaveBeenCalledWith({ where: { id: 4, ...PERSONAL_WHERE } });
      expect(lists.save).toHaveBeenCalledWith(expect.objectContaining({ id: 4, name: 'New' }));
    });

    it('answers the uniform 404 for a miss, saving nothing', async () => {
      lists.findOne.mockResolvedValue(null);

      await expect(service.renameList(PERSONAL, 4, 'New')).rejects.toBeInstanceOf(NotFoundException);
      expect(lists.save).not.toHaveBeenCalled();
    });
  });

  describe('deleteList', () => {
    it('runs the owner-scoped lookup before the item count (404, never 409, for a foreign list)', async () => {
      lists.findOne.mockResolvedValue(null);
      items.count.mockResolvedValue(3);

      await expect(service.deleteList(PERSONAL, 4)).rejects.toBeInstanceOf(NotFoundException);
      expect(items.count).not.toHaveBeenCalled();
      expect(lists.delete).not.toHaveBeenCalled();
    });

    it('answers 409 LIST_HAS_ITEMS while the list has items', async () => {
      lists.findOne.mockResolvedValue(list(4));
      items.count.mockResolvedValue(1);

      const error = await service.deleteList(PERSONAL, 4).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual({ code: 'LIST_HAS_ITEMS', message: 'List has items' });
      expect(items.count).toHaveBeenCalledWith({ where: { listId: 4 } });
      expect(lists.delete).not.toHaveBeenCalled();
    });

    it('deletes an empty list by its id', async () => {
      lists.findOne.mockResolvedValue(list(4));
      items.count.mockResolvedValue(0);

      await service.deleteList(PERSONAL, 4);

      expect(lists.delete).toHaveBeenCalledWith({ id: 4 });
    });

    it.each([
      ['errno 1451', { errno: 1451 }],
      ['code ER_ROW_IS_REFERENCED_2', { code: 'ER_ROW_IS_REFERENCED_2' }],
    ])('maps the FK RESTRICT race (%s) to the same 409', async (_label, driverError) => {
      lists.findOne.mockResolvedValue(list(4));
      items.count.mockResolvedValue(0);
      lists.delete.mockRejectedValue(rowIsReferencedError(driverError));

      const error = await service.deleteList(PERSONAL, 4).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual(expect.objectContaining({ code: 'LIST_HAS_ITEMS' }));
    });

    it.each([
      ['another query failure', rowIsReferencedError({ errno: 1062, code: 'ER_DUP_ENTRY' })],
      ['a query failure without a driver error object', new QueryFailedError('DELETE', [], 'boom' as never)],
      ['a non-query error', new Error('boom')],
    ])('rethrows %s', async (_label, thrown) => {
      lists.findOne.mockResolvedValue(list(4));
      items.count.mockResolvedValue(0);
      lists.delete.mockRejectedValue(thrown);

      await expect(service.deleteList(PERSONAL, 4)).rejects.toBe(thrown);
    });
  });

  describe('createItem', () => {
    it('adds the item to the owner-scoped list, done defaulting to false', async () => {
      lists.findOne.mockResolvedValue(list(4));

      await service.createItem(PERSONAL, 4, { description: 'Milk' });

      expect(lists.findOne).toHaveBeenCalledWith({ where: { id: 4, ...PERSONAL_WHERE } });
      expect(items.create).toHaveBeenCalledWith({ listId: 4, description: 'Milk', done: false });
    });

    it('keeps an explicit done', async () => {
      lists.findOne.mockResolvedValue(list(4));

      await service.createItem(PERSONAL, 4, { description: 'Milk', done: true });

      expect(items.create).toHaveBeenCalledWith({ listId: 4, description: 'Milk', done: true });
    });

    it('answers the uniform 404 for a foreign list', async () => {
      lists.findOne.mockResolvedValue(null);

      await expect(service.createItem(PERSONAL, 4, { description: 'Milk' })).rejects.toBeInstanceOf(NotFoundException);
      expect(items.save).not.toHaveBeenCalled();
    });
  });

  describe('updateItem', () => {
    beforeEach(() => {
      lists.findOne.mockResolvedValue(list(4));
      items.findOne.mockResolvedValue(item(9, 4, { done: true }));
    });

    it('finds the item by id and the owner-scoped list id', async () => {
      await service.updateItem(ORGANIZATION, 4, 9, { done: false });

      expect(lists.findOne).toHaveBeenCalledWith({ where: { id: 4, ...ORGANIZATION_WHERE } });
      expect(items.findOne).toHaveBeenCalledWith({ where: { id: 9, listId: 4 } });
    });

    it('applies { done: false } alone', async () => {
      await service.updateItem(PERSONAL, 4, 9, { done: false });

      expect(items.save).toHaveBeenCalledWith(expect.objectContaining({ id: 9, done: false, description: 'Item 9' }));
    });

    it('applies a description alone', async () => {
      await service.updateItem(PERSONAL, 4, 9, { description: 'Eggs' });

      expect(items.save).toHaveBeenCalledWith(expect.objectContaining({ id: 9, done: true, description: 'Eggs' }));
    });

    it('answers 400 VALIDATION_FAILED when no field is present, before any lookup', async () => {
      const error = await service.updateItem(PERSONAL, 4, 9, {}).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toEqual({
        message: ['at least one of description or done is required'],
      });
      expect(lists.findOne).not.toHaveBeenCalled();
    });

    it('answers the uniform 404 for an item outside the list', async () => {
      items.findOne.mockResolvedValue(null);

      await expect(service.updateItem(PERSONAL, 4, 9, { done: true })).rejects.toBeInstanceOf(NotFoundException);
      expect(items.save).not.toHaveBeenCalled();
    });

    it('answers the uniform 404 for a foreign list, never looking the item up', async () => {
      lists.findOne.mockResolvedValue(null);

      await expect(service.updateItem(PERSONAL, 4, 9, { done: true })).rejects.toBeInstanceOf(NotFoundException);
      expect(items.findOne).not.toHaveBeenCalled();
    });
  });

  describe('deleteItem', () => {
    it('deletes the item by id and list id', async () => {
      lists.findOne.mockResolvedValue(list(4));
      items.findOne.mockResolvedValue(item(9, 4));

      await service.deleteItem(PERSONAL, 4, 9);

      expect(items.findOne).toHaveBeenCalledWith({ where: { id: 9, listId: 4 } });
      expect(items.delete).toHaveBeenCalledWith({ id: 9, listId: 4 });
    });

    it('answers the uniform 404 for a miss, deleting nothing', async () => {
      lists.findOne.mockResolvedValue(list(4));
      items.findOne.mockResolvedValue(null);

      await expect(service.deleteItem(PERSONAL, 4, 9)).rejects.toBeInstanceOf(NotFoundException);
      expect(items.delete).not.toHaveBeenCalled();
    });
  });
});
