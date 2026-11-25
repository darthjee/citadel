import { Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { CreateTodoItemDto } from './dto/create-todo-item.dto.js';
import { TodoListNameDto } from './dto/todo-list-name.dto.js';
import { UpdateTodoItemDto } from './dto/update-todo-item.dto.js';
import {
  serializeTodoItem,
  serializeTodoList,
  serializeTodoListDetail,
  serializeTodoListSummary,
  type TodoItemResponse,
  type TodoListDetailResponse,
  type TodoListResponse,
  type TodoListSummaryResponse,
} from './todo-response.js';
import { TodoService } from './todo.service.js';
import { CurrentOwner } from '../core/current-owner.decorator.js';
import { MinOrgRole } from '../core/min-org-role.decorator.js';
import { OrgRole } from '../core/org-role.js';
import type { OwnerContext } from '../core/owner-context.js';
import { OwnerScopedController } from '../core/owner-scoped.decorator.js';
import { parseId } from '../core/parse-id.js';
import { StrictBody } from '../core/strict-validation.pipe.js';

/**
 * Todo routes, mounted under both `/todo/...` (personal) and
 * `/orgs/:orgId/todo/...` (organization) by `@OwnerScopedController('todo')`,
 * user-scoped, with writes invalidating the owner's `/todo` subtree. Thin:
 * each handler parses its ids, calls one `TodoService` method and serializes
 * the result through an allowlist serializer (entities are never returned).
 *
 * The status order is:
 * 1. the guard answers 404 (non-member or malformed `:orgId`), then 403 (role
 *    below the route's `@MinOrgRole`);
 * 2. the `@StrictBody()` pipe answers 400 (invalid body or unknown fields);
 * 3. the handler and service answer 404 (malformed `:id`/`:itemId`, or no such
 *    record under the owner), then 409 (`LIST_HAS_ITEMS`).
 *
 * None of the 403 or 400 depends on the record id, so this order leaks
 * nothing about other owners' records. There is no global-admin bypass, and
 * names and descriptions are never logged.
 */
@OwnerScopedController('todo')
export class TodoController {
  private readonly todoService: TodoService;

  /**
   * @param {TodoService} todoService - Todo lists and items.
   */
  constructor(todoService: TodoService) {
    this.todoService = todoService;
  }

  /**
   * `GET /todo/lists.json`. Lists the owner's lists with their item counts. Any member.
   * @param {OwnerContext} owner - The request's owner.
   * @returns {Promise<TodoListSummaryResponse[]>} The lists, ordered by id.
   */
  @Get('lists.json')
  async index(@CurrentOwner() owner: OwnerContext): Promise<TodoListSummaryResponse[]> {
    const lists = await this.todoService.listLists(owner);

    return lists.map(({ list, itemsCount }) => serializeTodoListSummary(list, itemsCount));
  }

  /**
   * `POST /todo/lists.json`. Creates a list. Needs `admin`.
   * @param {OwnerContext} owner - The request's owner.
   * @param {TodoListNameDto} dto - The list's name (only field accepted).
   * @returns {Promise<TodoListResponse>} The created list.
   */
  @Post('lists.json')
  @MinOrgRole(OrgRole.ADMIN)
  async create(@CurrentOwner() owner: OwnerContext, @StrictBody() dto: TodoListNameDto): Promise<TodoListResponse> {
    return serializeTodoList(await this.todoService.createList(owner, dto.name));
  }

  /**
   * `GET /todo/lists/:id.json`. Shows a list with its items. Any member.
   * @param {OwnerContext} owner - The request's owner.
   * @param {string} rawId - The raw `:id` route parameter.
   * @returns {Promise<TodoListDetailResponse>} The list and its items, ordered by id.
   */
  @Get('lists/:id.json')
  async show(@CurrentOwner() owner: OwnerContext, @Param('id') rawId: string): Promise<TodoListDetailResponse> {
    const { list, items } = await this.todoService.showList(owner, parseId(rawId));

    return serializeTodoListDetail(list, items);
  }

  /**
   * `PATCH /todo/lists/:id.json`. Renames a list. Needs `admin`.
   * @param {OwnerContext} owner - The request's owner.
   * @param {string} rawId - The raw `:id` route parameter.
   * @param {TodoListNameDto} dto - The new name (only field accepted).
   * @returns {Promise<TodoListResponse>} The renamed list.
   */
  @Patch('lists/:id.json')
  @MinOrgRole(OrgRole.ADMIN)
  async rename(
    @CurrentOwner() owner: OwnerContext,
      @Param('id') rawId: string,
      @StrictBody() dto: TodoListNameDto,
  ): Promise<TodoListResponse> {
    return serializeTodoList(await this.todoService.renameList(owner, parseId(rawId), dto.name));
  }

  /**
   * `DELETE /todo/lists/:id.json`. Deletes an empty list (409 `LIST_HAS_ITEMS` otherwise). Needs `admin`.
   * @param {OwnerContext} owner - The request's owner.
   * @param {string} rawId - The raw `:id` route parameter.
   * @returns {Promise<void>} No body (204).
   */
  @Delete('lists/:id.json')
  @MinOrgRole(OrgRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async destroy(@CurrentOwner() owner: OwnerContext, @Param('id') rawId: string): Promise<void> {
    await this.todoService.deleteList(owner, parseId(rawId));
  }

  /**
   * `POST /todo/lists/:id/items.json`. Adds an item to a list. Needs `user`.
   * @param {OwnerContext} owner - The request's owner.
   * @param {string} rawId - The raw `:id` route parameter.
   * @param {CreateTodoItemDto} dto - The description and optional `done`.
   * @returns {Promise<TodoItemResponse>} The created item.
   */
  @Post('lists/:id/items.json')
  @MinOrgRole(OrgRole.USER)
  async createItem(
    @CurrentOwner() owner: OwnerContext,
      @Param('id') rawId: string,
      @StrictBody() dto: CreateTodoItemDto,
  ): Promise<TodoItemResponse> {
    return serializeTodoItem(await this.todoService.createItem(owner, parseId(rawId), dto));
  }

  /**
   * `PATCH /todo/lists/:id/items/:itemId.json`. Updates an item's description and/or `done`. Needs `user`.
   * @param {OwnerContext} owner - The request's owner.
   * @param {string} rawId - The raw `:id` route parameter.
   * @param {string} rawItemId - The raw `:itemId` route parameter.
   * @param {UpdateTodoItemDto} dto - The changes (at least one field).
   * @returns {Promise<TodoItemResponse>} The updated item.
   */
  @Patch('lists/:id/items/:itemId.json')
  @MinOrgRole(OrgRole.USER)
  async updateItem(
    @CurrentOwner() owner: OwnerContext,
      @Param('id') rawId: string,
      @Param('itemId') rawItemId: string,
      @StrictBody() dto: UpdateTodoItemDto,
  ): Promise<TodoItemResponse> {
    return serializeTodoItem(await this.todoService.updateItem(owner, parseId(rawId), parseId(rawItemId), dto));
  }

  /**
   * `DELETE /todo/lists/:id/items/:itemId.json`. Deletes an item. Needs `admin`.
   * @param {OwnerContext} owner - The request's owner.
   * @param {string} rawId - The raw `:id` route parameter.
   * @param {string} rawItemId - The raw `:itemId` route parameter.
   * @returns {Promise<void>} No body (204).
   */
  @Delete('lists/:id/items/:itemId.json')
  @MinOrgRole(OrgRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async destroyItem(
    @CurrentOwner() owner: OwnerContext,
      @Param('id') rawId: string,
      @Param('itemId') rawItemId: string,
  ): Promise<void> {
    await this.todoService.deleteItem(owner, parseId(rawId), parseId(rawItemId));
  }
}
