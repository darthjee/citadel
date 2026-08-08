import { STATUS_CODES } from 'node:http';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { categoryCodeFor, ErrorCodes, INTERNAL_ERROR_MESSAGE } from './error-codes.js';
import { LoggerService } from './logger.service.js';

/**
 * The `error` member of every error response body.
 */
export interface ErrorPayload {
  code: string;
  message: string;
  details?: string[];
}

/**
 * The JSON body written for every error response.
 */
export interface ErrorResponseBody {
  error: ErrorPayload;
  statusCode: number;
  timestamp: string;
}

/**
 * The object shape Nest's `HttpException#getResponse()` may return: the
 * built-in `{ message, error, statusCode }` body, the `ValidationPipe`
 * variant with an array `message`, or a throw-site object carrying a
 * specific `code`.
 */
interface HttpExceptionResponse {
  code?: unknown;
  message?: unknown;
}

/**
 * The fields read off an http-errors-style error (as raised by Express's
 * body-parser: `413` body too large, `415` unsupported charset/encoding,
 * `400` request aborted, ...), which carry their status as a numeric
 * `statusCode` and/or `status` instead of being an `HttpException`.
 */
interface StatusCarryingError {
  statusCode?: unknown;
  status?: unknown;
}

/**
 * Returns the 4xx status carried by an http-errors-style error, if any.
 * @param {unknown} exception - The thrown non-HTTP value.
 * @returns {number | undefined} The client-error status, or `undefined` when the value carries none.
 */
function clientErrorStatusOf(exception: unknown): number | undefined {
  if (typeof exception !== 'object' || exception === null) {
    return undefined;
  }

  const { statusCode, status } = exception as StatusCarryingError;
  const candidate = typeof statusCode === 'number' ? statusCode : status;

  return typeof candidate === 'number' && candidate >= 400 && candidate < 500 ? candidate : undefined;
}

/**
 * Global catch-all exception filter (registered via `APP_FILTER`) that
 * reshapes every error into the standard body
 * `{ error: { code, message, details? }, statusCode, timestamp }`.
 *
 * - `HttpException`s keep their status; `error.code` is the throw site's
 *   specific `code` when given, otherwise the status's category code
 *   (`VALIDATION_FAILED` for `ValidationPipe` failures, whose message list is
 *   also exposed as `details`).
 * - Non-`HttpException` errors carrying a numeric 4xx `statusCode`/`status`
 *   (http-errors style, e.g. body-parser's `413` for an oversized body) keep
 *   that status with its category code and the fixed standard reason phrase
 *   (never the raw parser text); they are logged at `debug` only, so
 *   anonymous clients cannot flood the error log with them.
 * - Any other error answers `500`/`INTERNAL_ERROR` with a generic message;
 *   the real error and stack are logged, never sent to the client.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger: LoggerService;

  /**
   * @param {LoggerService} logger - Logs unexpected (non-HTTP) errors and, at `debug`, client errors.
   */
  constructor(logger: LoggerService) {
    this.logger = logger;
  }

  /**
   * Writes the standard error body for the caught exception.
   * @param {unknown} exception - The thrown value.
   * @param {ArgumentsHost} host - Nest's execution context, used to reach the HTTP response.
   * @returns {void}
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, error } = this.resolve(exception);
    const body: ErrorResponseBody = { error, statusCode: status, timestamp: new Date().toISOString() };
    response.status(status).json(body);
  }

  /**
   * Resolves the response status and error payload for the caught exception.
   * @param {unknown} exception - The thrown value.
   * @returns {{ status: number, error: ErrorPayload }} The status and payload to answer with.
   */
  private resolve(exception: unknown): { status: number; error: ErrorPayload } {
    if (exception instanceof HttpException) {
      return { status: exception.getStatus(), error: this.buildHttpPayload(exception) };
    }

    const clientStatus = clientErrorStatusOf(exception);

    if (clientStatus !== undefined) {
      return { status: clientStatus, error: this.buildClientErrorPayload(exception, clientStatus) };
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, error: this.buildInternalPayload(exception) };
  }

  /**
   * Builds the error payload for an http-errors-style client error, logging
   * it at `debug` only (it is the client's fault, not an application failure).
   * @param {unknown} exception - The thrown status-carrying error.
   * @param {number} status - Its 4xx status.
   * @returns {ErrorPayload} The category code with the fixed standard reason phrase.
   */
  private buildClientErrorPayload(exception: unknown, status: number): ErrorPayload {
    this.logger.debug('client error', {
      status,
      name: exception instanceof Error ? exception.name : typeof exception,
    });

    return { code: categoryCodeFor(status), message: STATUS_CODES[status] ?? `HTTP ${status}` };
  }

  /**
   * Builds the error payload for an `HttpException`.
   * @param {HttpException} exception - The HTTP exception.
   * @returns {ErrorPayload} The payload, with specific or category code.
   */
  private buildHttpPayload(exception: HttpException): ErrorPayload {
    const status = exception.getStatus();
    const raw = exception.getResponse();

    if (typeof raw === 'string') {
      return { code: categoryCodeFor(status), message: raw };
    }

    const { code, message } = raw as HttpExceptionResponse;
    const specificCode = typeof code === 'string' ? code : undefined;

    if (Array.isArray(message)) {
      const details = message.map(String);
      return { code: specificCode ?? ErrorCodes.VALIDATION_FAILED, message: details.join('; '), details };
    }

    return {
      code: specificCode ?? categoryCodeFor(status),
      message: typeof message === 'string' ? message : exception.message,
    };
  }

  /**
   * Logs an unexpected error and builds the generic `500` payload.
   * @param {unknown} exception - The thrown non-HTTP value.
   * @returns {ErrorPayload} The generic internal-error payload (no leaked details).
   */
  private buildInternalPayload(exception: unknown): ErrorPayload {
    const isError = exception instanceof Error;
    this.logger.error('unhandled exception', {
      error: isError ? exception.message : String(exception),
      name: isError ? exception.name : typeof exception,
      stack: isError ? exception.stack : undefined,
    });

    return { code: ErrorCodes.INTERNAL_ERROR, message: INTERNAL_ERROR_MESSAGE };
  }
}
