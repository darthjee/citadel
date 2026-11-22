import ApiError from '../../assets/js/client/ApiError.js';

/**
 * Build the `ApiError` that `ApiClient` rejects with when the session could not be recovered.
 *
 * @returns {ApiError} A `401` `UNAUTHORIZED` error flagged `sessionExpired`.
 */
export default function sessionExpiredError() {
  const error = new ApiError(401, 'Unauthorized', 'UNAUTHORIZED');

  error.sessionExpired = true;

  return error;
}
