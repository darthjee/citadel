import { ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppModule, buildJwtSignOptions, DEFAULT_ACCESS_TOKEN_TTL_MS } from '../../app.module.js';
import { AuthModule } from '../../auth/auth.module.js';
import { OrganizationService } from '../../auth/organization.service.js';
import { AdminGuard } from '../admin.guard.js';
import { CacheInvalidationInterceptor } from '../cache-invalidation.interceptor.js';
import { JwtGuard } from '../jwt.guard.js';
import { ORGANIZATION_MEMBERSHIP_LOOKUP } from '../organization-membership-lookup.js';
import { OriginGuard } from '../origin.guard.js';
import { OwnerContextGuard } from '../owner-context.guard.js';

// Covers `AppModule`'s `JwtModule.registerAsync` sign-options wiring in
// isolation (extracted as `buildJwtSignOptions`) — booting the full
// `AppModule` would also try to establish a real MySQL connection via
// `TypeOrmModule.forRootAsync`, which CI's `backend_tests` job has no
// database service container for yet.
describe('buildJwtSignOptions', () => {
  describe('when CITADEL_PLACEHOLDER_ACCESS_TOKEN_TTL_MS is unset', () => {
    it('defaults expiresIn to 900 seconds (15 minutes)', () => {
      const configService = { get: jest.fn((_key: string, defaultValue: number) => defaultValue) };

      const signOptions = buildJwtSignOptions(configService as unknown as ConfigService);

      expect(configService.get).toHaveBeenCalledWith('CITADEL_PLACEHOLDER_ACCESS_TOKEN_TTL_MS', DEFAULT_ACCESS_TOKEN_TTL_MS);
      expect(signOptions).toEqual({ expiresIn: 900 });
    });
  });

  describe('when CITADEL_PLACEHOLDER_ACCESS_TOKEN_TTL_MS is set to 3600000 (1 hour)', () => {
    it('converts it to 3600 seconds', () => {
      const configService = { get: jest.fn().mockReturnValue(3_600_000) };

      const signOptions = buildJwtSignOptions(configService as unknown as ConfigService);

      expect(signOptions).toEqual({ expiresIn: 3_600 });
    });

    it('signs a token whose exp claim reflects the configured expiry', () => {
      const configService = { get: jest.fn().mockReturnValue(3_600_000) };
      const signOptions = buildJwtSignOptions(configService as unknown as ConfigService);
      const jwtService = new JwtService({ secret: 'test-secret' });
      const nowSeconds = Math.floor(Date.now() / 1000);

      const token = jwtService.sign({ sub: 1 }, signOptions);
      const decoded = jwtService.decode<{ exp: number }>(token);

      expect(decoded.exp).toBeGreaterThanOrEqual(nowSeconds + 3_600 - 1);
      expect(decoded.exp).toBeLessThanOrEqual(nowSeconds + 3_600 + 1);
    });
  });
});

type ProviderEntry = { provide?: unknown; useClass?: unknown; useExisting?: unknown } | (abstract new (...args: never[]) => unknown);

describe('AppModule providers', () => {
  const providers = (): ProviderEntry[] => Reflect.getMetadata('providers', AppModule) as ProviderEntry[];
  const classesFor = (token: unknown): unknown[] =>
    providers()
      .filter((entry) => typeof entry === 'object' && entry.provide === token)
      .map((entry) => (entry as { useClass?: unknown }).useClass);

  it('registers the global guards in order, OwnerContextGuard right after JwtGuard', () => {
    expect(classesFor(APP_GUARD)).toEqual([OriginGuard, JwtGuard, OwnerContextGuard, AdminGuard]);
  });

  it('registers CacheInvalidationInterceptor as a global interceptor', () => {
    expect(classesFor(APP_INTERCEPTOR)).toContain(CacheInvalidationInterceptor);
  });

  it('does not bind the membership lookup port itself', () => {
    expect(classesFor(ORGANIZATION_MEMBERSHIP_LOOKUP)).toEqual([]);
  });

  it('imports AuthModule, which provides the port', () => {
    expect(Reflect.getMetadata('imports', AppModule)).toContain(AuthModule);
  });
});

describe('AuthModule membership lookup port', () => {
  it('binds ORGANIZATION_MEMBERSHIP_LOOKUP to OrganizationService (useExisting)', () => {
    const providers = Reflect.getMetadata('providers', AuthModule) as ProviderEntry[];
    const bindings = providers.filter(
      (entry) => typeof entry === 'object' && entry.provide === ORGANIZATION_MEMBERSHIP_LOOKUP,
    );

    expect(bindings).toEqual([{ provide: ORGANIZATION_MEMBERSHIP_LOOKUP, useExisting: OrganizationService }]);
    expect(providers).toContain(OrganizationService);
  });

  it('exports the port together with OrganizationService', () => {
    const exported = Reflect.getMetadata('exports', AuthModule) as unknown[];

    expect(exported).toEqual(expect.arrayContaining([OrganizationService, ORGANIZATION_MEMBERSHIP_LOOKUP]));
  });
});
