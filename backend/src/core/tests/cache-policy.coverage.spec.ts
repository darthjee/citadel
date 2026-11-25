import {
  type ClassConstructor,
  discoverControllers,
  KNOWN_CONTROLLERS,
  routesOf,
  type RouteEntry,
} from './support/route-discovery.js';

// Enforces `docs/agents/architecture/caching.md`: every route must declare a cache class via
// `@CachePolicy()`, because under Tent's opt-out default an undeclared `*.json` route would be
// silently shared-cached. Only static decorator metadata is read — no app bootstrap, no DB.

describe('cache-class coverage', () => {
  let controllers: ClassConstructor[];
  let routes: RouteEntry[];

  beforeAll(async () => {
    controllers = await discoverControllers();
    routes = controllers.flatMap(routesOf);
  });

  it('discovers at least the known controllers (so a broken glob cannot pass vacuously)', () => {
    expect(controllers.map((controller) => controller.name)).toEqual(expect.arrayContaining(KNOWN_CONTROLLERS));
  });

  it('discovers routes on the known controllers', () => {
    expect(routes.length).toBeGreaterThanOrEqual(KNOWN_CONTROLLERS.length);
  });

  it('declares a cache class on every route (method or controller level)', () => {
    const undeclared = routes
      .filter((route) => route.cacheClass === undefined)
      .map((route) => `${route.controller}.${route.method}`);

    if (undeclared.length > 0) {
      throw new Error(
        `Routes without a cache class: ${undeclared.join(', ')}. ` +
          'Add @CachePolicy(CacheClass.X) to the route or its controller — see docs/agents/architecture/caching.md.',
      );
    }

    expect(undeclared).toEqual([]);
  });
});
