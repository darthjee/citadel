import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { buildCorsOptions } from './core/cors-config.js';
import { LoggerService } from './core/logger.service.js';
import { buildSecretKeys } from './core/secret-keys.js';

/**
 * Boots the Nest application, wiring cookie parsing (needed for the
 * httpOnly access-token cookie added by the Auth module), global request
 * DTO validation (`class-validator`, used by the Auth module's DTOs), and
 * reading runtime configuration (`PORT`, `CITADEL_PLACEHOLDER_SECRET_KEY`,
 * `CITADEL_PLACEHOLDER_PREVIOUS_SECRET_KEYS`) through `@nestjs/config` rather than
 * reading `process.env` directly. `cookie-parser` receives the full key list
 * (`[current, ...previous]`, blank keys dropped so an unset secret still
 * means "no secret"): it signs with the first and unsigns by trying each,
 * so a key rotation never breaks signed cookies. CORS is
 * enabled only when `buildCorsOptions` resolves an allowlist (from
 * `CITADEL_PLACEHOLDER_ALLOWED_ORIGINS`, falling back to `FRONTEND_BASE_URL`'s origin);
 * an invalid allowlist throws, failing boot via `bootstrap().catch`.
 * @returns {Promise<void>} Resolves once the HTTP server is listening.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = app.get(LoggerService);

  app.use(cookieParser(buildSecretKeys(configService).all.filter((key) => key !== '')));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const corsOptions = buildCorsOptions(configService);

  if (corsOptions) {
    app.enableCors(corsOptions);
    logger.info('cors enabled', { origins: corsOptions.origin === true ? 'reflect-any' : corsOptions.origin });
  }

  const port = configService.get<number>('PORT', 8080);
  await app.listen(port);
  logger.info('backend listening', { port });
}

// Raw console: this runs when NestFactory.create may have thrown, so the DI container (and LoggerService) may not exist.
bootstrap().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
