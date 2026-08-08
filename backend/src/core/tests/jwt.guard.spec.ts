import { createHmac } from 'crypto';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtGuard } from '../jwt.guard.js';

const CURRENT_KEY = 'current-key';
const PAYLOAD = { sub: 42, username: 'darthjee', isAdmin: false };

function contextFor(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

function buildGuard(env: Record<string, string>, jwtSecret: string | undefined = CURRENT_KEY): JwtGuard {
  const jwtService = new JwtService({ secret: jwtSecret });
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
  const configService = { get: jest.fn((key: string) => env[key]) };

  return new JwtGuard(
    jwtService,
    reflector as unknown as Reflector,
    configService as unknown as ConfigService,
  );
}

function sign(secret: string, expiresIn: number = 60): string {
  return new JwtService({ secret }).sign(PAYLOAD, { expiresIn });
}

function expired(secret: string): string {
  const past = Math.floor(Date.now() / 1000) - 3600;
  return new JwtService({ secret }).sign({ ...PAYLOAD, iat: past, exp: past + 60 });
}

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function claims(): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  return { ...PAYLOAD, iat: now, exp: now + 60 };
}

// Hand-built so the library's own signing safeguards can't mask the check.
function unsigned(): string {
  return `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url(claims())}.`;
}

// HS256 token whose HMAC key is the empty string, built by hand because
// jsonwebtoken refuses to sign with an empty secret.
function signedWithEmptySecret(): string {
  const unsignedPart = `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(claims())}`;
  const signature = createHmac('sha256', '').update(unsignedPart).digest('base64url');
  return `${unsignedPart}.${signature}`;
}

function run(guard: JwtGuard, token?: string): { result: boolean; request: Record<string, unknown> } {
  const request: Record<string, unknown> = { cookies: token ? { access_token: token } : {} };
  const result = guard.canActivate(contextFor(request));
  return { result, request };
}

const INVALID = new UnauthorizedException('Invalid or expired access token');

describe('JwtGuard', () => {
  describe('with previous keys configured', () => {
    let guard: JwtGuard;

    beforeEach(() => {
      guard = buildGuard({
        CITADEL_PLACEHOLDER_SECRET_KEY: CURRENT_KEY,
        CITADEL_PLACEHOLDER_PREVIOUS_SECRET_KEYS: 'old-key-1, old-key-2',
      });
    });

    it('accepts a token signed with the current key', () => {
      const { result, request } = run(guard, sign(CURRENT_KEY));

      expect(result).toBe(true);
      expect(request.user).toMatchObject(PAYLOAD);
    });

    it.each(['old-key-1', 'old-key-2'])('accepts a token signed with previous key %s', (key) => {
      const { result, request } = run(guard, sign(key));

      expect(result).toBe(true);
      expect(request.user).toMatchObject(PAYLOAD);
    });

    it('rejects a token signed with an unknown key', () => {
      expect(() => run(guard, sign('unknown-key'))).toThrow(INVALID);
    });

    it('rejects an expired token signed with a previous key', () => {
      expect(() => run(guard, expired('old-key-1'))).toThrow(INVALID);
    });

    it('rejects an expired token signed with the current key', () => {
      expect(() => run(guard, expired(CURRENT_KEY))).toThrow(INVALID);
    });

    it('rejects a malformed token', () => {
      expect(() => run(guard, 'not-a-jwt')).toThrow(INVALID);
    });

    it('rejects an unsigned alg:none token', () => {
      expect(() => run(guard, unsigned())).toThrow(INVALID);
    });

    it('rejects an HS256 token signed with an empty-string secret', () => {
      expect(() => run(guard, signedWithEmptySecret())).toThrow(INVALID);
    });
  });

  describe('without previous keys configured', () => {
    let guard: JwtGuard;

    beforeEach(() => {
      guard = buildGuard({ CITADEL_PLACEHOLDER_SECRET_KEY: CURRENT_KEY });
    });

    it('accepts a token signed with the current key', () => {
      const { result, request } = run(guard, sign(CURRENT_KEY));

      expect(result).toBe(true);
      expect(request.user).toMatchObject(PAYLOAD);
    });

    it('rejects a token signed with any other key', () => {
      expect(() => run(guard, sign('old-key-1'))).toThrow(INVALID);
    });

    it('rejects a request without an access token', () => {
      expect(() => run(guard)).toThrow(new UnauthorizedException('Missing access token'));
    });
  });

  describe.each([
    ['an empty-string', ''],
    ['an undefined', undefined],
  ])('with an empty CITADEL_PLACEHOLDER_SECRET_KEY and %s JwtService secret', (_label, jwtSecret) => {
    let guard: JwtGuard;

    beforeEach(() => {
      guard = buildGuard({ CITADEL_PLACEHOLDER_SECRET_KEY: '' }, jwtSecret);
    });

    it('rejects a token signed with some other key', () => {
      expect(() => run(guard, sign('some-other-key'))).toThrow(INVALID);
    });

    it('rejects an unsigned alg:none token', () => {
      expect(() => run(guard, unsigned())).toThrow(INVALID);
    });

    it('rejects an HS256 token signed with an empty-string secret', () => {
      expect(() => run(guard, signedWithEmptySecret())).toThrow(INVALID);
    });
  });

  describe('on a @Public() route', () => {
    it('allows the request without verifying anything', () => {
      const jwtService = new JwtService({ secret: CURRENT_KEY });
      const verify = jest.spyOn(jwtService, 'verify');
      const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) };
      const configService = { get: jest.fn() };
      const guard = new JwtGuard(
        jwtService,
        reflector as unknown as Reflector,
        configService as unknown as ConfigService,
      );

      expect(guard.canActivate(contextFor({ cookies: {} }))).toBe(true);
      expect(verify).not.toHaveBeenCalled();
    });
  });
});
