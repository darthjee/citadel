import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { CACHE_ALLOW_HEADER, CacheClass, PUBLIC_MAX_AGE_SECONDS, SKIP_CACHE_HEADER } from './cache-class.js';
import { CACHE_CLASS_KEY } from './cache-policy.decorator.js';

const CACHEABLE_METHODS = new Set(['GET', 'HEAD']);

const CACHE_CONTROL_BY_CLASS: Record<CacheClass, string> = {
  [CacheClass.Public]: `public, max-age=${PUBLIC_MAX_AGE_SECONDS}`,
  [CacheClass.UserScoped]: 'private, no-store',
  [CacheClass.Never]: 'no-store',
};

/**
 * Global interceptor applying the route's (or controller's) `@CachePolicy()` class as response
 * headers before the handler runs, so error responses carry them too: `X-Cache-Allow` (opt-in
 * to Tent's per-caller cache) for `public`/`user-scoped`, `X-Skip-Cache` (opt-out) for `never`,
 * plus `Cache-Control` for browsers. Any method other than GET/HEAD is forced to the `never`
 * headers, since Tent's cache key ignores the HTTP method. Routes without a declared class are
 * left untouched, so Tent does not cache them (the cache-class coverage spec keeps that from
 * shipping).
 */
@Injectable()
export class CachePolicyInterceptor implements NestInterceptor {
  private readonly reflector: Reflector;

  /**
   * @param {Reflector} reflector - Reads the `@CachePolicy()` route metadata.
   */
  constructor(reflector: Reflector) {
    this.reflector = reflector;
  }

  /**
   * Sets the cache headers for the route's declared class, then delegates to the handler.
   * @param {ExecutionContext} context - The current request's execution context.
   * @param {CallHandler} next - Delegates to the remaining handler chain.
   * @returns {Observable<unknown>} The unmodified response stream.
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const declared = this.reflector.getAllAndOverride<CacheClass | undefined>(CACHE_CLASS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (declared) {
      const http = context.switchToHttp();
      const cacheClass = this.#effectiveClass(declared, http.getRequest<Request>().method);
      this.#applyHeaders(http.getResponse<Response>(), cacheClass);
    }

    return next.handle();
  }

  #effectiveClass(declared: CacheClass, method: string): CacheClass {
    return CACHEABLE_METHODS.has(method.toUpperCase()) ? declared : CacheClass.Never;
  }

  #applyHeaders(response: Response, cacheClass: CacheClass): void {
    if (cacheClass === CacheClass.Never) {
      response.set(SKIP_CACHE_HEADER, 'true');
    } else {
      response.set(CACHE_ALLOW_HEADER, 'true');
    }
    response.set('Cache-Control', CACHE_CONTROL_BY_CLASS[cacheClass]);
  }
}
