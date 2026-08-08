import type { NextFunction, Request, Response } from 'express';
import { RequestContextMiddleware } from '../request-context.middleware.js';
import { RequestContextService } from '../request-context.service.js';

/**
 * Builds a `LoggerService` double exposing `info` as a spy.
 * @returns {{ info: jest.Mock }} The logger double.
 */
function buildLogger(): { info: jest.Mock } {
  return { info: jest.fn() };
}

/**
 * Builds a `Response` double that records `finish` listeners and can replay
 * them via `emitFinish()`.
 * @param {number} statusCode - The status code the response reports.
 * @returns {Response & { emitFinish: () => void }} The response double.
 */
function buildResponse(statusCode: number): Response & { emitFinish: () => void } {
  const listeners: Array<() => void> = [];

  return {
    statusCode,
    on: (event: string, listener: () => void) => {
      if (event === 'finish') {
        listeners.push(listener);
      }
    },
    emitFinish: () => listeners.forEach((listener) => listener()),
  } as never;
}

describe('RequestContextMiddleware', () => {
  it('logs the access line with the minted requestId when the response finishes', () => {
    const logger = buildLogger();
    const middleware = new RequestContextMiddleware(new RequestContextService(), logger as never);
    const res = buildResponse(200);
    const next = jest.fn();

    middleware.use({ method: 'GET', originalUrl: '/health.json?token=x' } as Request, res, next as NextFunction);
    res.emitFinish();

    expect(next).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledTimes(1);
    const [message, attributes] = logger.info.mock.calls[0];
    expect(message).toBe('request');
    expect(attributes).toEqual({
      method: 'GET',
      path: '/health.json',
      statusCode: 200,
      requestId: expect.any(String),
    });
  });

  it('runs next() inside an active request context', () => {
    const requestContext = new RequestContextService();
    const middleware = new RequestContextMiddleware(requestContext, buildLogger() as never);
    let seenRequestId: string | undefined;

    middleware.use(
      { method: 'GET', originalUrl: '/ping.json' } as Request,
      buildResponse(200),
      (() => {
        seenRequestId = requestContext.getRequestId();
      }) as NextFunction,
    );

    expect(seenRequestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
