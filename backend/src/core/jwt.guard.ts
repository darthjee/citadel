import {
  CanActivate,
  ExecutionContext,
  Inject,
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
import { SESSION_LOOKUP, type SessionLookup } from './session-lookup.js';

const INVALID_TOKEN_MESSAGE = 'Invalid or expired access token';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A signature-verified payload whose claims have not been validated yet. */
type VerifiedPayload = Record<string, unknown>;

/** The claims `JwtGuard` relies on, once validated. */
interface SessionClaims {
  sub: number;
  sid: string;
}

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
 *
 * Session gate: after the signature/expiry check the token must carry a
 * UUID `sid` and an integer `sub`, and `sid` must resolve (through the
 * `SESSION_LOOKUP` port, implemented by the Auth module) to an active
 * session owned by the user `sub`. `request.user` is then built from that
 * database row, so logout, session revocation and admin demotion take effect
 * on the next request. Every rejection past the missing-cookie check answers
 * the same `401 Invalid or expired access token`; lookup errors propagate.
 */
@Injectable()
export class JwtGuard implements CanActivate {
  private readonly jwtService: JwtService;
  private readonly reflector: Reflector;
  private readonly previousKeys: string[];
  private readonly sessionLookup: SessionLookup;

  /**
   * @param {JwtService} jwtService - Verifies/decodes the access token.
   * @param {Reflector} reflector - Reads the `@Public()` route metadata.
   * @param {ConfigService} configService - Supplies the retired secret keys
   *   still accepted when verifying (resolved once, at construction).
   * @param {SessionLookup} sessionLookup - Resolves the token's `sid` to the
   *   user owning the active session.
   */
  constructor(
    jwtService: JwtService,
    reflector: Reflector,
    configService: ConfigService,
    @Inject(SESSION_LOOKUP) sessionLookup: SessionLookup,
  ) {
    this.jwtService = jwtService;
    this.reflector = reflector;
    this.previousKeys = buildSecretKeys(configService).previous;
    this.sessionLookup = sessionLookup;
  }

  /**
   * Allows public routes through, otherwise requires a valid access token
   * bound to an active session of the token's user.
   * @param {ExecutionContext} context - The current request's execution context.
   * @returns {Promise<boolean>} Whether the request may proceed.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (readBooleanMetadata(this.reflector, IS_PUBLIC_KEY, context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.#extractToken(request);
    const { sub, sid } = this.#validateClaims(this.#verify(token));

    request.user = await this.#loadSessionUser(sub, sid);
    return true;
  }

  #extractToken(request: Request): string {
    const token = request.cookies?.access_token;

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    return token;
  }

  #verify(token: string): VerifiedPayload {
    const payload = this.#tryVerify(token) ?? this.#verifyWithPreviousKeys(token);

    if (!payload) {
      throw this.#invalidToken();
    }

    return payload;
  }

  #verifyWithPreviousKeys(token: string): VerifiedPayload | undefined {
    for (const secret of this.previousKeys) {
      const payload = this.#tryVerify(token, secret);

      if (payload) {
        return payload;
      }
    }

    return undefined;
  }

  #tryVerify(token: string, secret?: string): VerifiedPayload | undefined {
    try {
      return secret === undefined
        ? this.jwtService.verify<VerifiedPayload>(token)
        : this.jwtService.verify<VerifiedPayload>(token, { secret });
    } catch {
      return undefined;
    }
  }

  #validateClaims(payload: VerifiedPayload): SessionClaims {
    const { sub, sid } = payload;

    if (typeof sid !== 'string' || !UUID_PATTERN.test(sid) || !Number.isInteger(sub)) {
      throw this.#invalidToken();
    }

    return { sub: sub as number, sid };
  }

  async #loadSessionUser(sub: number, sid: string): Promise<AccessTokenPayload> {
    const user = await this.sessionLookup.findActiveSessionUser(sid);

    if (!user || user.id !== sub) {
      throw this.#invalidToken();
    }

    return { sub, sid, username: user.username, isAdmin: user.isAdmin };
  }

  #invalidToken(): UnauthorizedException {
    return new UnauthorizedException(INVALID_TOKEN_MESSAGE);
  }
}
