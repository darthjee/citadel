import TodoClient from '../../../../../client/TodoClient.js';
import { contextHash } from '../../../../../utils/context/ownerContext.js';
import { validateRequiredText } from '../../../../../utils/validation/fieldValidators.js';
import navigate from '../../../organizations/pages/controllers/navigation.js';
import { LIST_HAS_ITEMS_MESSAGE, dispatchTodoError } from './todoErrors.js';
import { appendItem, removeItem, replaceItem } from './todoItems.js';

/**
 * Ask the user to confirm, SSR-safe (without a `window`, nothing is confirmed).
 *
 * @param {string} message - The question to ask.
 * @returns {boolean} Whether the user confirmed.
 */
function windowConfirm(message) {
  return typeof window !== 'undefined' && window.confirm(message);
}

/**
 * Validate an item description.
 *
 * @param {string} description - The raw description.
 * @returns {string|null} The validation message, or `null` when valid.
 */
function descriptionError(description) {
  return validateRequiredText(description, 'description', 'Description').description ?? null;
}

/**
 * Controller for the todo list show page: list deletion and the item mutations.
 *
 * @description Item mutations update the loaded list from the API's response. A `404` reports
 * Not-found and a `403` Forbidden; a `409 LIST_HAS_ITEMS` shows "Delete the list's items first"
 * without leaving the page; any other failure shows its message. A session-expired rejection
 * shows nothing. Every action resets `pending` once done.
 */
export default class TodoListController {
  /**
   * Create a show-page controller.
   *
   * @param {object} options - Controller dependencies.
   * @param {Function} options.setList - React state setter for the loaded list.
   * @param {Function} options.setActionError - React state setter for the action error.
   * @param {Function} options.setPending - React state setter for the in-flight flag.
   * @param {Function} options.onNotFound - Called on a `404`.
   * @param {Function} options.onForbidden - Called on a `403`.
   * @param {Function} [options.navigate] - Navigation override, for testability.
   * @param {Function} [options.confirm] - Confirmation override, for testability.
   * @param {typeof TodoClient} [options.client] - HTTP client override, for testability.
   */
  constructor({
    setList, setActionError, setPending, onNotFound, onForbidden,
    navigate: navigateTo = navigate, confirm = windowConfirm, client = TodoClient,
  }) {
    this.setList = setList;
    this.setActionError = setActionError;
    this.setPending = setPending;
    this.onNotFound = onNotFound;
    this.onForbidden = onForbidden;
    this.navigate = navigateTo;
    this.confirm = confirm;
    this.client = client;
  }

  /**
   * Delete the list after confirmation, then go to the list index.
   *
   * @param {object} context - The active owner context.
   * @param {number} listId - The list id.
   * @returns {Promise<void>} Resolves once handled.
   */
  async deleteList(context, listId) {
    if (!this.confirm('Delete this list?')) {
      return;
    }

    const done = await this.#run(() => this.client.deleteList(context, listId));

    if (done) {
      this.navigate(contextHash(context, '/todo/lists'));
    }
  }

  /**
   * Validate and add an item to the list.
   *
   * @param {object} context - The active owner context.
   * @param {number} listId - The list id.
   * @param {string} description - The raw description.
   * @returns {Promise<boolean>} Whether the item was added (so the form can be cleared).
   */
  async addItem(context, listId, description) {
    const item = await this.#runValidated(description, (trimmed) => this.client.createItem(
      context, listId, { description: trimmed },
    ));

    return this.#apply(item, (list) => appendItem(list, item));
  }

  /**
   * Flip an item's `done` flag.
   *
   * @param {object} context - The active owner context.
   * @param {number} listId - The list id.
   * @param {{id: number, done: boolean}} item - The item to toggle.
   * @returns {Promise<boolean>} Whether the item was updated.
   */
  async toggleItem(context, listId, item) {
    const updated = await this.#run(() => this.client.updateItem(
      context, listId, item.id, { done: !item.done },
    ));

    return this.#apply(updated, (list) => replaceItem(list, updated));
  }

  /**
   * Validate and save an item's new description.
   *
   * @param {object} context - The active owner context.
   * @param {number} listId - The list id.
   * @param {number} itemId - The item id.
   * @param {string} description - The raw description.
   * @returns {Promise<boolean>} Whether the item was updated (so the inline edit can close).
   */
  async saveDescription(context, listId, itemId, description) {
    const updated = await this.#runValidated(description, (trimmed) => this.client.updateItem(
      context, listId, itemId, { description: trimmed },
    ));

    return this.#apply(updated, (list) => replaceItem(list, updated));
  }

  /**
   * Delete an item after confirmation.
   *
   * @param {object} context - The active owner context.
   * @param {number} listId - The list id.
   * @param {number} itemId - The item id.
   * @returns {Promise<boolean>} Whether the item was deleted.
   */
  async deleteItem(context, listId, itemId) {
    if (!this.confirm('Delete this item?')) {
      return false;
    }

    const done = await this.#run(() => this.client.deleteItem(context, listId, itemId));

    return this.#apply(done, (list) => removeItem(list, itemId));
  }

  /**
   * Handle a failed request (see the class description).
   *
   * @param {Error & {status?: number, code?: string}} error - The error thrown by the client.
   * @returns {void} Nothing.
   */
  handleError(error) {
    dispatchTodoError(error, {
      onNotFound: () => this.onNotFound(),
      onForbidden: () => this.onForbidden(),
      onListHasItems: () => this.setActionError(LIST_HAS_ITEMS_MESSAGE),
      onError: (failure) => this.setActionError(failure.message),
    });
  }

  /**
   * Apply a successful mutation to the loaded list.
   *
   * @param {*} result - The mutation result; falsy when it failed.
   * @param {Function} update - Maps the loaded list to the updated one.
   * @returns {boolean} Whether the mutation succeeded.
   */
  #apply(result, update) {
    if (!result) {
      return false;
    }

    this.setList(update);
    return true;
  }

  /**
   * Validate a description, then run the request with its trimmed value.
   *
   * @param {string} description - The raw description.
   * @param {Function} request - Called with the trimmed description.
   * @returns {Promise<*>} The request's result, or `null` when invalid or failed.
   */
  async #runValidated(description, request) {
    const message = descriptionError(description);

    if (message) {
      this.setActionError(message);
      return null;
    }

    return this.#run(() => request(description.trim()));
  }

  /**
   * Run a request with `pending` set, reporting a failure.
   *
   * @param {Function} request - Performs the request.
   * @returns {Promise<*>} The request's result (`true` for an empty `204` answer), or `null`
   *   when it failed.
   */
  async #run(request) {
    this.setActionError(null);
    this.setPending(true);

    try {
      return (await request()) ?? true;
    } catch (error) {
      this.handleError(error);
      return null;
    } finally {
      this.setPending(false);
    }
  }
}
