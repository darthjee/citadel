/**
 * Category and specific error codes carried in `error.code` of every error
 * response body (see `http-exception.filter.ts`). Category codes are derived
 * from the HTTP status when a throw site gives no specific code; specific
 * codes are attached at the throw site (e.g.
 * `new ConflictException({ code: ErrorCodes.USERNAME_TAKEN, message })`).
 */
export const ErrorCodes = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  LOCKED: 'LOCKED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  USERNAME_TAKEN: 'USERNAME_TAKEN',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
} as const;

// Message used for every unexpected (non-HTTP) error — the real message and
// stack are logged, never sent to the client.
export const INTERNAL_ERROR_MESSAGE = 'Internal server error';

const CATEGORY_CODES = new Map<number, string>([
  [400, ErrorCodes.BAD_REQUEST],
  [401, ErrorCodes.UNAUTHORIZED],
  [403, ErrorCodes.FORBIDDEN],
  [404, ErrorCodes.NOT_FOUND],
  [409, ErrorCodes.CONFLICT],
  [423, ErrorCodes.LOCKED],
  [429, ErrorCodes.TOO_MANY_REQUESTS],
  [500, ErrorCodes.INTERNAL_ERROR],
]);

/**
 * Maps an HTTP status to its category error code.
 * @param {number} status - The HTTP status code.
 * @returns {string} The category code, or `HTTP_<status>` for unmapped statuses.
 */
export function categoryCodeFor(status: number): string {
  return CATEGORY_CODES.get(status) ?? `HTTP_${status}`;
}
