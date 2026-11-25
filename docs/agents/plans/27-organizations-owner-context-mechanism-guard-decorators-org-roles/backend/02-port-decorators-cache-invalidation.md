# Port the decorators and cache invalidation

Move the metadata decorators and the invalidation pieces, which `@OwnerScopedController()` composes.

1. Move to `backend/src/core/`:
   - `cache-invalidation.decorator.ts`: `INVALIDATION_KEY`, `CacheInvalidation`, `InvalidatesOwner()`,
     `InvalidatesPaths()`, `NoCacheInvalidation()`. Unchanged.
   - `cache-invalidation.interceptor.ts`: `CacheInvalidationInterceptor`, `CACHE_INVALIDATE_HEADER`. Unchanged
     apart from the header comment: "the Ward proxy reads" becomes a note that the proxy will read it once
     per-user caching lands (#33), and it is forwarded untouched until then.
   - `min-org-role.decorator.ts`: `MIN_ORG_ROLE_KEY`, `@MinOrgRole()`.
   - `current-owner.decorator.ts`: `getCurrentOwner()`, `@CurrentOwner()` (a 500 when the context is missing).
   - `owner-scoped.decorator.ts`: `IS_OWNER_SCOPED_KEY`, `@OwnerScoped()`, `@OwnerScopedController(path)`, which
     composes `Controller([path, 'orgs/:orgId/' + path])`, `OwnerScoped()`,
     `CachePolicy(CacheClass.UserScoped)` and `InvalidatesOwner()`. It uses citadel's own `cache-class.ts` /
     `cache-policy.decorator.ts`: `CacheClass.UserScoped` exists with the same name, so no change is needed.
2. Move the specs `cache-invalidation.decorator.spec.ts`, `current-owner.decorator.spec.ts` and `owner-scoped.decorator.spec.ts` to `backend/src/core/tests/`, fixing import paths. Where a spec asserts
   cache headers or values tied to ward's `X-Cache-Allow` model, assert citadel's `CacheClass.UserScoped`
   metadata instead.
3. Write `backend/src/core/tests/cache-invalidation.interceptor.spec.ts` (the sample has none), driving the
   interceptor with a stub `ExecutionContext`/`CallHandler` and a real `Reflector`:
   - `GET` and `HEAD` pass through with no header, even with `InvalidatesOwner()` declared;
   - a successful `POST`/`PATCH`/`PUT`/`DELETE` with `InvalidatesOwner()` sets `X-Cache-Invalidate` to
     `/<path>` for a `{ kind: 'user' }` context and `/orgs/<id>/<path>` for an organization context, using the
     controller's first path;
   - `InvalidatesOwner()` with no `request.ownerContext` sets nothing;
   - `InvalidatesPaths(build)` emits the built paths joined by `, `;
   - unsafe paths are dropped: `/`, a relative path, `..`/`.` segments, an empty segment, `?`, `#`, `%`, `\`,
     NUL, `://`. When every path is dropped, no header is set;
   - `NoCacheInvalidation()` and an undeclared route set nothing;
   - a handler that errors produces no header;
   - a response whose headers were already sent is not touched.

## Files to Change

- `backend/src/core/cache-invalidation.decorator.ts`: new (moved).
- `backend/src/core/cache-invalidation.interceptor.ts`: new (moved).
- `backend/src/core/min-org-role.decorator.ts`: new (moved).
- `backend/src/core/current-owner.decorator.ts`: new (moved).
- `backend/src/core/owner-scoped.decorator.ts`: new (moved).
- `backend/src/core/tests/cache-invalidation.decorator.spec.ts`, `current-owner.decorator.spec.ts`,
  `owner-scoped.decorator.spec.ts`: new (moved, adapted).
- `backend/src/core/tests/cache-invalidation.interceptor.spec.ts`: new.
