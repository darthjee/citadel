import { createParamDecorator, ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import type { Request } from 'express';
import type { OwnerContext } from './owner-context.js';

/**
 * Reads the `OwnerContext` off the request, populated by `OwnerContextGuard`.
 * Exported separately from the `@CurrentOwner()` decorator so the unit spec can
 * call it directly. A missing context means the handler is not owner-scoped (a
 * programming error), so it fails loudly instead of returning `undefined`.
 * @param {unknown} _data - Unused; required by `createParamDecorator`'s signature.
 * @param {ExecutionContext} context - The current execution context.
 * @returns {OwnerContext} The resolved owner context.
 */
export const getCurrentOwner = (_data: unknown, context: ExecutionContext): OwnerContext => {
  const request = context.switchToHttp().getRequest<Request>();

  if (!request.ownerContext) {
    throw new InternalServerErrorException('Missing owner context');
  }

  return request.ownerContext;
};

/**
 * Param decorator injecting the request's `OwnerContext` into an owner-scoped
 * route handler (see `@OwnerScopedController()`).
 */
export const CurrentOwner = createParamDecorator(getCurrentOwner);
