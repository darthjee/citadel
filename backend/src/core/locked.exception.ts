import { HttpException } from '@nestjs/common';

// The installed `@nestjs/common` version's `HttpStatus` enum has no `LOCKED`
// member, so the status code is applied literally here.
export const HTTP_STATUS_LOCKED = 423;

/**
 * `423 Locked` — the target resource is temporarily locked (e.g. a
 * brute-force cool-off lockout). The global exception filter maps it to the
 * `LOCKED` category code.
 */
export class LockedException extends HttpException {
  /**
   * @param {string} message - Human-readable reason for the lock.
   */
  constructor(message: string) {
    super(message, HTTP_STATUS_LOCKED);
  }
}
