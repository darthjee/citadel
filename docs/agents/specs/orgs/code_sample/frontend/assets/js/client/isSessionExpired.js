import ApiError from './ApiError.js';

/**
 * Tell whether an error is a session-expiry rejection raised by the `ApiClient`.
 *
 * @description The `ApiClient` rejects with an {@link ApiError} marked `sessionExpired` after it
 * failed to recover from a `401` (clearing the session and opening the login modal). Consumers
 * use this check — not `status === 401` — to skip showing such an error, since a `401` from an
 * opted-out public route is a real credential error that must still be displayed.
 * @param {*} error - The caught value.
 * @returns {boolean} `true` only for an `ApiError` whose `sessionExpired` flag is `true`.
 */
export function isSessionExpired(error) {
  return error instanceof ApiError && error.sessionExpired === true;
}

export default isSessionExpired;
