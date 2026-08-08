import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RequestContextService } from './request-context.service.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK = new Map<LogLevel, number>([
  ['debug', 0],
  ['info', 1],
  ['warn', 2],
  ['error', 3],
]);

/**
 * Console transport per level. Each entry resolves `console.<level>` at call
 * time (rather than binding it once at module load) so test spies installed
 * after import still intercept the call.
 */
const CONSOLE_WRITERS = new Map<LogLevel, (...args: unknown[]) => void>([
  // eslint-disable-next-line no-console
  ['debug', (...args) => console.debug(...args)],
  // eslint-disable-next-line no-console
  ['info', (...args) => console.info(...args)],
  // eslint-disable-next-line no-console
  ['warn', (...args) => console.warn(...args)],
  // eslint-disable-next-line no-console
  ['error', (...args) => console.error(...args)],
]);

/**
 * Core-layer, constructor-injectable logging service with level filtering and
 * structured attributes, backed by a console transport. The configured
 * threshold is read once from `CITADEL_PLACEHOLDER_LOG_LEVEL` (defaulting to `info`), and
 * a message is only emitted when its level's rank is at or above that
 * threshold's rank (mirrors scylla's `BaseLogger#shouldLog`).
 *
 * Also implements NestJS's `LoggerService` interface so this service could
 * later be handed to `app.useLogger()` if a future change wants Nest's own
 * internal framework logging redirected through it too.
 */
@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly threshold: LogLevel;
  private readonly requestContext: RequestContextService;

  /**
   * @param {ConfigService} configService - Supplies the configured log level threshold.
   * @param {RequestContextService} requestContext - Supplies the active request's
   *   correlation id, merged into every emitted line when a request context is active.
   */
  constructor(configService: ConfigService, requestContext: RequestContextService) {
    this.threshold = configService.get<LogLevel>('CITADEL_PLACEHOLDER_LOG_LEVEL', 'info');
    this.requestContext = requestContext;
  }

  /**
   * Logs a message at the `debug` level.
   * @param {string} message - The message to log.
   * @param {Record<string, unknown>} [attributes] - Structured attributes accompanying the message.
   * @returns {void}
   */
  debug(message: string, attributes?: Record<string, unknown>): void {
    this.write('debug', message, attributes);
  }

  /**
   * Logs a message at the `info` level.
   * @param {string} message - The message to log.
   * @param {Record<string, unknown>} [attributes] - Structured attributes accompanying the message.
   * @returns {void}
   */
  info(message: string, attributes?: Record<string, unknown>): void {
    this.write('info', message, attributes);
  }

  /**
   * Logs a message at the `warn` level.
   * @param {string} message - The message to log.
   * @param {Record<string, unknown>} [attributes] - Structured attributes accompanying the message.
   * @returns {void}
   */
  warn(message: string, attributes?: Record<string, unknown>): void {
    this.write('warn', message, attributes);
  }

  /**
   * Logs a message at the `error` level.
   * @param {string} message - The message to log.
   * @param {Record<string, unknown>} [attributes] - Structured attributes accompanying the message.
   * @returns {void}
   */
  error(message: string, attributes?: Record<string, unknown>): void {
    this.write('error', message, attributes);
  }

  /**
   * NestJS `LoggerService` interface method. Routes to the `info` level.
   * @param {unknown} message - The message to log.
   * @param {...unknown[]} optionalParams - Additional arguments Nest's framework logger may pass.
   * @returns {void}
   */
  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', String(message), this.toAttributes(optionalParams));
  }

  /**
   * NestJS `LoggerService` interface method. Routes to the `debug` level, used
   * as a stand-in for Nest's optional `verbose` tier since scylla's level map
   * has no equivalent.
   * @param {unknown} message - The message to log.
   * @param {...unknown[]} optionalParams - Additional arguments Nest's framework logger may pass.
   * @returns {void}
   */
  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', String(message), this.toAttributes(optionalParams));
  }

  /**
   * Converts Nest's `LoggerService` variadic `optionalParams` into a single
   * attributes object, when present.
   * @param {unknown[]} optionalParams - Additional arguments Nest's framework logger may pass.
   * @returns {Record<string, unknown>|undefined} The attributes object, or `undefined` when empty.
   */
  private toAttributes(optionalParams: unknown[]): Record<string, unknown> | undefined {
    if (optionalParams.length === 0) {
      return undefined;
    }

    return { optionalParams };
  }

  /**
   * Emits a message through the console transport when its level is at or
   * above the configured threshold. When a request context is active, the
   * context's `requestId` is merged into the emitted attributes (caller-supplied
   * keys win on collision).
   * @param {LogLevel} level - The level to log at.
   * @param {string} message - The message to log.
   * @param {Record<string, unknown>} [attributes] - Structured attributes accompanying the message.
   * @returns {void}
   */
  private write(level: LogLevel, message: string, attributes?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const effective = this.resolveAttributes(attributes);
    const writer = CONSOLE_WRITERS.get(level)!;

    if (effective === undefined) {
      writer(message);
      return;
    }

    writer(message, effective);
  }

  /**
   * Merges the active request context's `requestId` into the caller-supplied
   * attributes, with caller keys winning on collision. Returns `undefined`
   * only when no request context is active and no attributes were supplied,
   * preserving the single-argument `console` call.
   * @param {Record<string, unknown>} [attributes] - Structured attributes accompanying the message.
   * @returns {Record<string, unknown>|undefined} The effective attributes, or `undefined`.
   */
  private resolveAttributes(
    attributes?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    const requestId = this.requestContext.getRequestId();

    if (requestId === undefined) {
      return attributes;
    }

    return { requestId, ...attributes };
  }

  /**
   * Determines whether a message at the given level should be emitted, based
   * on the configured threshold.
   * @param {LogLevel} level - The level to check.
   * @returns {boolean} `true` when the level's rank is at or above the threshold's rank.
   */
  private shouldLog(level: LogLevel): boolean {
    // An unrecognized threshold yields `undefined`, which compares as `false`
    // (nothing is emitted) — the same outcome as the former bracket lookup.
    return LEVEL_RANK.get(level)! >= LEVEL_RANK.get(this.threshold)!;
  }
}
