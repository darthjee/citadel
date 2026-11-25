import 'reflect-metadata';
import { CallHandler, Controller, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import { InvalidatesOwner, InvalidatesPaths, NoCacheInvalidation } from '../cache-invalidation.decorator.js';
import { CACHE_INVALIDATE_HEADER, CacheInvalidationInterceptor } from '../cache-invalidation.interceptor.js';
import type { OwnerContext } from '../owner-context.js';

const USER: OwnerContext = { kind: 'user', userId: 7 };
const ORGANIZATION: OwnerContext = { kind: 'organization', organizationId: 3, role: 'admin' };

let builtPaths: string[] = [];

@Controller(['things', 'orgs/:orgId/things'])
@InvalidatesOwner()
class OwnerController {
  handler(): void {}
}

@Controller('/slashed/')
@InvalidatesOwner()
class SlashedController {
  handler(): void {}
}

@InvalidatesOwner()
class NoPathController {
  handler(): void {}
}

@Controller('things')
class RouteLevelController {
  @InvalidatesPaths(() => builtPaths)
  paths(): void {}

  @NoCacheInvalidation()
  none(): void {}

  undeclared(): void {}
}

interface Run {
  method?: string;
  ownerContext?: OwnerContext;
  controller?: abstract new () => unknown;
  handler?: () => void;
  headersSent?: boolean;
  fail?: boolean;
}

describe('CacheInvalidationInterceptor', () => {
  const interceptor = new CacheInvalidationInterceptor(new Reflector());
  let set: jest.Mock;

  const contextFor = (options: Run): ExecutionContext => {
    const controller = options.controller ?? OwnerController;
    const handler = options.handler ?? OwnerController.prototype.handler;
    const request = { method: options.method ?? 'POST', ownerContext: options.ownerContext };
    const response = { set, headersSent: options.headersSent ?? false };

    return {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
      getHandler: () => handler,
      getClass: () => controller,
    } as unknown as ExecutionContext;
  };

  const run = (options: Run = {}): Promise<unknown> => {
    const next: CallHandler = {
      handle: () => (options.fail ? throwError(() => new Error('boom')) : of({ ok: true })),
    };

    return lastValueFrom(interceptor.intercept(contextFor(options), next));
  };

  beforeEach(() => {
    set = jest.fn();
    builtPaths = [];
  });

  describe('on a read', () => {
    it.each(['GET', 'HEAD', 'get'])('passes %s through without a header', async (method) => {
      expect(await run({ method, ownerContext: USER })).toEqual({ ok: true });
      expect(set).not.toHaveBeenCalled();
    });
  });

  describe('with InvalidatesOwner()', () => {
    it.each(['POST', 'PATCH', 'PUT', 'DELETE'])('sets the personal prefix on a successful %s', async (method) => {
      await run({ method, ownerContext: USER });
      expect(set).toHaveBeenCalledWith(CACHE_INVALIDATE_HEADER, '/things');
    });

    it('sets the organization prefix for an organization context', async () => {
      await run({ ownerContext: ORGANIZATION });
      expect(set).toHaveBeenCalledWith(CACHE_INVALIDATE_HEADER, '/orgs/3/things');
    });

    it('trims slashes around the controller path', async () => {
      await run({ ownerContext: USER, controller: SlashedController, handler: SlashedController.prototype.handler });
      expect(set).toHaveBeenCalledWith(CACHE_INVALIDATE_HEADER, '/slashed');
    });

    it('sets nothing without an owner context', async () => {
      await run();
      expect(set).not.toHaveBeenCalled();
    });

    it('sets nothing when the controller has no path', async () => {
      await run({ ownerContext: USER, controller: NoPathController, handler: NoPathController.prototype.handler });
      expect(set).not.toHaveBeenCalled();
    });

    it('sets nothing when the handler errors', async () => {
      await expect(run({ ownerContext: USER, fail: true })).rejects.toThrow('boom');
      expect(set).not.toHaveBeenCalled();
    });

    it('does not touch a response whose headers were already sent', async () => {
      await run({ ownerContext: USER, headersSent: true });
      expect(set).not.toHaveBeenCalled();
    });
  });

  describe('with InvalidatesPaths()', () => {
    const runPaths = (): Promise<unknown> =>
      run({ controller: RouteLevelController, handler: RouteLevelController.prototype.paths });

    it('emits the built paths joined by a comma', async () => {
      builtPaths = ['/things/1.json', '/orgs/3/things'];
      await runPaths();
      expect(set).toHaveBeenCalledWith(CACHE_INVALIDATE_HEADER, '/things/1.json, /orgs/3/things');
    });

    it.each([
      '/',
      'things',
      '/things/../admin',
      '/things/./x',
      '/things//x',
      '/things/',
      '/things?a=1',
      '/things#x',
      '/things%2F',
      '/things\\x',
      '/things\0',
      '/http://evil',
    ])('drops the unsafe path %p', async (unsafe) => {
      builtPaths = [unsafe, '/things'];
      await runPaths();
      expect(set).toHaveBeenCalledWith(CACHE_INVALIDATE_HEADER, '/things');
    });

    it('sets nothing when every path is dropped', async () => {
      builtPaths = ['/', '../x'];
      await runPaths();
      expect(set).not.toHaveBeenCalled();
    });
  });

  describe('without an invalidation', () => {
    it.each([
      ['NoCacheInvalidation()', RouteLevelController.prototype.none],
      ['an undeclared route', RouteLevelController.prototype.undeclared],
    ])('sets nothing for %s', async (_label, handler) => {
      expect(await run({ ownerContext: USER, controller: RouteLevelController, handler })).toEqual({ ok: true });
      expect(set).not.toHaveBeenCalled();
    });
  });
});
