import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

/**
 * The correlation data bound to a single in-flight request. Imported by the
 * context-aware `LoggerService`, the `LogContext` wrapper and
 * `RequestContextMiddleware`.
 */
export interface RequestContext {
  requestId: string;
}

/**
 * Core-layer, constructor-injectable wrapper around a single
 * `AsyncLocalStorage` instance holding per-request correlation data. Keeping
 * the `AsyncLocalStorage` global encapsulated in an `@Injectable()` provider
 * lets the rest of the codebase stay DI-only and never import
 * `node:async_hooks` directly (mirrors the `node:crypto` encapsulation in
 * `cache-token.service.ts`).
 *
 * `RequestContextMiddleware` opens a context with `run()` for the lifetime of
 * each request; `LoggerService` reads `getRequestId()` to correlate every log
 * line emitted while that context is active.
 */
@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  /**
   * Runs `callback` with a fresh request context bound for the duration of the
   * synchronous call and any async work it awaits.
   * @param {string} requestId - The correlation id to bind for this context.
   * @param {() => T} callback - The function to execute inside the context.
   * @returns {T} Whatever `callback` returns.
   */
  run<T>(requestId: string, callback: () => T): T {
    return this.storage.run({ requestId }, callback);
  }

  /**
   * Reads the correlation id bound to the currently active request context.
   * @returns {string | undefined} The bound `requestId`, or `undefined` when no context is active.
   */
  getRequestId(): string | undefined {
    return this.storage.getStore()?.requestId;
  }
}
