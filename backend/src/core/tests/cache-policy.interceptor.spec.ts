import { CallHandler, Controller, ExecutionContext, Get, INestApplication, Post } from '@nestjs/common';
import { APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { of } from 'rxjs';
import request from 'supertest';
import { CacheClass, PUBLIC_MAX_AGE_SECONDS, SKIP_CACHE_HEADER } from '../cache-class.js';
import { CachePolicy } from '../cache-policy.decorator.js';
import { CachePolicyInterceptor } from '../cache-policy.interceptor.js';

function contextFor(set: jest.Mock, method: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getResponse: () => ({ set }), getRequest: () => ({ method }) }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

function handlerReturning(value: unknown): CallHandler {
  return { handle: () => of(value) };
}

describe('CachePolicyInterceptor', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let interceptor: CachePolicyInterceptor;
  let set: jest.Mock;

  const run = (method: string): Promise<unknown> =>
    new Promise((resolve) => {
      interceptor.intercept(contextFor(set, method), handlerReturning({ ok: true })).subscribe(resolve);
    });

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    interceptor = new CachePolicyInterceptor(reflector as unknown as Reflector);
    set = jest.fn();
  });

  describe('when the route declares no cache class', () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockReturnValue(undefined);
    });

    it('does not set any header', async () => {
      await run('GET');
      expect(set).not.toHaveBeenCalled();
    });

    it('passes the handler response through unchanged', async () => {
      expect(await run('GET')).toEqual({ ok: true });
    });
  });

  describe('when the route is public', () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockReturnValue(CacheClass.Public);
    });

    it.each(['GET', 'HEAD'])('on %s does not set X-Skip-Cache', async (method) => {
      await run(method);
      expect(set).not.toHaveBeenCalledWith(SKIP_CACHE_HEADER, expect.anything());
    });

    it.each(['GET', 'HEAD'])('on %s sets a public Cache-Control', async (method) => {
      await run(method);
      expect(set).toHaveBeenCalledWith('Cache-Control', `public, max-age=${PUBLIC_MAX_AGE_SECONDS}`);
    });

    it('on POST is forced to the never headers', async () => {
      await run('POST');
      expect(set.mock.calls).toEqual([
        [SKIP_CACHE_HEADER, 'true'],
        ['Cache-Control', 'no-store'],
      ]);
    });
  });

  describe('when the route is user-scoped', () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockReturnValue(CacheClass.UserScoped);
    });

    it('on GET sets X-Skip-Cache and a private Cache-Control', async () => {
      await run('GET');
      expect(set.mock.calls).toEqual([
        [SKIP_CACHE_HEADER, 'true'],
        ['Cache-Control', 'private, no-store'],
      ]);
    });

    it.each(['PUT', 'DELETE', 'PATCH'])('on %s is forced to the never headers', async (method) => {
      await run(method);
      expect(set.mock.calls).toEqual([
        [SKIP_CACHE_HEADER, 'true'],
        ['Cache-Control', 'no-store'],
      ]);
    });
  });

  describe('when the route is never', () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockReturnValue(CacheClass.Never);
    });

    it('on GET sets X-Skip-Cache and no-store', async () => {
      await run('GET');
      expect(set.mock.calls).toEqual([
        [SKIP_CACHE_HEADER, 'true'],
        ['Cache-Control', 'no-store'],
      ]);
    });
  });
});

@CachePolicy(CacheClass.Never)
@Controller('policy')
class PolicyTestController {
  @Get('inherited.json')
  inherited(): object {
    return { ok: true };
  }

  @CachePolicy(CacheClass.Public)
  @Get('overridden.json')
  overridden(): object {
    return { ok: true };
  }

  @CachePolicy(CacheClass.Public)
  @Post('overridden.json')
  overriddenPost(): object {
    return { ok: true };
  }
}

@Controller('bare')
class BareTestController {
  @Get('index.json')
  index(): object {
    return { ok: true };
  }
}

describe('CachePolicyInterceptor (wired globally)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PolicyTestController, BareTestController],
      providers: [{ provide: APP_INTERCEPTOR, useClass: CachePolicyInterceptor }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('applies the controller-level class to routes without their own', async () => {
    const response = await request(app.getHttpServer()).get('/policy/inherited.json');
    expect(response.headers['x-skip-cache']).toBe('true');
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('lets a route-level class override the controller-level one', async () => {
    const response = await request(app.getHttpServer()).get('/policy/overridden.json');
    expect(response.headers['x-skip-cache']).toBeUndefined();
    expect(response.headers['cache-control']).toBe(`public, max-age=${PUBLIC_MAX_AGE_SECONDS}`);
  });

  it('forces non-GET requests to the never headers even on a public route', async () => {
    const response = await request(app.getHttpServer()).post('/policy/overridden.json');
    expect(response.headers['x-skip-cache']).toBe('true');
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('sets no cache headers when no class is declared', async () => {
    const response = await request(app.getHttpServer()).get('/bare/index.json');
    expect(response.headers['x-skip-cache']).toBeUndefined();
    expect(response.headers['cache-control']).toBeUndefined();
  });
});
