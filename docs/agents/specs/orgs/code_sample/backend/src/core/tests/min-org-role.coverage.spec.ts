import { Delete, Get, Patch, Post, Put, RequestMethod } from '@nestjs/common';
import { MinOrgRole } from '../min-org-role.decorator.js';
import { OrgRole } from '../org-role.js';
import { OwnerScopedController } from '../owner-scoped.decorator.js';
import {
  discoverControllers,
  KNOWN_CONTROLLERS,
  READ_METHODS,
  routesOf,
  type RouteEntry,
} from './support/route-discovery.js';

// Keeps owner-scoped writes closed by default: every owner-scoped `POST`/`PATCH`/`PUT`/`DELETE`
// handler must declare `@MinOrgRole(role)`, which `OwnerContextGuard` enforces right after the
// uniform 404. Reads (`GET`/`HEAD`) need no declaration. Only static decorator metadata is read —
// no app bootstrap, no DB. Routes that are not owner-scoped (e.g. the organization rename) are out
// of scope here and covered by their own e2e specs.

const ROLES: unknown[] = Object.values(OrgRole);

function describeRoute(route: RouteEntry): string {
  return `${route.controller}#${route.method} ${RequestMethod[route.httpMethod]} ${route.path}`;
}

function undeclaredOwnerScopedWrites(routes: RouteEntry[]): string[] {
  return routes
    .filter((route) => route.ownerScoped && !READ_METHODS.includes(route.httpMethod))
    .filter((route) => route.minOrgRole === undefined)
    .map(describeRoute);
}

function invalidRoleDeclarations(routes: RouteEntry[]): string[] {
  return routes
    .filter((route) => route.minOrgRole !== undefined && !ROLES.includes(route.minOrgRole))
    .map(describeRoute);
}

// Fixtures proving the checks actually detect violations (never registered anywhere).
@OwnerScopedController('fixture-roles')
class UndeclaredOrgRoleController {
  @Get('read.json')
  read(): void {}

  @Post('write.json')
  write(): void {}

  @Patch('declared.json')
  @MinOrgRole(OrgRole.USER)
  declared(): void {}

  @Put('replace.json')
  replace(): void {}

  @Delete('remove.json')
  @MinOrgRole('superuser' as OrgRole)
  remove(): void {}
}

describe('org-role coverage', () => {
  let routes: RouteEntry[];

  beforeAll(async () => {
    const controllers = await discoverControllers();

    expect(controllers.map((controller) => controller.name)).toEqual(expect.arrayContaining(KNOWN_CONTROLLERS));
    routes = controllers.flatMap(routesOf);
  });

  it('discovers owner-scoped write routes (so a broken glob cannot pass vacuously)', () => {
    expect(routes.filter((route) => route.ownerScoped && !READ_METHODS.includes(route.httpMethod)).length).toBeGreaterThan(0);
  });

  it('declares @MinOrgRole on every owner-scoped write route', () => {
    const undeclared = undeclaredOwnerScopedWrites(routes);

    if (undeclared.length > 0) {
      throw new Error(
        `Owner-scoped write routes without @MinOrgRole: ${undeclared.join(', ')}. ` +
          'Add @MinOrgRole(OrgRole.X) to the handler.',
      );
    }

    expect(undeclared).toEqual([]);
  });

  it('declares only valid OrgRole values', () => {
    const invalid = invalidRoleDeclarations(routes);

    if (invalid.length > 0) {
      throw new Error(`Routes with an unknown @MinOrgRole value: ${invalid.join(', ')}.`);
    }

    expect(invalid).toEqual([]);
  });

  describe('the checks themselves', () => {
    const fixtureRoutes = routesOf(UndeclaredOrgRoleController);

    it('flag undeclared owner-scoped writes but not reads or declared writes', () => {
      expect(undeclaredOwnerScopedWrites(fixtureRoutes)).toEqual([
        'UndeclaredOrgRoleController#write POST fixture-roles/write.json',
        'UndeclaredOrgRoleController#replace PUT fixture-roles/replace.json',
      ]);
    });

    it('flag an unknown role value', () => {
      expect(invalidRoleDeclarations(fixtureRoutes)).toEqual([
        'UndeclaredOrgRoleController#remove DELETE fixture-roles/remove.json',
      ]);
    });
  });
});
