import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { LoggerService } from './logger.service.js';
import { RequestContextService } from './request-context.service.js';

/**
 * Global Nest middleware that establishes the per-request correlation context
 * and emits the access-log line. It mints a v4 UUID `requestId`, runs the rest
 * of the request pipeline inside `RequestContextService.run()` so every
 * `LoggerService` call made while handling the request is correlated, and
 * registers a `res.on('finish')` listener that logs one `info` line per
 * completed response (including guard-rejected 401/403 responses, since Nest
 * middleware runs before guards).
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly requestContext: RequestContextService;
  private readonly logger: LoggerService;

  /**
   * @param {RequestContextService} requestContext - Opens the correlation context for the request.
   * @param {LoggerService} logger - Emits the per-request access-log line.
   */
  constructor(requestContext: RequestContextService, logger: LoggerService) {
    this.requestContext = requestContext;
    this.logger = logger;
  }

  /**
   * Mints a `requestId`, runs the remaining pipeline inside the correlation
   * context, and schedules the access-log line for when the response finishes.
   * @param {Request} req - The incoming request.
   * @param {Response} res - The outgoing response.
   * @param {NextFunction} next - Passes control to the next handler.
   * @returns {void}
   */
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = randomUUID();

    this.requestContext.run(requestId, () => {
      res.on('finish', () => {
        this.logger.info('request', {
          method: req.method,
          path: req.originalUrl.split('?')[0],
          statusCode: res.statusCode,
          requestId,
        });
      });

      next();
    });
  }
}
