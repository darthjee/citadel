import TodoClient from '../../../../../client/TodoClient.js';
import { contextHash } from '../../../../../utils/context/ownerContext.js';
import { validateRequiredText } from '../../../../../utils/validation/fieldValidators.js';
import navigate from '../../../organizations/pages/controllers/navigation.js';
import { dispatchTodoError, fieldErrorsFromDetails } from './todoErrors.js';

const FIELDS = ['name'];

/**
 * Submit flow of the todo list name forms (create and rename).
 *
 * @description Validates the name like the backend does (required, at most 255 characters once
 * trimmed), sets `pending` while the request runs, then goes to the list's show page. A `400`
 * shows the backend's validation messages on the name field; a `404` reports Not-found and a
 * `403` Forbidden; any other failure shows its message. A session-expired rejection only resets
 * `pending`.
 */
export default class TodoListFormController {
  /**
   * Create a form controller.
   *
   * @param {object} options - Controller dependencies.
   * @param {Function} options.setFieldErrors - React state setter for per-field errors.
   * @param {Function} options.setSubmitError - React state setter for the submit error.
   * @param {Function} options.setPending - React state setter for the in-flight flag.
   * @param {Function} options.onNotFound - Called on a `404`.
   * @param {Function} options.onForbidden - Called on a `403`.
   * @param {Function} [options.navigate] - Navigation override, for testability.
   * @param {typeof TodoClient} [options.client] - HTTP client override, for testability.
   */
  constructor({
    setFieldErrors, setSubmitError, setPending, onNotFound, onForbidden,
    navigate: navigateTo = navigate, client = TodoClient,
  }) {
    this.setFieldErrors = setFieldErrors;
    this.setSubmitError = setSubmitError;
    this.setPending = setPending;
    this.onNotFound = onNotFound;
    this.onForbidden = onForbidden;
    this.navigate = navigateTo;
    this.client = client;
  }

  /**
   * Validate and create a list, then go to its show page.
   *
   * @param {object} context - The active owner context.
   * @param {{name: string}} fields - Current form field values.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async handleCreate(context, { name }) {
    await this.#submit(context, name, (trimmed) => this.client.createList(context, trimmed));
  }

  /**
   * Validate and rename a list, then go back to its show page.
   *
   * @param {object} context - The active owner context.
   * @param {number} id - The list id.
   * @param {{name: string}} fields - Current form field values.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async handleRename(context, id, { name }) {
    await this.#submit(context, name, (trimmed) => this.client.renameList(context, id, trimmed));
  }

  /**
   * Handle a failed request (see the class description).
   *
   * @param {Error & {status?: number, details?: string[]}} error - The error thrown by the
   *   client.
   * @returns {void} Nothing.
   */
  handleSubmitError(error) {
    dispatchTodoError(error, {
      onNotFound: () => this.onNotFound(),
      onForbidden: () => this.onForbidden(),
      onValidation: (failure) => this.#showValidation(failure),
      onError: (failure) => this.#fail(failure.message),
      onSessionExpired: () => this.setPending(false),
    });
  }

  /**
   * Validate the name and run the request with the trimmed name.
   *
   * @param {object} context - The active owner context.
   * @param {string} name - The raw name field value.
   * @param {Function} request - Called with the trimmed name; resolves the list.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async #submit(context, name, request) {
    const errors = validateRequiredText(name, 'name', 'Name');

    this.setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    this.setSubmitError(null);
    this.setPending(true);

    try {
      const list = await request(name.trim());

      this.navigate(contextHash(context, `/todo/lists/${list.id}`));
    } catch (error) {
      this.handleSubmitError(error);
    }
  }

  /**
   * Show a `400`'s validation messages: on the name field when they name it, otherwise as the
   * submit error.
   *
   * @param {Error & {details?: string[]}} error - The validation error.
   * @returns {void} Nothing.
   */
  #showValidation(error) {
    const { fieldErrors, rest } = fieldErrorsFromDetails(error.details, FIELDS);
    const hasFieldErrors = Object.keys(fieldErrors).length > 0;

    this.setFieldErrors(fieldErrors);
    this.#fail(rest.length > 0 || !hasFieldErrors ? (rest.join('; ') || error.message) : null);
  }

  /**
   * Show a submit error and reset `pending`.
   *
   * @param {string|null} message - The message to show, or `null` for none.
   * @returns {void} Nothing.
   */
  #fail(message) {
    this.setSubmitError(message);
    this.setPending(false);
  }
}
