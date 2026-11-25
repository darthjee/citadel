import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ErrorCodes } from '../error-codes.js';
import { HttpExceptionFilter } from '../http-exception.filter.js';
import { LoggerService } from '../logger.service.js';

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

interface FakeResponse {
  status: jest.Mock;
  json: jest.Mock;
}

function fakeResponse(): FakeResponse {
  const response = { status: jest.fn(), json: jest.fn() };
  response.status.mockReturnValue(response);
  return response;
}

function hostFor(response: FakeResponse): ArgumentsHost {
  return { switchToHttp: () => ({ getResponse: () => response }) } as unknown as ArgumentsHost;
}

describe('HttpExceptionFilter', () => {
  let logger: { error: jest.Mock; debug: jest.Mock };
  let filter: HttpExceptionFilter;
  let response: FakeResponse;

  beforeEach(() => {
    logger = { error: jest.fn(), debug: jest.fn() };
    filter = new HttpExceptionFilter(logger as unknown as LoggerService);
    response = fakeResponse();
  });

  function catchAndGetBody(exception: unknown): Record<string, unknown> {
    filter.catch(exception, hostFor(response));
    return response.json.mock.calls[0][0] as Record<string, unknown>;
  }

  describe('with a plain string HttpException', () => {
    it('uses the string as message and the category code', () => {
      const body = catchAndGetBody(new HttpException('Something broke', 400));

      expect(response.status).toHaveBeenCalledWith(400);
      expect(body).toEqual({
        error: { code: ErrorCodes.BAD_REQUEST, message: 'Something broke' },
        statusCode: 400,
        timestamp: expect.stringMatching(ISO_TIMESTAMP),
      });
    });
  });

  describe('with a built-in exception given a string message', () => {
    it('uses its message and the category code', () => {
      const body = catchAndGetBody(new UnauthorizedException('Invalid username or password'));

      expect(response.status).toHaveBeenCalledWith(401);
      expect(body.error).toEqual({ code: ErrorCodes.UNAUTHORIZED, message: 'Invalid username or password' });
      expect(body.statusCode).toBe(401);
    });
  });

  describe('with an object response carrying a specific code', () => {
    it('uses the specific code', () => {
      const body = catchAndGetBody(
        new ConflictException({ code: ErrorCodes.USERNAME_TAKEN, message: 'username is not available' }),
      );

      expect(response.status).toHaveBeenCalledWith(409);
      expect(body.error).toEqual({ code: ErrorCodes.USERNAME_TAKEN, message: 'username is not available' });
    });
  });

  describe('with an object response without a string message', () => {
    it('falls back to the exception message', () => {
      const body = catchAndGetBody(new HttpException({ other: 'x' }, 400));

      expect(body.error).toEqual({ code: ErrorCodes.BAD_REQUEST, message: 'Http Exception' });
    });
  });

  describe('with a ValidationPipe-shaped array message', () => {
    it('joins the messages and exposes them as details', () => {
      const messages = ['username must be a string', 'password should not be empty'];
      const body = catchAndGetBody(new BadRequestException(messages));

      expect(response.status).toHaveBeenCalledWith(400);
      expect(body.error).toEqual({
        code: ErrorCodes.VALIDATION_FAILED,
        message: 'username must be a string; password should not be empty',
        details: messages,
      });
    });
  });

  describe('category codes', () => {
    it.each([
      [new BadRequestException('x'), 400, ErrorCodes.BAD_REQUEST],
      [new UnauthorizedException('x'), 401, ErrorCodes.UNAUTHORIZED],
      [new ForbiddenException('x'), 403, ErrorCodes.FORBIDDEN],
      [new NotFoundException('x'), 404, ErrorCodes.NOT_FOUND],
      [new ConflictException('x'), 409, ErrorCodes.CONFLICT],
      [new HttpException('x', 423), 423, ErrorCodes.LOCKED],
      [new HttpException('x', 429), 429, ErrorCodes.TOO_MANY_REQUESTS],
      [new HttpException('x', 500), 500, ErrorCodes.INTERNAL_ERROR],
    ])('maps %p to status %i and code %s', (exception, status, code) => {
      const body = catchAndGetBody(exception);

      expect(response.status).toHaveBeenCalledWith(status);
      expect(body.error).toEqual({ code, message: 'x' });
      expect(body.statusCode).toBe(status);
    });

    it('maps an unknown status to HTTP_<status>', () => {
      const body = catchAndGetBody(new HttpException('teapot', 418));

      expect(response.status).toHaveBeenCalledWith(418);
      expect(body.error).toEqual({ code: 'HTTP_418', message: 'teapot' });
    });
  });

  describe('with a non-HTTP error', () => {
    it('responds 500 with a generic message and logs the real error', () => {
      const error = new Error('db password is hunter2');
      const body = catchAndGetBody(error);

      expect(response.status).toHaveBeenCalledWith(500);
      expect(body).toEqual({
        error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Internal server error' },
        statusCode: 500,
        timestamp: expect.stringMatching(ISO_TIMESTAMP),
      });
      expect(JSON.stringify(body)).not.toContain('hunter2');
      expect(logger.error).toHaveBeenCalledWith('unhandled exception', {
        error: 'db password is hunter2',
        name: 'Error',
        stack: error.stack,
      });
    });

    it('handles a thrown non-Error value', () => {
      const body = catchAndGetBody('boom');

      expect(response.status).toHaveBeenCalledWith(500);
      expect(body.error).toEqual({ code: ErrorCodes.INTERNAL_ERROR, message: 'Internal server error' });
      expect(logger.error).toHaveBeenCalledWith('unhandled exception', {
        error: 'boom',
        name: 'string',
        stack: undefined,
      });
    });
  });

  describe('with an http-errors-style client error (e.g. from body-parser)', () => {
    function parserError(message: string, fields: Record<string, unknown>): Error {
      return Object.assign(new Error(message), { expose: true, type: 'entity.too.large' }, fields);
    }

    it('keeps a statusCode-keyed 4xx status with a generic message and no error log', () => {
      const body = catchAndGetBody(parserError('request entity too large: limit 102400', { statusCode: 413 }));

      expect(response.status).toHaveBeenCalledWith(413);
      expect(body).toEqual({
        error: { code: 'HTTP_413', message: 'Payload Too Large' },
        statusCode: 413,
        timestamp: expect.stringMatching(ISO_TIMESTAMP),
      });
      expect(JSON.stringify(body)).not.toContain('limit');
      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('client error', { status: 413, name: 'Error' });
    });

    it('keeps a status-keyed 4xx status with its category code', () => {
      const body = catchAndGetBody(parserError('request aborted', { status: 400 }));

      expect(response.status).toHaveBeenCalledWith(400);
      expect(body.error).toEqual({ code: ErrorCodes.BAD_REQUEST, message: 'Bad Request' });
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('prefers statusCode over status', () => {
      const body = catchAndGetBody(parserError('unsupported charset', { statusCode: 415, status: 400 }));

      expect(response.status).toHaveBeenCalledWith(415);
      expect(body.error).toEqual({ code: 'HTTP_415', message: 'Unsupported Media Type' });
    });

    it('falls back to HTTP <status> for a 4xx with no standard reason phrase', () => {
      const body = catchAndGetBody({ statusCode: 499 });

      expect(response.status).toHaveBeenCalledWith(499);
      expect(body.error).toEqual({ code: 'HTTP_499', message: 'HTTP 499' });
      expect(logger.debug).toHaveBeenCalledWith('client error', { status: 499, name: 'object' });
    });

    it.each([
      ['a 5xx statusCode', { statusCode: 503 }],
      ['a non-numeric status', { status: '413' }],
      ['a sub-400 status', { statusCode: 302 }],
      ['null', null],
    ])('treats %s as an unexpected 500', (_label, exception) => {
      const body = catchAndGetBody(exception);

      expect(response.status).toHaveBeenCalledWith(500);
      expect(body.error).toEqual({ code: ErrorCodes.INTERNAL_ERROR, message: 'Internal server error' });
      expect(logger.error).toHaveBeenCalled();
      expect(logger.debug).not.toHaveBeenCalled();
    });
  });
});
