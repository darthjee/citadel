import { Body, Get, Post, RequestMethod } from '@nestjs/common';
import { CacheClass } from '../cache-class.js';
import { CachePolicy } from '../cache-policy.decorator.js';
import { MinOrgRole } from '../min-org-role.decorator.js';
import { OrgRole } from '../org-role.js';
import { OwnerScopedController } from '../owner-scoped.decorator.js';
import { StrictBody } from '../strict-validation.pipe.js';
import { discoverControllers, KNOWN_CONTROLLERS, routesOf, type RouteEntry } from './support/route-discovery.js';

// Keeps owner-scoped routes safe by construction: they take request bodies only through
// `@StrictBody()` (so unknown fields, including owner fields, answer 400 instead of being
// stripped), and are never shared-cached (`public`). Only static decorator metadata is read —
// no app bootstrap, no DB.

function describeRoute(route: RouteEntry): string {
  return `${route.controller}#${route.method} ${RequestMethod[route.httpMethod]} ${route.path}`;
}

function plainBodyRoutes(routes: RouteEntry[]): string[] {
  return routes.filter((route) => route.ownerScoped && route.usesPlainBody).map(describeRoute);
}

function publicRoutes(routes: RouteEntry[]): string[] {
  return routes.filter((route) => route.ownerScoped && route.cacheClass === CacheClass.Public).map(describeRoute);
}

class FixtureDto {
  name?: string;
}

// Fixtures proving the checks actually detect violations (never registered anywhere).
@OwnerScopedController('fixture-bodies')
class PlainBodyController {
  @Post('plain.json')
  @MinOrgRole(OrgRole.USER)
  plain(@Body() _body: FixtureDto): void {}

  @Post('strict.json')
  @MinOrgRole(OrgRole.USER)
  strict(@StrictBody() _body: FixtureDto): void {}
}

@OwnerScopedController('fixture-cache')
class PublicOverrideController {
  @Get('shared.json')
  @CachePolicy(CacheClass.Public)
  shared(): void {}

  @Get('never.json')
  @CachePolicy(CacheClass.Never)
  never(): void {}

  @Get('default.json')
  inherited(): void {}
}

describe('owner-scoped coverage', () => {
  let routes: RouteEntry[];

  beforeAll(async () => {
    const controllers = await discoverControllers();

    expect(controllers.map((controller) => controller.name)).toEqual(expect.arrayContaining(KNOWN_CONTROLLERS));
    routes = controllers.flatMap(routesOf);
  });

  it('discovers owner-scoped routes (> 0)', () => {
    expect(routes.filter((route) => route.ownerScoped).length).toBeGreaterThan(0);
  });

  it('never takes a plain @Body() on an owner-scoped route', () => {
    const plain = plainBodyRoutes(routes);

    if (plain.length > 0) {
      throw new Error(
        `Owner-scoped routes with a plain @Body(): ${plain.join(', ')}. ` +
          'Use @StrictBody() so unknown fields answer 400.',
      );
    }

    expect(plain).toEqual([]);
  });

  it('never declares an owner-scoped route public', () => {
    const shared = publicRoutes(routes);

    if (shared.length > 0) {
      throw new Error(
        `Owner-scoped routes with the public cache class: ${shared.join(', ')}. ` +
          'Owner-scoped data is per caller: use CacheClass.UserScoped or CacheClass.Never.',
      );
    }

    expect(shared).toEqual([]);
  });

  describe('the checks themselves', () => {
    it('flag a plain @Body() but not @StrictBody()', () => {
      expect(plainBodyRoutes(routesOf(PlainBodyController))).toEqual([
        'PlainBodyController#plain POST fixture-bodies/plain.json',
      ]);
    });

    it('flag a public override but not never or the inherited user-scoped class', () => {
      expect(publicRoutes(routesOf(PublicOverrideController))).toEqual([
        'PublicOverrideController#shared GET fixture-cache/shared.json',
      ]);
    });
  });
});
