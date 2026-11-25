import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { type Observable, tap } from 'rxjs';
import { type CacheInvalidation, INVALIDATION_KEY } from './cache-invalidation.decorator.js';

// Response header the Ward proxy reads (on a 2xx non-GET response) to recursively clear the
// listed cached path subtrees; the proxy always strips it. See `docs/agents/architecture/caching.md`.
export const CACHE_INVALIDATE_HEADER = 'X-Cache-Invalidate';

const READ_METHODS = new Set(['GET', 'HEAD']);

// Characters/sequences never allowed in an emitted path: query, fragment, scheme,
// backslash, NUL and percent-encoding.
const UNSAFE_PATH = /[?#\\%\0]|:\/\//;

/**
 * Global interceptor emitting `X-Cache-Invalidate` for every write (non-GET/HEAD) route that
 * declares an invalidation (`InvalidatesOwner()`, `InvalidatesPaths()`), listing the cached GET
 * path subtrees it changes. The header is set in a `tap` after the handler returns, so a thrown
 * exception (4xx/5xx) never carries it. Routes declaring `NoCacheInvalidation()` — or nothing
 * (the coverage spec keeps that from shipping) — are left untouched. Unsafe paths are dropped.
 */
@Injectable()
export class CacheInvalidationInterceptor implements NestInterceptor {
  private readonly reflector: Reflector;

  /**
   * @param {Reflector} reflector - Reads the invalidation route metadata.
   */
  constructor(reflector: Reflector) {
    this.reflector = reflector;
  }

  /**
   * Resolves the route's invalidation paths and sets the header once the handler succeeds.
   * @param {ExecutionContext} context - The current request's execution context.
   * @param {CallHandler} next - Delegates to the remaining handler chain.
   * @returns {Observable<unknown>} The unmodified response stream.
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();

    if (READ_METHODS.has(request.method.toUpperCase())) {
      return next.handle();
    }

    const paths = this.#resolve(context, request).filter(isSafePath);

    if (paths.length === 0) {
      return next.handle();
    }

    const response = http.getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        if (!response.headersSent) {
          response.set(CACHE_INVALIDATE_HEADER, paths.join(', '));
        }
      }),
    );
  }

  #resolve(context: ExecutionContext, request: Request): string[] {
    const declared = this.reflector.getAllAndOverride<CacheInvalidation | undefined>(INVALIDATION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    switch (declared?.kind) {
      case 'owner':
        return ownerPaths(context, request);
      case 'paths':
        return declared.build(request);
      default:
        return [];
    }
  }
}

function ownerPaths(context: ExecutionContext, request: Request): string[] {
  const owner = request.ownerContext;
  const base = controllerBase(context);

  if (!owner || !base) {
    return [];
  }

  if (owner.kind === 'user') {
    return [`/${base}`];
  }

  return [`/orgs/${owner.organizationId}/${base}`];
}

function controllerBase(context: ExecutionContext): string {
  const metadata: unknown = Reflect.getMetadata(PATH_METADATA, context.getClass());
  const first: unknown = Array.isArray(metadata) ? metadata[0] : metadata;

  return typeof first === 'string' ? first.replace(/^\/+|\/+$/g, '') : '';
}

function isSafePath(path: string): boolean {
  if (!path.startsWith('/') || path === '/' || UNSAFE_PATH.test(path)) {
    return false;
  }

  return path
    .slice(1)
    .split('/')
    .every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}
