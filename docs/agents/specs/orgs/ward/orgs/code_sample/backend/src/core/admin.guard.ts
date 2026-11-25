import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_ADMIN_ONLY_KEY } from './admin-only.decorator.js';
import { readBooleanMetadata } from './boolean-metadata.js';

/**
 * Global guard enforcing `@AdminOnly()`-annotated routes, independent of
 * any feature module (per the issue's "Core" module classification). Reads
 * the `isAdmin` claim off `request.user`, already populated by `JwtGuard` —
 * this guard never re-verifies the JWT itself, so it must be registered as
 * an `APP_GUARD` *after* `JwtGuard` in `AppModule`. Routes without
 * `@AdminOnly()` metadata are unaffected (no-op).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  private readonly reflector: Reflector;

  /**
   * @param {Reflector} reflector - Reads the `@AdminOnly()` route metadata.
   */
  constructor(reflector: Reflector) {
    this.reflector = reflector;
  }

  /**
   * Allows non-admin-only routes through unconditionally; for
   * `@AdminOnly()` routes, requires `request.user.isAdmin === true`.
   * @param {ExecutionContext} context - The current request's execution context.
   * @returns {boolean} Whether the request may proceed.
   */
  canActivate(context: ExecutionContext): boolean {
    if (!readBooleanMetadata(this.reflector, IS_ADMIN_ONLY_KEY, context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    if (request.user?.isAdmin !== true) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
