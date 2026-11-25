import ApiClient from './ApiClient.js';
import pickDefined from './pickDefined.js';
import { contextPath } from '../utils/context/ownerContext.js';

/**
 * Build the API path of a todo resource for an owner context.
 *
 * @param {object} context - The active owner context.
 * @param {string} path - The path under `/todo`, starting with `/`.
 * @returns {string} `/todo<path>` for Personal, `/orgs/<id>/todo<path>` for an organization.
 */
function todoPath(context, path) {
  return contextPath(context, `/todo${path}`);
}

/**
 * HTTP client for the example `todo` module (lists and items).
 *
 * @description Every method takes the active owner context, so the same call hits
 * `/todo/...` (Personal) or `/orgs/<id>/todo/...` (organization). Every method may resolve
 * `undefined` when the session turned out to be expired (see {@link ApiClient}); the delete
 * methods resolve `{}` on the backend's `204`.
 */
const TodoClient = {
  /**
   * List the lists of the context's owner.
   *
   * @param {object} context - The active owner context.
   * @returns {Promise<Array<object>|undefined>} The lists, with `items_count`, ordered by id.
   */
  async listLists(context) {
    return ApiClient.getJson(todoPath(context, '/lists.json'));
  },

  /**
   * Create a list.
   *
   * @param {object} context - The active owner context.
   * @param {string} name - The list name.
   * @returns {Promise<object|undefined>} The created list.
   */
  async createList(context, name) {
    return ApiClient.postJson(todoPath(context, '/lists.json'), { name });
  },

  /**
   * Fetch one list, with its items.
   *
   * @param {object} context - The active owner context.
   * @param {number|string} id - The list id.
   * @returns {Promise<object|undefined>} The list, with `items` ordered by id.
   */
  async showList(context, id) {
    return ApiClient.getJson(todoPath(context, `/lists/${id}.json`));
  },

  /**
   * Rename a list.
   *
   * @param {object} context - The active owner context.
   * @param {number|string} id - The list id.
   * @param {string} name - The new list name.
   * @returns {Promise<object|undefined>} The updated list.
   */
  async renameList(context, id, name) {
    return ApiClient.patchJson(todoPath(context, `/lists/${id}.json`), { name });
  },

  /**
   * Delete an (empty) list.
   *
   * @param {object} context - The active owner context.
   * @param {number|string} id - The list id.
   * @returns {Promise<object|undefined>} `{}` on the backend's `204`.
   */
  async deleteList(context, id) {
    return ApiClient.deleteJson(todoPath(context, `/lists/${id}.json`));
  },

  /**
   * Add an item to a list.
   *
   * @param {object} context - The active owner context.
   * @param {number|string} listId - The list id.
   * @param {{description: string, done: (boolean|undefined)}} fields - The item fields; `done`
   *   is only sent when defined.
   * @returns {Promise<object|undefined>} The created item.
   */
  async createItem(context, listId, { description, done }) {
    return ApiClient.postJson(
      todoPath(context, `/lists/${listId}/items.json`),
      pickDefined({ description, done }),
    );
  },

  /**
   * Update an item; only the defined fields are sent (`done: false` is kept).
   *
   * @param {object} context - The active owner context.
   * @param {number|string} listId - The list id.
   * @param {number|string} itemId - The item id.
   * @param {{description: (string|undefined), done: (boolean|undefined)}} changes - The changes.
   * @returns {Promise<object|undefined>} The updated item.
   */
  async updateItem(context, listId, itemId, { description, done }) {
    return ApiClient.patchJson(
      todoPath(context, `/lists/${listId}/items/${itemId}.json`),
      pickDefined({ description, done }),
    );
  },

  /**
   * Delete an item.
   *
   * @param {object} context - The active owner context.
   * @param {number|string} listId - The list id.
   * @param {number|string} itemId - The item id.
   * @returns {Promise<object|undefined>} `{}` on the backend's `204`.
   */
  async deleteItem(context, listId, itemId) {
    return ApiClient.deleteJson(todoPath(context, `/lists/${listId}/items/${itemId}.json`));
  },
};

export default TodoClient;
