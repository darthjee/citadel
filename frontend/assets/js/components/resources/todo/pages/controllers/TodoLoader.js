import TodoClient from '../../../../../client/TodoClient.js';
import { dispatchTodoError } from './todoErrors.js';

/**
 * Loads todo data (the list index, or one list with its items) for the todo pages.
 *
 * @description A `404` (uniform for unknown ids, another owner's list and a non-member
 * organization) reports Not-found, a `403` reports Forbidden; other failures report their
 * message. A session-expired rejection reports nothing. Answers arriving after `isActive()`
 * turned false are ignored.
 */
export default class TodoLoader {
  #client;

  /**
   * Create a loader.
   *
   * @param {typeof TodoClient} [client] - HTTP client override, for testability.
   */
  constructor(client = TodoClient) {
    this.#client = client;
  }

  /**
   * Fetch the lists of the context's owner.
   *
   * @param {object} context - The active owner context.
   * @param {{onLoaded: Function, onNotFound: Function, onForbidden: Function,
   *   onError: Function}} callbacks - Outcome callbacks (`onError` receives the message).
   * @param {Function} [isActive] - Liveness check; late answers are dropped once it is false.
   * @returns {Promise<void>} Resolves once the outcome is reported.
   */
  async loadLists(context, callbacks, isActive = () => true) {
    await this.#load(() => this.#client.listLists(context), callbacks, isActive);
  }

  /**
   * Fetch one list, with its items.
   *
   * @param {object} context - The active owner context.
   * @param {number} id - The list id.
   * @param {{onLoaded: Function, onNotFound: Function, onForbidden: Function,
   *   onError: Function}} callbacks - Outcome callbacks (`onError` receives the message).
   * @param {Function} [isActive] - Liveness check; late answers are dropped once it is false.
   * @returns {Promise<void>} Resolves once the outcome is reported.
   */
  async loadList(context, id, callbacks, isActive = () => true) {
    await this.#load(() => this.#client.showList(context, id), callbacks, isActive);
  }

  /**
   * Run a request and report its outcome.
   *
   * @param {Function} request - Performs the request; resolves the loaded data.
   * @param {object} callbacks - Outcome callbacks.
   * @param {Function} isActive - Liveness check.
   * @returns {Promise<void>} Resolves once the outcome is reported.
   */
  async #load(request, callbacks, isActive) {
    const {
      onLoaded, onNotFound, onForbidden, onError,
    } = callbacks;

    try {
      const data = await request();

      if (isActive()) {
        onLoaded(data);
      }
    } catch (error) {
      if (!isActive()) {
        return;
      }

      dispatchTodoError(error, {
        onNotFound: () => onNotFound(),
        onForbidden: () => onForbidden(),
        onError: (failure) => onError(failure.message),
      });
    }
  }
}

/**
 * Build the load-on-visit effect of a todo page. Exported so specs can run it without a React
 * renderer.
 *
 * @param {Function} load - Called as `load(isActive)`; starts the load.
 * @returns {Function} Effect callback, returning a cleanup that drops late answers.
 */
export function buildTodoLoadEffect(load) {
  return () => {
    let active = true;

    load(() => active);

    return () => {
      active = false;
    };
  };
}
