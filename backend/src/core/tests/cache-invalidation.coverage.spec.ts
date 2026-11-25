import { Controller, Delete, Get, Patch, Post, RequestMethod } from '@nestjs/common';
import { CacheClass } from '../cache-class.js';
import { NoCacheInvalidation } from '../cache-invalidation.decorator.js';
import { CachePolicy } from '../cache-policy.decorator.js';
import { MinOrgRole } from '../min-org-role.decorator.js';
import { OrgRole } from '../org-role.js';
import { OwnerScoped, OwnerScopedController } from '../owner-scoped.decorator.js';
import {
  discoverControllers,
  KNOWN_CONTROLLERS,
  READ_METHODS,
  routesOf,
  type RouteEntry,
} from './support/route-discovery.js';

// Keeps cached owner-scoped reads fresh: every owner-scoped write (`POST`/`PATCH`/`PUT`/`DELETE`)
// must declare which cached GETs it invalidates — `InvalidatesOwner()` (set by
// `@OwnerScopedController()`), `InvalidatesPaths(build)` or an explicit `NoCacheInvalidation()`.
// Only static decorator metadata is read — no app bootstrap, no DB.

function describeRoute(route: RouteEntry): string {
  return `${route.controller}#${route.method} ${RequestMethod[route.httpMethod]} ${route.path}`;
}

function undeclaredInvalidations(routes: RouteEntry[]): string[] {
  return routes
    .filter((route) => route.ownerScoped && !READ_METHODS.includes(route.httpMethod))
    .filter((route) => route.invalidation === undefined)
    .map(describeRoute);
}

// Fixtures proving the check actually detects violations (never registered anywhere).
@Controller('fixture-bare')
@OwnerScoped()
@CachePolicy(CacheClass.UserScoped)
class BareOwnerScopedController {
  @Get('read.json')
  read(): void {}

  @Post('write.json')
  @MinOrgRole(OrgRole.USER)
  write(): void {}

  @Delete('remove.json')
  @MinOrgRole(OrgRole.ADMIN)
  @NoCacheInvalidation()
  remove(): void {}
}

@OwnerScopedController('fixture-declared')
class DeclaredController {
  @Post('write.json')
  @MinOrgRole(OrgRole.USER)
  write(): void {}

  @Patch('update.json')
  @MinOrgRole(OrgRole.USER)
  @NoCacheInvalidation()
  update(): void {}
}

describe('cache-invalidation coverage', () => {
  let routes: RouteEntry[];

  beforeAll(async () => {
    const controllers = await discoverControllers();

    expect(controllers.map((controller) => controller.name)).toEqual(expect.arrayContaining(KNOWN_CONTROLLERS));
    routes = controllers.flatMap(routesOf);
  });

  // The "discovers owner-scoped write routes (> 0)" assertion is restored by #31, once a real
  // owner-scoped controller exists; until then the KNOWN_CONTROLLERS check above guards the glob.

  it('declares a cache invalidation on every owner-scoped write route', () => {
    const undeclared = undeclaredInvalidations(routes);

    if (undeclared.length > 0) {
      throw new Error(
        `Owner-scoped write routes without a cache invalidation: ${undeclared.join(', ')}. ` +
          'Use @OwnerScopedController(), or add InvalidatesOwner(), InvalidatesPaths(build) or NoCacheInvalidation().',
      );
    }

    expect(undeclared).toEqual([]);
  });

  describe('the check itself', () => {
    it('flags an undeclared owner-scoped write but not reads or NoCacheInvalidation()', () => {
      expect(undeclaredInvalidations(routesOf(BareOwnerScopedController))).toEqual([
        'BareOwnerScopedController#write POST fixture-bare/write.json',
      ]);
    });

    it('accepts @OwnerScopedController() writes and NoCacheInvalidation() overrides', () => {
      expect(undeclaredInvalidations(routesOf(DeclaredController))).toEqual([]);
    });
  });
});
