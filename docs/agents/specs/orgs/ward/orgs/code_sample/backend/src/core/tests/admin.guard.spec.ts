import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminGuard } from '../admin.guard.js';

function contextFor(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: AdminGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new AdminGuard(reflector as unknown as Reflector);
  });

  describe('when the route has no @AdminOnly() metadata', () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockReturnValue(false);
    });

    it('returns true regardless of the user', () => {
      expect(guard.canActivate(contextFor(undefined))).toBe(true);
      expect(guard.canActivate(contextFor({ isAdmin: false }))).toBe(true);
    });
  });

  describe('when the route is @AdminOnly()', () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockReturnValue(true);
    });

    describe('and the user is an admin', () => {
      it('returns true', () => {
        expect(guard.canActivate(contextFor({ isAdmin: true }))).toBe(true);
      });
    });

    describe('and the user is not an admin', () => {
      it('throws ForbiddenException', () => {
        expect(() => guard.canActivate(contextFor({ isAdmin: false }))).toThrow(
          new ForbiddenException('Admin access required'),
        );
      });
    });

    describe('and there is no user (unauthenticated / @Public() route)', () => {
      it('throws ForbiddenException', () => {
        expect(() => guard.canActivate(contextFor(undefined))).toThrow(
          new ForbiddenException('Admin access required'),
        );
      });
    });
  });
});
