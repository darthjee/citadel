import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AccessTokenPayload } from '../access-token-payload.js';
import { getCurrentUser } from '../current-user.decorator.js';

function contextFor(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

describe('getCurrentUser', () => {
  describe('when the request has an authenticated user', () => {
    const user: AccessTokenPayload = { sub: 1, username: 'darthjee', isAdmin: false };

    it('returns the user unchanged', () => {
      expect(getCurrentUser(undefined, contextFor({ user }))).toBe(user);
    });
  });

  describe('when the request has no authenticated user', () => {
    it('throws UnauthorizedException', () => {
      expect(() => getCurrentUser(undefined, contextFor({}))).toThrow(
        new UnauthorizedException('Missing authenticated user'),
      );
    });
  });
});
