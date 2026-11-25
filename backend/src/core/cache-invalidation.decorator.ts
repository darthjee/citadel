import { SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

export const INVALIDATION_KEY = 'cacheInvalidation';

/**
 * Builds the explicit cached GET paths a write invalidates, from its request
 * (e.g. the parsed `:orgId`). Must return absolute paths with no query, no `..`,
 * and never `/` or a recursive prefix wider than the write's effect (e.g. `/orgs`).
 */
export type InvalidationPathBuilder = (request: Request) => string[];

/**
 * A route's cache-invalidation declaration, read by the global
 * `CacheInvalidationInterceptor` and emitted as `X-Cache-Invalidate` on
 * successful non-GET responses:
 *
 * - `owner`: the owner's base prefix (`/<path>` or `/orgs/<id>/<path>`), resolved at request time;
 * - `paths`: explicit paths computed from the request;
 * - `none`: the write invalidates no cached GET.
 */
export type CacheInvalidation =
  | { kind: 'owner' }
  | { kind: 'paths'; build: InvalidationPathBuilder }
  | { kind: 'none' };

/**
 * Declares that a route (or an entire controller) invalidates the owner's base
 * prefix — `/<path>` for a personal owner, `/orgs/<organizationId>/<path>` for an
 * organization owner. Applied by `OwnerScopedController`.
 * @returns {MethodDecorator & ClassDecorator} The metadata decorator.
 */
export const InvalidatesOwner = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(INVALIDATION_KEY, { kind: 'owner' } satisfies CacheInvalidation);

/**
 * Declares the explicit cached GET paths a route (or an entire controller) invalidates.
 * @param {InvalidationPathBuilder} build - Computes the paths from the request.
 * @returns {MethodDecorator & ClassDecorator} The metadata decorator.
 */
export const InvalidatesPaths = (build: InvalidationPathBuilder): ReturnType<typeof SetMetadata> =>
  SetMetadata(INVALIDATION_KEY, { kind: 'paths', build } satisfies CacheInvalidation);

/**
 * Declares that a route (or an entire controller) invalidates no cached GET.
 * @returns {MethodDecorator & ClassDecorator} The metadata decorator.
 */
export const NoCacheInvalidation = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(INVALIDATION_KEY, { kind: 'none' } satisfies CacheInvalidation);
