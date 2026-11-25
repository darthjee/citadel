import { CanActivate, ExecutionContext, Get, INestApplication, Injectable, Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, NestFactory } from '@nestjs/core';
import type { Request } from 'express';
import request from 'supertest';
import { CachePolicyInterceptor } from '../cache-policy.interceptor.js';
import { CurrentOwner } from '../current-owner.decorator.js';
import { HttpExceptionFilter } from '../http-exception.filter.js';
import { LazyModuleLoaderService } from '../lazy-module-loader.service.js';
import { LoggingModule } from '../logging.module.js';
import type { OrgRole } from '../org-role.js';
import { ORGANIZATION_MEMBERSHIP_LOOKUP, type OrganizationMembershipLookup } from '../organization-membership-lookup.js';
import { OwnerContextGuard } from '../owner-context.guard.js';
import type { OwnerContext } from '../owner-context.js';
import { OwnerScopedController } from '../owner-scoped.decorator.js';

// Proves the owner-context mechanism depends only on `core/` and the `ORGANIZATION_MEMBERSHIP_LOOKUP`
// port: nothing here imports `src/auth/`. The membership check is a fake, and `request.user` is set by
// a stub guard standing in for `JwtGuard`. A lazy domain module (e.g. `bank`) registers its controller
// at boot and only loads its services on the first request, so the global `OwnerContextGuard` covers
// it exactly like here — this spec's controller even resolves its service through
// `LazyModuleLoaderService`, as a lazy module's controller does.

const MEMBERSHIPS = new Map<string, OrgRole>([['7:3', 'owner']]);

class FakeMembershipLookup implements OrganizationMembershipLookup {
  calls: Array<[number, number]> = [];

  async findRole(userId: number, orgId: number): Promise<OrgRole | null> {
    this.calls.push([userId, orgId]);
    return MEMBERSHIPS.get(`${userId}:${orgId}`) ?? null;
  }
}

// Stands in for `JwtGuard`: the `x-test-user` header becomes `request.user.sub`.
@Injectable()
class StubUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const sub = req.headers['x-test-user'];

    if (typeof sub === 'string') {
      req.user = { sub: Number(sub), sid: 'sid', username: `user-${sub}`, isAdmin: req.headers['x-test-admin'] === 'true' };
    }

    return true;
  }
}

@Injectable()
class LedgerService {
  describe(owner: OwnerContext): { owner: OwnerContext; lazy: true } {
    return { owner, lazy: true };
  }
}

@Module({ providers: [LedgerService] })
class LedgerModule {}

@OwnerScopedController('ledger')
class LedgerController {
  private readonly lazyModuleLoader: LazyModuleLoaderService;

  constructor(lazyModuleLoader: LazyModuleLoaderService) {
    this.lazyModuleLoader = lazyModuleLoader;
  }

  @Get('owner.json')
  async owner(@CurrentOwner() owner: OwnerContext): Promise<{ owner: OwnerContext; lazy: true }> {
    const moduleRef = await this.lazyModuleLoader.loadOnFirstRequest(() => LedgerModule);
    return moduleRef.get(LedgerService).describe(owner);
  }
}

describe('owner-scoped mechanism without the auth module (e2e)', () => {
  let app: INestApplication;
  let lookup: FakeMembershipLookup;

  beforeAll(async () => {
    lookup = new FakeMembershipLookup();

    @Module({
      imports: [ConfigModule.forRoot({ isGlobal: true }), LoggingModule],
      controllers: [LedgerController],
      providers: [
        LazyModuleLoaderService,
        { provide: ORGANIZATION_MEMBERSHIP_LOOKUP, useValue: lookup },
        { provide: APP_GUARD, useClass: StubUserGuard },
        { provide: APP_GUARD, useClass: OwnerContextGuard },
        { provide: APP_INTERCEPTOR, useClass: CachePolicyInterceptor },
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
      ],
    })
    class HostModule {}

    // A real Nest application (not `Test.createTestingModule`): `LazyModuleLoader` needs it.
    app = await NestFactory.create(HostModule, { logger: false, abortOnError: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    lookup.calls = [];
  });

  it('resolves the user on the personal prefix, without a membership lookup', async () => {
    const response = await request(app.getHttpServer()).get('/ledger/owner.json').set('x-test-user', '7').expect(200);

    expect(response.body).toEqual({ owner: { kind: 'user', userId: 7 }, lazy: true });
    expect(lookup.calls).toEqual([]);
    expect(response.headers['x-cache-allow']).toBe('true');
    expect(response.headers['x-skip-cache']).toBeUndefined();
  });

  it('resolves the organization for a member through the port', async () => {
    const response = await request(app.getHttpServer())
      .get('/orgs/3/ledger/owner.json')
      .set('x-test-user', '7')
      .expect(200);

    expect(response.body).toEqual({ owner: { kind: 'organization', organizationId: 3, role: 'owner' }, lazy: true });
    expect(lookup.calls).toEqual([[7, 3]]);
  });

  it.each([
    ['a non-member', '8', '3', 'false'],
    ['a non-member global admin', '8', '3', 'true'],
    ['an unknown organization', '7', '4', 'false'],
    ['a malformed id', '7', '1e3', 'false'],
  ])('answers the uniform 404 to %s', async (_label, user, orgId, admin) => {
    const response = await request(app.getHttpServer())
      .get(`/orgs/${orgId}/ledger/owner.json`)
      .set('x-test-user', user)
      .set('x-test-admin', admin)
      .expect(404);

    expect(response.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Not Found' },
      statusCode: 404,
      timestamp: expect.any(String),
    });
  });

  it('answers the uniform 404 when no user was authenticated', async () => {
    await request(app.getHttpServer()).get('/ledger/owner.json').expect(404);
  });
});
