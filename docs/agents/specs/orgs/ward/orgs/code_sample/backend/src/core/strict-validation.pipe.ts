import { createParamDecorator, ExecutionContext, Injectable, ValidationPipe } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Validation pipe that rejects (400) unknown body fields instead of stripping
 * them: `whitelist` + `forbidNonWhitelisted` + `transform`. Bound only to
 * `@StrictBody()` parameters (`validateCustomDecorators` lets it validate them);
 * the global pipe in `main.ts` stays unchanged and skips custom parameters.
 */
@Injectable()
export class StrictValidationPipe extends ValidationPipe {
  /**
   * Builds the pipe with the strict options.
   */
  constructor() {
    super({ whitelist: true, forbidNonWhitelisted: true, transform: true, validateCustomDecorators: true });
  }
}

/**
 * Reads the raw request body, for the `@StrictBody()` decorator.
 * @param {unknown} _data - Unused; required by `createParamDecorator`'s signature.
 * @param {ExecutionContext} context - The current execution context.
 * @returns {unknown} The request body.
 */
export const getRequestBody = (_data: unknown, context: ExecutionContext): unknown =>
  context.switchToHttp().getRequest<Request>().body;

const RequestBody = createParamDecorator(getRequestBody);

/**
 * Parameter decorator injecting the request body validated by
 * {@link StrictValidationPipe} against the parameter's DTO type: unknown fields
 * answer 400. Owner-scoped and organization handlers use it instead of `@Body()`.
 * @returns {ParameterDecorator} The parameter decorator.
 */
export const StrictBody = (): ParameterDecorator => RequestBody(new StrictValidationPipe());
