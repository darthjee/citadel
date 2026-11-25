import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { AccessTokenPayload } from './access-token-payload.js';

/**
 * Reads the authenticated user off the request, populated by `JwtGuard`.
 * Exported separately from the `@CurrentUser()` decorator itself so the
 * unit spec can call it directly, without booting a full Nest pipeline.
 * On protected routes `JwtGuard` already guarantees `request.user` is set
 * before a handler runs, making the missing-user branch effectively
 * unreachable in practice — it is still handled explicitly here so a
 * caller never gets a silent `undefined` instead of a clear failure.
 * @param {unknown} _data - Unused; required by `createParamDecorator`'s signature.
 * @param {ExecutionContext} context - The current execution context.
 * @returns {AccessTokenPayload} The authenticated user's token payload.
 */
export const getCurrentUser = (_data: unknown, context: ExecutionContext): AccessTokenPayload => {
  const request = context.switchToHttp().getRequest<Request>();

  if (!request.user) {
    throw new UnauthorizedException('Missing authenticated user');
  }

  return request.user;
};

/**
 * Param decorator injecting the authenticated user (`AccessTokenPayload`)
 * into a route handler, replacing manual `request.user!` non-null
 * assertions. Throws `UnauthorizedException` if `JwtGuard` has not set
 * `request.user` on the request.
 */
export const CurrentUser = createParamDecorator(getCurrentUser);
