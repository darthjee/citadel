import ApiError from './ApiError.js';

/**
 * Tell whether an error is the rejection of a request whose session could not be recovered.
 *
 * @description Consumers use this instead of checking `status === 401`, since a `401` from a
 * public route is a real credential error that must still be shown.
 * @param {*} error - The caught value.
 * @returns {boolean} `true` only for an `ApiError` flagged `sessionExpired`.
 */
export function isSessionExpired(error) {
  return error instanceof ApiError && error.sessionExpired === true;
}

export default isSessionExpired;
