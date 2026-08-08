import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AccessTokenPayload } from './access-token-payload.js';
import { readBooleanMetadata } from './boolean-metadata.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { buildSecretKeys } from './secret-keys.js';

/**
 * Global guard verifying the JWT access token on every request, independent
 * of any feature module (per the issue's "Core" module classification).
 * Reads the token from the httpOnly `access_token` cookie set by the Auth
 * module. Routes (or controllers) annotated with `@Public()` skip
 * verification entirely.
 *
 * Supports zero-downtime `CITADEL_PLACEHOLDER_SECRET_KEY` rotation: a token is first
 * verified against the module secret (the current key), then against each
 * retired key from `CITADEL_PLACEHOLDER_PREVIOUS_SECRET_KEYS`, in order. Tokens are only
 * ever signed with the current key (see `auth/token.service.ts`).
 */
@Injectable()
export class JwtGuard implements CanActivate {
  private readonly jwtService: JwtService;
  private readonly reflector: Reflector;
  private readonly previousKeys: string[];

  /**
   * @param {JwtService} jwtService - Verifies/decodes the access token.
   * @param {Reflector} reflector - Reads the `@Public()` route metadata.
   * @param {ConfigService} configService - Supplies the retired secret keys
   *   still accepted when verifying (resolved once, at construction).
   */
  constructor(jwtService: JwtService, reflector: Reflector, configService: ConfigService) {
    this.jwtService = jwtService;
    this.reflector = reflector;
    this.previousKeys = buildSecretKeys(configService).previous;
  }

  /**
   * Allows public routes through, otherwise requires a valid access token.
   * @param {ExecutionContext} context - The current request's execution context.
   * @returns {boolean} Whether the request may proceed.
   */
  canActivate(context: ExecutionContext): boolean {
    if (readBooleanMetadata(this.reflector, IS_PUBLIC_KEY, context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.#extractToken(request);

    request.user = this.#verify(token);
    return true;
  }

  #extractToken(request: Request): string {
    const token = request.cookies?.access_token;

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    return token;
  }

  #verify(token: string): AccessTokenPayload {
    const payload = this.#tryVerify(token) ?? this.#verifyWithPreviousKeys(token);

    if (!payload) {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    return payload;
  }

  #verifyWithPreviousKeys(token: string): AccessTokenPayload | undefined {
    for (const secret of this.previousKeys) {
      const payload = this.#tryVerify(token, secret);

      if (payload) {
        return payload;
      }
    }

    return undefined;
  }

  #tryVerify(token: string, secret?: string): AccessTokenPayload | undefined {
    try {
      return secret === undefined
        ? this.jwtService.verify<AccessTokenPayload>(token)
        : this.jwtService.verify<AccessTokenPayload>(token, { secret });
    } catch {
      return undefined;
    }
  }
}
