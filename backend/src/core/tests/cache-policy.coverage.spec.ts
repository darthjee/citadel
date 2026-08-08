import 'reflect-metadata';
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { CACHE_CLASS_KEY } from '../cache-policy.decorator.js';

// Enforces `docs/agents/architecture/caching.md`: every route must declare a cache class via
// `@CachePolicy()`, because under Tent's opt-out default an undeclared `*.json` route would be
// silently shared-cached. Only static decorator metadata is read — no app bootstrap, no DB.

const SRC_ROOT = resolve(__dirname, '..', '..');
const KNOWN_CONTROLLERS = ['AdminController', 'AuthController', 'AuthorizationRequestController', 'HealthController'];

type ClassConstructor = new (...args: never[]) => unknown;

interface RouteEntry {
  controller: string;
  method: string;
  cacheClass: unknown;
}

function findControllerFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return entry.name === 'tests' ? [] : findControllerFiles(path);
    }

    return entry.name.endsWith('.controller.ts') ? [path] : [];
  });
}

function isController(value: unknown): value is ClassConstructor {
  return typeof value === 'function' && Reflect.getMetadata(PATH_METADATA, value) !== undefined;
}

function routesOf(controller: ClassConstructor): RouteEntry[] {
  const prototype = controller.prototype as Record<string, unknown>;

  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor' && typeof prototype[name] === 'function')
    .filter((name) => Reflect.getMetadata(METHOD_METADATA, prototype[name] as object) !== undefined)
    .map((name) => ({
      controller: controller.name,
      method: name,
      cacheClass:
        Reflect.getMetadata(CACHE_CLASS_KEY, prototype[name] as object) ??
        Reflect.getMetadata(CACHE_CLASS_KEY, controller),
    }));
}

async function discoverControllers(): Promise<ClassConstructor[]> {
  const modules = await Promise.all(
    findControllerFiles(SRC_ROOT).map((file) => import(file) as Promise<Record<string, unknown>>),
  );

  return modules.flatMap((exported) => Object.values(exported).filter(isController));
}

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
