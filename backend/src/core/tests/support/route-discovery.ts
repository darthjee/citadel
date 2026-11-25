import 'reflect-metadata';
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants.js';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum.js';
import { type CacheInvalidation, INVALIDATION_KEY } from '../../cache-invalidation.decorator.js';
import { CACHE_CLASS_KEY } from '../../cache-policy.decorator.js';
import { MIN_ORG_ROLE_KEY } from '../../min-org-role.decorator.js';
import { IS_OWNER_SCOPED_KEY } from '../../owner-scoped.decorator.js';

// Static route discovery shared by the coverage specs in `core/tests/`: walks every
// `*.controller.ts` under `src/` (skipping `tests/` folders), imports it and reads each route's
// decorator metadata. No app bootstrap, no DB.

const SRC_ROOT = resolve(__dirname, '..', '..', '..');

export const KNOWN_CONTROLLERS = ['AdminController', 'AuthController', 'AuthorizationRequestController', 'HealthController'];

export type ClassConstructor = new (...args: never[]) => unknown;

export interface RouteEntry {
  controller: string;
  method: string;
  path: string;
  cacheClass: unknown;
  ownerScoped: boolean;
  usesPlainBody: boolean;
  httpMethod: RequestMethod;
  invalidation: CacheInvalidation | undefined;
  invalidationOnHandler: boolean;
  minOrgRole: unknown;
}

export const READ_METHODS = [RequestMethod.GET, RequestMethod.HEAD];

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

function metadataOf(key: string, handler: object, controller: ClassConstructor): unknown {
  return Reflect.getMetadata(key, handler) ?? Reflect.getMetadata(key, controller);
}

function usesPlainBody(controller: ClassConstructor, method: string): boolean {
  const args = (Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, method) ?? {}) as Record<string, unknown>;

  return Object.keys(args).some((key) => key.split(':')[0] === String(RouteParamtypes.BODY));
}

function firstPath(value: unknown): string {
  const first: unknown = Array.isArray(value) ? value[0] : value;

  return typeof first === 'string' ? first.replace(/^\/+|\/+$/g, '') : '';
}

function pathOf(handler: object, controller: ClassConstructor): string {
  return [firstPath(Reflect.getMetadata(PATH_METADATA, controller)), firstPath(Reflect.getMetadata(PATH_METADATA, handler))]
    .filter((part) => part !== '')
    .join('/');
}

export function routesOf(controller: ClassConstructor): RouteEntry[] {
  const prototype = controller.prototype as Record<string, unknown>;

  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor' && typeof prototype[name] === 'function')
    .filter((name) => Reflect.getMetadata(METHOD_METADATA, prototype[name] as object) !== undefined)
    .map((name) => {
      const handler = prototype[name] as object;

      return {
        controller: controller.name,
        method: name,
        path: pathOf(handler, controller),
        cacheClass: metadataOf(CACHE_CLASS_KEY, handler, controller),
        ownerScoped: metadataOf(IS_OWNER_SCOPED_KEY, handler, controller) === true,
        usesPlainBody: usesPlainBody(controller, name),
        httpMethod: Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod,
        invalidation: metadataOf(INVALIDATION_KEY, handler, controller) as CacheInvalidation | undefined,
        invalidationOnHandler: Reflect.getMetadata(INVALIDATION_KEY, handler) !== undefined,
        minOrgRole: metadataOf(MIN_ORG_ROLE_KEY, handler, controller),
      };
    });
}

export async function discoverControllers(): Promise<ClassConstructor[]> {
  const modules = await Promise.all(
    findControllerFiles(SRC_ROOT).map((file) => import(file) as Promise<Record<string, unknown>>),
  );

  return modules.flatMap((exported) => Object.values(exported).filter(isController));
}
