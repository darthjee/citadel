import { LoggerService } from './logger.service.js';

/**
 * Explicit attribute-binding wrapper around `LoggerService`, mirroring
 * scylla's `LogContext`. Constructed ad hoc (not an `@Injectable()` provider):
 * `new LogContext(logger, { userId })`. Every `debug/info/warn/error` call
 * forwards to the wrapped logger with the bound attributes merged in;
 * per-call attributes win on key collision.
 *
 * This is the manual binding path. It composes with the context-aware
 * `LoggerService`: a `LogContext` used inside a request gets both its bound
 * attributes and the active request's `requestId`.
 */
export class LogContext {
  private readonly logger: LoggerService;
  private readonly boundAttributes: Record<string, unknown>;

  /**
   * @param {LoggerService} logger - The logger every call is forwarded to.
   * @param {Record<string, unknown>} attributes - Attributes bound to every call;
   *   stored as a defensive shallow copy.
   */
  constructor(logger: LoggerService, attributes: Record<string, unknown>) {
    this.logger = logger;
    this.boundAttributes = { ...attributes };
  }

  /**
   * Logs a message at the `debug` level with the bound attributes merged in.
   * @param {string} message - The message to log.
   * @param {Record<string, unknown>} [attributes] - Per-call attributes; win on key collision.
   * @returns {void}
   */
  debug(message: string, attributes?: Record<string, unknown>): void {
    this.logger.debug(message, this.merge(attributes));
  }

  /**
   * Logs a message at the `info` level with the bound attributes merged in.
   * @param {string} message - The message to log.
   * @param {Record<string, unknown>} [attributes] - Per-call attributes; win on key collision.
   * @returns {void}
   */
  info(message: string, attributes?: Record<string, unknown>): void {
    this.logger.info(message, this.merge(attributes));
  }

  /**
   * Logs a message at the `warn` level with the bound attributes merged in.
   * @param {string} message - The message to log.
   * @param {Record<string, unknown>} [attributes] - Per-call attributes; win on key collision.
   * @returns {void}
   */
  warn(message: string, attributes?: Record<string, unknown>): void {
    this.logger.warn(message, this.merge(attributes));
  }

  /**
   * Logs a message at the `error` level with the bound attributes merged in.
   * @param {string} message - The message to log.
   * @param {Record<string, unknown>} [attributes] - Per-call attributes; win on key collision.
   * @returns {void}
   */
  error(message: string, attributes?: Record<string, unknown>): void {
    this.logger.error(message, this.merge(attributes));
  }

  /**
   * Merges the per-call attributes over the bound attributes.
   * @param {Record<string, unknown>} [attributes] - Per-call attributes; win on key collision.
   * @returns {Record<string, unknown>} The merged attributes object.
   */
  private merge(attributes?: Record<string, unknown>): Record<string, unknown> {
    return { ...this.boundAttributes, ...attributes };
  }
}
