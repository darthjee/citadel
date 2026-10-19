import { createHmac } from 'crypto';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtGuard } from '../jwt.guard.js';
import type { SessionLookup, SessionUser } from '../session-lookup.js';

const CURRENT_KEY = 'current-key';
const SID = '3f2b8c1e-9d4a-4e6b-8a1f-2c5d7e9f0a1b';
const PAYLOAD = { sub: 42, sid: SID, username: 'darthjee', isAdmin: false };
const ROW: SessionUser = { id: 42, username: 'darthjee', isAdmin: false };

type LookupDouble = { findActiveSessionUser: jest.Mock<Promise<SessionUser | null>, [string]> };

function contextFor(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

function lookupReturning(user: SessionUser | null = ROW): LookupDouble {
  return { findActiveSessionUser: jest.fn().mockResolvedValue(user) };
}

function buildGuard(
  env: Record<string, string>,
  lookup: LookupDouble = lookupReturning(),
  jwtSecret: string | undefined = CURRENT_KEY,
  isPublic: boolean = false,
): JwtGuard {
  const jwtService = new JwtService({ secret: jwtSecret });
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(isPublic) };
  const configService = { get: jest.fn((key: string) => env[key]) };

  return new JwtGuard(
    jwtService,
    reflector as unknown as Reflector,
    configService as unknown as ConfigService,
    lookup as unknown as SessionLookup,
  );
}

function sign(secret: string, payload: object = PAYLOAD, expiresIn: number = 60): string {
  return new JwtService({ secret }).sign(payload, { expiresIn });
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

async function run(
  guard: JwtGuard,
  token?: string,
): Promise<{ result: boolean; request: Record<string, unknown> }> {
  const request: Record<string, unknown> = { cookies: token ? { access_token: token } : {} };
  const result = await guard.canActivate(contextFor(request));
  return { result, request };
}

const INVALID = new UnauthorizedException('Invalid or expired access token');
const MISSING = new UnauthorizedException('Missing access token');

describe('JwtGuard', () => {
  describe('with previous keys configured', () => {
    let lookup: LookupDouble;
    let guard: JwtGuard;

    beforeEach(() => {
      lookup = lookupReturning();
      guard = buildGuard({
        CITADEL_PLACEHOLDER_SECRET_KEY: CURRENT_KEY,
        CITADEL_PLACEHOLDER_PREVIOUS_SECRET_KEYS: 'old-key-1, old-key-2',
      }, lookup);
    });

    it('accepts a token signed with the current key', async () => {
      const { result, request } = await run(guard, sign(CURRENT_KEY));

      expect(result).toBe(true);
      expect(request.user).toEqual(PAYLOAD);
      expect(lookup.findActiveSessionUser).toHaveBeenCalledWith(SID);
    });

    it.each(['old-key-1', 'old-key-2'])('accepts a token signed with previous key %s', async (key) => {
      const { result, request } = await run(guard, sign(key));

      expect(result).toBe(true);
      expect(request.user).toEqual(PAYLOAD);
      expect(lookup.findActiveSessionUser).toHaveBeenCalledWith(SID);
    });

    it('rejects a previous-key token whose session is not active', async () => {
      lookup.findActiveSessionUser.mockResolvedValue(null);

      await expect(run(guard, sign('old-key-1'))).rejects.toThrow(INVALID);
      expect(lookup.findActiveSessionUser).toHaveBeenCalledWith(SID);
    });

    it('rejects a token signed with an unknown key', async () => {
      await expect(run(guard, sign('unknown-key'))).rejects.toThrow(INVALID);
      expect(lookup.findActiveSessionUser).not.toHaveBeenCalled();
    });

    it('rejects an expired token signed with a previous key', async () => {
      await expect(run(guard, expired('old-key-1'))).rejects.toThrow(INVALID);
    });

    it('rejects an expired token signed with the current key', async () => {
      await expect(run(guard, expired(CURRENT_KEY))).rejects.toThrow(INVALID);
      expect(lookup.findActiveSessionUser).not.toHaveBeenCalled();
    });

    it('rejects a malformed token', async () => {
      await expect(run(guard, 'not-a-jwt')).rejects.toThrow(INVALID);
    });

    it('rejects an unsigned alg:none token', async () => {
      await expect(run(guard, unsigned())).rejects.toThrow(INVALID);
    });

    it('rejects an HS256 token signed with an empty-string secret', async () => {
      await expect(run(guard, signedWithEmptySecret())).rejects.toThrow(INVALID);
    });
  });

  describe('without previous keys configured', () => {
    let lookup: LookupDouble;
    let guard: JwtGuard;

    beforeEach(() => {
      lookup = lookupReturning();
      guard = buildGuard({ CITADEL_PLACEHOLDER_SECRET_KEY: CURRENT_KEY }, lookup);
    });

    it('accepts a token signed with the current key', async () => {
      const { result, request } = await run(guard, sign(CURRENT_KEY));

      expect(result).toBe(true);
      expect(request.user).toEqual(PAYLOAD);
    });

    it('rejects a token signed with any other key', async () => {
      await expect(run(guard, sign('old-key-1'))).rejects.toThrow(INVALID);
    });

    it('rejects a request without an access token, without calling the lookup', async () => {
      await expect(run(guard)).rejects.toThrow(MISSING);
      expect(lookup.findActiveSessionUser).not.toHaveBeenCalled();
    });
  });

  describe('session gate', () => {
    let lookup: LookupDouble;
    let guard: JwtGuard;

    beforeEach(() => {
      lookup = lookupReturning();
      guard = buildGuard({ CITADEL_PLACEHOLDER_SECRET_KEY: CURRENT_KEY }, lookup);
    });

    it('builds request.user from the lookup row, not the token claims', async () => {
      lookup.findActiveSessionUser.mockResolvedValue({ id: 42, username: 'renamed', isAdmin: false });
      const token = sign(CURRENT_KEY, { ...PAYLOAD, isAdmin: true });

      const { request } = await run(guard, token);

      expect(request.user).toEqual({ sub: 42, sid: SID, username: 'renamed', isAdmin: false });
    });

    it('reflects a promotion stored in the row', async () => {
      lookup.findActiveSessionUser.mockResolvedValue({ ...ROW, isAdmin: true });

      const { request } = await run(guard, sign(CURRENT_KEY));

      expect(request.user).toMatchObject({ isAdmin: true });
    });

    it.each([
      ['no sid', { sub: 42, username: 'darthjee', isAdmin: false }],
      ['a non-UUID sid', { ...PAYLOAD, sid: 'not-a-uuid' }],
      ['a UUID-like sid with extra characters', { ...PAYLOAD, sid: `${SID}x` }],
      ['a non-string sid', { ...PAYLOAD, sid: 12345 }],
      ['a string sub', { ...PAYLOAD, sub: '42' }],
      ['a float sub', { ...PAYLOAD, sub: 42.5 }],
      ['no sub', { sid: SID, username: 'darthjee', isAdmin: false }],
    ])('rejects a token with %s without calling the lookup', async (_label, payload) => {
      await expect(run(guard, sign(CURRENT_KEY, payload))).rejects.toThrow(INVALID);
      expect(lookup.findActiveSessionUser).not.toHaveBeenCalled();
    });

    it('accepts an upper-case UUID sid', async () => {
      const sid = SID.toUpperCase();

      const { request } = await run(guard, sign(CURRENT_KEY, { ...PAYLOAD, sid }));

      expect(request.user).toMatchObject({ sid });
      expect(lookup.findActiveSessionUser).toHaveBeenCalledWith(sid);
    });

    it('rejects a token whose session is not active', async () => {
      lookup.findActiveSessionUser.mockResolvedValue(null);

      await expect(run(guard, sign(CURRENT_KEY))).rejects.toThrow(INVALID);
    });

    it("rejects a token whose sid is another user's session", async () => {
      lookup.findActiveSessionUser.mockResolvedValue({ ...ROW, id: 7 });

      await expect(run(guard, sign(CURRENT_KEY))).rejects.toThrow(INVALID);
    });

    it('leaves request.user unset on rejection', async () => {
      lookup.findActiveSessionUser.mockResolvedValue(null);
      const request: Record<string, unknown> = { cookies: { access_token: sign(CURRENT_KEY) } };

      await expect(guard.canActivate(contextFor(request))).rejects.toThrow(INVALID);
      expect(request.user).toBeUndefined();
    });

    it('propagates a lookup error instead of answering 401', async () => {
      const failure = new Error('database unavailable');
      lookup.findActiveSessionUser.mockRejectedValue(failure);

      await expect(run(guard, sign(CURRENT_KEY))).rejects.toBe(failure);
    });
  });

  describe.each([
    ['an empty-string', ''],
    ['an undefined', undefined],
  ])('with an empty CITADEL_PLACEHOLDER_SECRET_KEY and %s JwtService secret', (_label, jwtSecret) => {
    let guard: JwtGuard;

    beforeEach(() => {
      guard = buildGuard({ CITADEL_PLACEHOLDER_SECRET_KEY: '' }, lookupReturning(), jwtSecret);
    });

    it('rejects a token signed with some other key', async () => {
      await expect(run(guard, sign('some-other-key'))).rejects.toThrow(INVALID);
    });

    it('rejects an unsigned alg:none token', async () => {
      await expect(run(guard, unsigned())).rejects.toThrow(INVALID);
    });

    it('rejects an HS256 token signed with an empty-string secret', async () => {
      await expect(run(guard, signedWithEmptySecret())).rejects.toThrow(INVALID);
    });
  });

  describe('on a @Public() route', () => {
    it('allows the request without verifying anything or calling the lookup', async () => {
      const lookup = lookupReturning();
      const verify = jest.spyOn(JwtService.prototype, 'verify');
      const guard = buildGuard({}, lookup, CURRENT_KEY, true);

      await expect(guard.canActivate(contextFor({ cookies: {} }))).resolves.toBe(true);
      expect(verify).not.toHaveBeenCalled();
      expect(lookup.findActiveSessionUser).not.toHaveBeenCalled();
      verify.mockRestore();
    });
  });
});
