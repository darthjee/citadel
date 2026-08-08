import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { User } from './entities/user.entity.js';
import type { AuthResult } from './token.service.js';

const ACCESS_TOKEN_COOKIE = 'access_token';
// Default access-token lifetime (15 minutes, in milliseconds) used when
// `CITADEL_PLACEHOLDER_ACCESS_TOKEN_TTL_MS` is unset — must match `app.module.ts`'s
// `JwtModule.registerAsync` default so the cookie's `maxAge` always tracks
// the signed JWT's actual expiry.
const DEFAULT_ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;

/**
 * Shared login-session response shape: sets the httpOnly `access_token`
 * cookie and returns `{ user, refreshToken }` with
 * `user` serialized through {@link serializeUser}. Used by both the
 * password-login/refresh/register routes (`AuthController`) and the
 * device-authorization "logged" poll response
 * (`AuthorizationRequestController`), so the two response bodies cannot
 * drift apart. Cache headers (`X-Skip-Cache`/`Cache-Control`) come from the owning
 * controllers' `@CachePolicy(CacheClass.Never)` via the global `CachePolicyInterceptor`.
 * @param {AuthResult} result - The freshly issued session (user + access/refresh tokens).
 * @param {Response} res - Used to set the access-token cookie.
 * @param {ConfigService} configService - Supplies the access-token TTL used for the cookie's `maxAge`.
 * @returns {object} `{ user, refreshToken }`, `user` serialized as `{ id, username, email, isAdmin }`.
 */
export function respondWithSession(
  result: AuthResult,
  res: Response,
  configService: ConfigService,
): object {
  const { user, accessToken, refreshToken } = result;

  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: configService.get<number>('CITADEL_PLACEHOLDER_ACCESS_TOKEN_TTL_MS', DEFAULT_ACCESS_TOKEN_TTL_MS),
  });

  return { user: serializeUser(user), refreshToken };
}

/**
 * Serializes a {@link User} into its public view.
 * @param {User} user - The user to serialize.
 * @returns {object} `{ id, username, email, isAdmin }`.
 */
export function serializeUser(user: User): object {
  return { id: user.id, username: user.username, email: user.email, isAdmin: user.isAdmin };
}
