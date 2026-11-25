import { isSessionExpired } from '../../../../../client/isSessionExpired.js';

/** Message shown when deleting a list that still has items (`409 LIST_HAS_ITEMS`). */
export const LIST_HAS_ITEMS_MESSAGE = "Delete the list's items first";

const LIST_HAS_ITEMS = 'LIST_HAS_ITEMS';

const NO_OP = () => undefined;

const STATUS_OUTCOMES = new Map([
  [404, (outcomes) => outcomes.onNotFound],
  [403, (outcomes) => outcomes.onForbidden],
  [400, (outcomes) => outcomes.onValidation],
]);

/**
 * Pick the outcome callback matching an error.
 *
 * @param {Error & {status?: number, code?: string}} error - The error thrown by the client.
 * @param {object} outcomes - The outcome callbacks.
 * @returns {Function|undefined} The matching callback, if the caller supplied one.
 */
function outcomeFor(error, outcomes) {
  if (error.code === LIST_HAS_ITEMS) {
    return outcomes.onListHasItems;
  }

  return STATUS_OUTCOMES.get(error.status)?.(outcomes);
}

/**
 * Route a failed todo request to the matching outcome callback.
 *
 * @description A session-expired rejection calls `onSessionExpired` (when given) and nothing
 * else; a `404` calls `onNotFound`, a `403` `onForbidden`, a `400` `onValidation` and a `409
 * LIST_HAS_ITEMS` `onListHasItems`. Any other error — or a status whose callback was not
 * supplied — calls `onError`. Every callback receives the error.
 * @param {Error & {status?: number, code?: string}} error - The error thrown by the client.
 * @param {{onError: Function, onNotFound: (Function|undefined),
 *   onForbidden: (Function|undefined), onValidation: (Function|undefined),
 *   onListHasItems: (Function|undefined), onSessionExpired: (Function|undefined)}} outcomes -
 *   The outcome callbacks.
 * @returns {void} Nothing.
 */
export function dispatchTodoError(error, outcomes) {
  if (isSessionExpired(error)) {
    (outcomes.onSessionExpired ?? NO_OP)(error);
    return;
  }

  (outcomeFor(error, outcomes) ?? outcomes.onError)(error);
}

/**
 * Split a `400 VALIDATION_FAILED` error's `details` into per-field messages.
 *
 * @description The backend's validation messages start with the property name (e.g. `name must
 * be shorter than or equal to 255 characters`); a message starting with one of `fields` is
 * shown on that field, the others are returned as `rest`.
 * @param {string[]|undefined} details - The error's validation messages.
 * @param {string[]} fields - The form's field names.
 * @returns {{fieldErrors: object, rest: string[]}} The per-field messages (joined with `; `)
 *   and the messages matching no field.
 */
export function fieldErrorsFromDetails(details, fields) {
  const byField = new Map();
  const rest = [];

  (details ?? []).forEach((message) => {
    const field = fields.find((name) => String(message).startsWith(`${name} `));

    if (field) {
      byField.set(field, [...(byField.get(field) ?? []), message]);
    } else {
      rest.push(message);
    }
  });

  const fieldErrors = Object.fromEntries(
    [...byField.entries()].map(([field, messages]) => [field, messages.join('; ')]),
  );

  return { fieldErrors, rest };
}
