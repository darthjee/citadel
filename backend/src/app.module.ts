import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module.js';
import { AdminGuard } from './core/admin.guard.js';
import { CachePolicyInterceptor } from './core/cache-policy.interceptor.js';
import { CacheTokenService } from './core/cache-token.service.js';
import { HttpExceptionFilter } from './core/http-exception.filter.js';
import { JwtGuard } from './core/jwt.guard.js';
import { LazyModuleLoaderService } from './core/lazy-module-loader.service.js';
import { LoggingModule } from './core/logging.module.js';
import { OriginGuard } from './core/origin.guard.js';
import { RequestContextMiddleware } from './core/request-context.middleware.js';
import { buildSecretKeys } from './core/secret-keys.js';
import { HealthController } from './health/health.controller.js';
import { HealthService } from './health/health.service.js';
import { MailModule } from './mail/mail.module.js';

// Default access-token lifetime (15 minutes, in milliseconds) used when
// `CITADEL_PLACEHOLDER_ACCESS_TOKEN_TTL_MS` is unset — must match
// `auth/auth.controller.ts`'s default so the cookie's `maxAge` always
// tracks the signed JWT's actual expiry.
export const DEFAULT_ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;

/**
 * Builds `JwtModule`'s `signOptions` from `CITADEL_PLACEHOLDER_ACCESS_TOKEN_TTL_MS`
 * (milliseconds; same env var and default as the access-token cookie's
 * `maxAge` in `auth/auth.controller.ts`). Exported standalone, separate
 * from the `useFactory` inline below, so its millisecond-to-second
 * conversion is unit-testable without booting the full `AppModule` (which
 * would otherwise require a live database).
 * @param {ConfigService} configService - Supplies `CITADEL_PLACEHOLDER_ACCESS_TOKEN_TTL_MS`.
 * @returns {{ expiresIn: number }} `jsonwebtoken`'s `signOptions`, with
 *   `expiresIn` in seconds — `jsonwebtoken` treats a numeric `expiresIn` as
 *   seconds, not milliseconds (`node_modules/jsonwebtoken/lib/timespan.js`).
 */
export function buildJwtSignOptions(configService: ConfigService): { expiresIn: number } {
  const ttlMs = configService.get<number>('CITADEL_PLACEHOLDER_ACCESS_TOKEN_TTL_MS', DEFAULT_ACCESS_TOKEN_TTL_MS);
  return { expiresIn: Math.floor(ttlMs / 1000) };
}

/**
 * Root application module. Wires global configuration, the database
 * connection, and the core JWT guard/cache-token service (per the issue's
 * "Core" module classification — always resident, at boot, independent of
 * any feature module); feature modules (Auth, and later lazy modules) are
 * imported here as they are introduced. `JwtModule` signs with the current
 * secret key only (`buildSecretKeys(...).current`); retired keys are
 * accepted solely by `JwtGuard` when verifying.
 *
 * Global guards run in registration order: `OriginGuard` (CSRF protection
 * for state-changing requests) comes first, so a forged cross-site request
 * is rejected with `403` before `JwtGuard` could answer `401`; then
 * `JwtGuard`, then `AdminGuard` (which needs the authenticated user).
 *
 * Implements `NestModule` to wire the global `RequestContextMiddleware`
 * (request-correlation context + per-request access log) ahead of the
 * `APP_GUARD` chain — Nest runs middleware before guards, so the correlation
 * context is established and the access-log line still fires for
 * guard-rejected 401/403 responses.
 *
 * The global `HttpExceptionFilter` (registered via `APP_FILTER`, so it
 * receives `LoggerService` through DI) reshapes every error — including
 * `ValidationPipe` failures, guard rejections and unexpected exceptions —
 * into the standard `{ error: { code, message, details? }, statusCode,
 * timestamp }` body.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    AuthModule,
    LoggingModule,
    MailModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql' as const,
        host: configService.get<string>('CITADEL_PLACEHOLDER_MYSQL_HOST'),
        port: configService.get<number>('CITADEL_PLACEHOLDER_MYSQL_PORT', 3306),
        username: configService.get<string>('CITADEL_PLACEHOLDER_MYSQL_USER'),
        password: configService.get<string>('CITADEL_PLACEHOLDER_MYSQL_PASSWORD'),
        database: configService.get<string>('CITADEL_PLACEHOLDER_MYSQL_NAME'),
        autoLoadEntities: true,
        synchronize: false,
        poolSize: 5,
      }),
    }),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: buildSecretKeys(configService).current,
        signOptions: buildJwtSignOptions(configService),
      }),
    }),
  ],
  controllers: [HealthController],
  providers: [
    CacheTokenService,
    HealthService,
    LazyModuleLoaderService,
    {
      provide: APP_GUARD,
      useClass: OriginGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AdminGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CachePolicyInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  /**
   * Applies the global `RequestContextMiddleware` to every route so each
   * request runs inside a correlation context and emits one access-log line.
   * @param {MiddlewareConsumer} consumer - Nest's middleware registration API.
   * @returns {void}
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('{*splat}');
  }
}
