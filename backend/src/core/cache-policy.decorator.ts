import { SetMetadata } from '@nestjs/common';
import type { CacheClass } from './cache-class.js';

export const CACHE_CLASS_KEY = 'cacheClass';

/**
 * Declares a route's (or an entire controller's) {@link CacheClass}, enforced by the global
 * `CachePolicyInterceptor`. A route-level declaration overrides the controller-level one.
 * @param {CacheClass} cacheClass - The cache class the route's responses belong to.
 * @returns {MethodDecorator & ClassDecorator} The metadata decorator.
 */
export const CachePolicy = (cacheClass: CacheClass): ReturnType<typeof SetMetadata> =>
  SetMetadata(CACHE_CLASS_KEY, cacheClass);
