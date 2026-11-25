import { applyDecorators, Controller, SetMetadata } from '@nestjs/common';
import { CacheClass } from './cache-class.js';
import { InvalidatesOwner } from './cache-invalidation.decorator.js';
import { CachePolicy } from './cache-policy.decorator.js';

export const IS_OWNER_SCOPED_KEY = 'isOwnerScoped';

/**
 * Marks a route (or an entire controller) as user-or-organization-owned —
 * enforced by the global `OwnerContextGuard`, which resolves the request's
 * `OwnerContext` (the JWT user, or the `:orgId` organization after the
 * membership check). Prefer {@link OwnerScopedController}, which also mounts
 * both prefixes and sets the cache class.
 * @returns {MethodDecorator & ClassDecorator} The metadata decorator.
 */
export const OwnerScoped = (): ReturnType<typeof SetMetadata> => SetMetadata(IS_OWNER_SCOPED_KEY, true);

/**
 * Declares a user-or-organization-owned controller: mounts it under both
 * `<path>` (personal) and `orgs/:orgId/<path>` (organization), marks it
 * {@link OwnerScoped}, sets `@CachePolicy(CacheClass.UserScoped)` and declares
 * {@link InvalidatesOwner} (writes clear the owner's `<path>` subtree), so
 * mounting, scoping, cache class and invalidation cannot be separated. A route may narrow the
 * class to `never` but must never be `public` (a coverage spec enforces it).
 * Handlers read the owner through `@CurrentOwner()` and take bodies **only**
 * through `@StrictBody()` (never `@Body()`), so unknown fields — including owner
 * fields — answer 400; the coverage spec fails on a plain `@Body()`.
 * @param {string} path - The module's route path (e.g. `bank`).
 * @returns {ClassDecorator} The combined controller decorator.
 */
export const OwnerScopedController = (path: string): ClassDecorator =>
  applyDecorators(
    Controller([path, `orgs/:orgId/${path}`]),
    OwnerScoped(),
    CachePolicy(CacheClass.UserScoped),
    InvalidatesOwner(),
  );
