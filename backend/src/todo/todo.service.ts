import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { ErrorCodes } from '../core/error-codes.js';
import { type OwnerScope, ownerWhere } from '../core/owner-context.js';
import { ownerNotFound } from '../core/parse-id.js';
import { TodoItem } from './entities/todo-item.entity.js';
import { TodoList } from './entities/todo-list.entity.js';

// MySQL `ER_ROW_IS_REFERENCED_2`: deleting a parent row still referenced by a RESTRICT FK.
const MYSQL_ROW_IS_REFERENCED_ERRNO = 1451;
const MYSQL_ROW_IS_REFERENCED_CODE = 'ER_ROW_IS_REFERENCED_2';

/** A list together with its (owner-scoped) item count. */
export interface ListWithCount {
  list: TodoList;
  itemsCount: number;
}

/** A list together with its items, ordered by id. */
export interface ListWithItems {
  list: TodoList;
  items: TodoItem[];
}

/** The fields of a new item; `done` defaults to `false`. */
export interface NewItem {
  description: string;
  done?: boolean;
}

/** The requested changes to an item; at least one field must be present. */
export interface ItemChanges {
  description?: string;
  done?: boolean;
}

/**
 * Todo lists and items, owned by a user or an organization (see
 * `docs/agents/modules/todo.md`). Every method takes the request's owner and
 * scopes each lookup to it: a list is only found under `ownerWhere(owner)`, an
 * item only by its id **and** an owner-scoped list's id. Any miss (unknown,
 * foreign or wrong-context record) is the uniform owner-scoped 404. The owner
 * of a new list comes only from the owner scope, never from input. Roles are
 * not checked here (`@MinOrgRole` already did), and there is no global-admin
 * bypass. Names and descriptions are never logged.
 */
@Injectable()
export class TodoService {
  private readonly listRepository: Repository<TodoList>;
  private readonly itemRepository: Repository<TodoItem>;

  /**
   * @param {Repository<TodoList>} listRepository - The todo list repository.
   * @param {Repository<TodoItem>} itemRepository - The todo item repository.
   */
  constructor(
    @InjectRepository(TodoList) listRepository: Repository<TodoList>,
    @InjectRepository(TodoItem) itemRepository: Repository<TodoItem>,
  ) {
    this.listRepository = listRepository;
    this.itemRepository = itemRepository;
  }

  /**
   * Lists the owner's lists, ordered by id, each with its item count. Items are
   * only counted over the owner's own list ids, so another owner's items never
   * leak into a count.
   * @param {OwnerScope} owner - The data owner.
   * @returns {Promise<ListWithCount[]>} The owner's lists with their item counts.
   */
  async listLists(owner: OwnerScope): Promise<ListWithCount[]> {
    const lists = await this.listRepository.find({ where: ownerWhere(owner), order: { id: 'ASC' } });

    if (lists.length === 0) {
      return [];
    }

    const items = await this.itemRepository.find({
      where: { listId: In(lists.map((list) => list.id)) },
      select: { id: true, listId: true },
    });
    const counts = new Map<number, number>();

    items.forEach(({ listId }) => counts.set(listId, (counts.get(listId) ?? 0) + 1));

    return lists.map((list) => ({ list, itemsCount: counts.get(list.id) ?? 0 }));
  }

  /**
   * Creates a list owned by the given owner.
   * @param {OwnerScope} owner - The data owner (the only source of the list's owner columns).
   * @param {string} name - The validated, trimmed name.
   * @returns {Promise<TodoList>} The new list.
   */
  async createList(owner: OwnerScope, name: string): Promise<TodoList> {
    const ownerColumns =
      owner.kind === 'user'
        ? { userId: owner.userId, organizationId: null }
        : { userId: null, organizationId: owner.organizationId };

    return this.listRepository.save(this.listRepository.create({ name, ...ownerColumns }));
  }

  /**
   * Shows one of the owner's lists with its items, ordered by id.
   * @param {OwnerScope} owner - The data owner.
   * @param {number} id - The list id.
   * @returns {Promise<ListWithItems>} The list and its items.
   * @throws {NotFoundException} The uniform 404 when the owner has no such list.
   */
  async showList(owner: OwnerScope, id: number): Promise<ListWithItems> {
    const list = await this.#findList(owner, id);
    const items = await this.itemRepository.find({ where: { listId: list.id }, order: { id: 'ASC' } });

    return { list, items };
  }

  /**
   * Renames one of the owner's lists.
   * @param {OwnerScope} owner - The data owner.
   * @param {number} id - The list id.
   * @param {string} name - The validated, trimmed name.
   * @returns {Promise<TodoList>} The renamed list.
   * @throws {NotFoundException} The uniform 404 when the owner has no such list.
   */
  async renameList(owner: OwnerScope, id: number, name: string): Promise<TodoList> {
    const list = await this.#findList(owner, id);

    list.name = name;

    return this.listRepository.save(list);
  }

  /**
   * Deletes one of the owner's lists, only when it has no items. The
   * owner-scoped lookup runs first, so another owner's non-empty list answers
   * 404, never 409. A concurrent item insert (the FK RESTRICT error) also maps
   * to the 409.
   * @param {OwnerScope} owner - The data owner.
   * @param {number} id - The list id.
   * @returns {Promise<void>} Resolves once the list is deleted.
   * @throws {NotFoundException} The uniform 404 when the owner has no such list.
   * @throws {ConflictException} `LIST_HAS_ITEMS` when the list still has items.
   */
  async deleteList(owner: OwnerScope, id: number): Promise<void> {
    const list = await this.#findList(owner, id);

    if ((await this.itemRepository.count({ where: { listId: list.id } })) > 0) {
      throw this.#listHasItems();
    }

    try {
      await this.listRepository.delete({ id: list.id });
    } catch (error) {
      throw this.#isRowReferencedError(error) ? this.#listHasItems() : error;
    }
  }

  /**
   * Adds an item to one of the owner's lists.
   * @param {OwnerScope} owner - The data owner.
   * @param {number} listId - The list id.
   * @param {NewItem} fields - The validated description and optional `done` (default `false`).
   * @returns {Promise<TodoItem>} The new item.
   * @throws {NotFoundException} The uniform 404 when the owner has no such list.
   */
  async createItem(owner: OwnerScope, listId: number, fields: NewItem): Promise<TodoItem> {
    const list = await this.#findList(owner, listId);

    return this.itemRepository.save(
      this.itemRepository.create({ listId: list.id, description: fields.description, done: fields.done ?? false }),
    );
  }

  /**
   * Updates an item of one of the owner's lists. Only the fields that are
   * present (`!== undefined`) are applied, so `{ done: false }` is a valid change.
   * @param {OwnerScope} owner - The data owner.
   * @param {number} listId - The list id.
   * @param {number} itemId - The item id.
   * @param {ItemChanges} changes - The validated changes.
   * @returns {Promise<TodoItem>} The updated item.
   * @throws {BadRequestException} `VALIDATION_FAILED` when no field is present.
   * @throws {NotFoundException} The uniform 404 when the owner has no such list or item.
   */
  async updateItem(owner: OwnerScope, listId: number, itemId: number, changes: ItemChanges): Promise<TodoItem> {
    if (changes.description === undefined && changes.done === undefined) {
      throw new BadRequestException({ message: ['at least one of description or done is required'] });
    }

    const item = await this.#findItem(owner, listId, itemId);

    if (changes.description !== undefined) {
      item.description = changes.description;
    }

    if (changes.done !== undefined) {
      item.done = changes.done;
    }

    return this.itemRepository.save(item);
  }

  /**
   * Deletes an item of one of the owner's lists.
   * @param {OwnerScope} owner - The data owner.
   * @param {number} listId - The list id.
   * @param {number} itemId - The item id.
   * @returns {Promise<void>} Resolves once the item is deleted.
   * @throws {NotFoundException} The uniform 404 when the owner has no such list or item.
   */
  async deleteItem(owner: OwnerScope, listId: number, itemId: number): Promise<void> {
    const item = await this.#findItem(owner, listId, itemId);

    await this.itemRepository.delete({ id: item.id, listId: item.listId });
  }

  async #findList(owner: OwnerScope, id: number): Promise<TodoList> {
    const list = await this.listRepository.findOne({ where: { id, ...ownerWhere(owner) } });

    if (!list) {
      throw ownerNotFound();
    }

    return list;
  }

  async #findItem(owner: OwnerScope, listId: number, itemId: number): Promise<TodoItem> {
    const list = await this.#findList(owner, listId);
    const item = await this.itemRepository.findOne({ where: { id: itemId, listId: list.id } });

    if (!item) {
      throw ownerNotFound();
    }

    return item;
  }

  #listHasItems(): ConflictException {
    return new ConflictException({ code: ErrorCodes.LIST_HAS_ITEMS, message: 'List has items' });
  }

  #isRowReferencedError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError: unknown = error.driverError;

    if (typeof driverError !== 'object' || driverError === null) {
      return false;
    }

    const { errno, code } = driverError as { errno?: unknown; code?: unknown };

    return errno === MYSQL_ROW_IS_REFERENCED_ERRNO || code === MYSQL_ROW_IS_REFERENCED_CODE;
  }
}
