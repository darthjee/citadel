import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MIN_ORG_ROLE_KEY } from '../min-org-role.decorator.js';
import { OrgRole } from '../org-role.js';
import type { OrganizationMembershipLookup } from '../organization-membership-lookup.js';
import { OwnerContextGuard } from '../owner-context.guard.js';
import { IS_OWNER_SCOPED_KEY } from '../owner-scoped.decorator.js';
import { ownerNotFound } from '../parse-org-id.js';

interface FakeRequest {
  user?: { sub: number; isAdmin: boolean };
  params?: Record<string, string>;
  ownerContext?: unknown;
}

function contextFor(request: FakeRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  throw new Error('expected a rejection');
}

describe('OwnerContextGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let lookup: { findRole: jest.Mock };
  let guard: OwnerContextGuard;
  let metadata: Record<string, unknown>;

  beforeEach(() => {
    metadata = {};
    reflector = { getAllAndOverride: jest.fn((key: string) => metadata[key]) };
    lookup = { findRole: jest.fn() };
    guard = new OwnerContextGuard(reflector as unknown as Reflector, lookup as OrganizationMembershipLookup);
  });

  describe('when the route has no owner-scoped metadata', () => {
    beforeEach(() => {
      metadata[MIN_ORG_ROLE_KEY] = OrgRole.OWNER;
    });

    it('passes without resolving an owner', async () => {
      const request: FakeRequest = { params: { orgId: 'abc' } };

      await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
      expect(request.ownerContext).toBeUndefined();
      expect(lookup.findRole).not.toHaveBeenCalled();
    });
  });

  describe('when the route is owner-scoped', () => {
    beforeEach(() => {
      metadata[IS_OWNER_SCOPED_KEY] = true;
    });

    describe('on the personal prefix', () => {
      it('sets the JWT user as owner', async () => {
        const request: FakeRequest = { user: { sub: 7, isAdmin: false }, params: {} };

        await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
        expect(request.ownerContext).toEqual({ kind: 'user', userId: 7 });
        expect(lookup.findRole).not.toHaveBeenCalled();
      });

      it('also works when the request has no params object', async () => {
        const request: FakeRequest = { user: { sub: 7, isAdmin: false } };

        await guard.canActivate(contextFor(request));
        expect(request.ownerContext).toEqual({ kind: 'user', userId: 7 });
      });

      it.each([OrgRole.USER, OrgRole.ADMIN, OrgRole.OWNER])(
        'passes a @MinOrgRole(%p) route, counting as owner',
        async (min) => {
          metadata[MIN_ORG_ROLE_KEY] = min;
          const request: FakeRequest = { user: { sub: 7, isAdmin: false }, params: {} };

          await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
        },
      );
    });

    describe('on the organization prefix', () => {
      describe('and the user is a member', () => {
        it.each([OrgRole.USER, OrgRole.ADMIN, OrgRole.OWNER])(
          'sets the organization as owner with the looked-up %p role',
          async (role) => {
            lookup.findRole.mockResolvedValue(role);
            const request: FakeRequest = { user: { sub: 7, isAdmin: false }, params: { orgId: '3' } };

            await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
            expect(lookup.findRole).toHaveBeenCalledWith(7, 3);
            expect(request.ownerContext).toEqual({ kind: 'organization', organizationId: 3, role });
          },
        );

        it.each([OrgRole.USER, OrgRole.ADMIN, OrgRole.OWNER])(
          'passes a route without @MinOrgRole (reads) as %p',
          async (role) => {
            lookup.findRole.mockResolvedValue(role);
            const request: FakeRequest = { user: { sub: 7, isAdmin: false }, params: { orgId: '3' } };

            await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
          },
        );

        it.each([OrgRole.ADMIN, OrgRole.OWNER])('passes an admin route as %p', async (role) => {
          metadata[MIN_ORG_ROLE_KEY] = OrgRole.ADMIN;
          lookup.findRole.mockResolvedValue(role);
          const request: FakeRequest = { user: { sub: 7, isAdmin: false }, params: { orgId: '3' } };

          await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
        });

        it('forbids a user on an admin route with the uniform 403', async () => {
          metadata[MIN_ORG_ROLE_KEY] = OrgRole.ADMIN;
          lookup.findRole.mockResolvedValue(OrgRole.USER);
          const request: FakeRequest = { user: { sub: 7, isAdmin: false }, params: { orgId: '3' } };
          const error = await rejectionOf(guard.canActivate(contextFor(request)));

          expect(error).toBeInstanceOf(ForbiddenException);
          expect((error as ForbiddenException).getResponse()).toEqual({
            statusCode: 403,
            message: 'Forbidden',
          });
        });

        it('forbids an admin on an owner route, with no global-admin bypass', async () => {
          metadata[MIN_ORG_ROLE_KEY] = OrgRole.OWNER;
          lookup.findRole.mockResolvedValue(OrgRole.ADMIN);
          const request: FakeRequest = { user: { sub: 1, isAdmin: true }, params: { orgId: '3' } };

          await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(ForbiddenException);
        });
      });

      describe('and the user is not a member (or the organization is unknown)', () => {
        beforeEach(() => {
          lookup.findRole.mockResolvedValue(null);
        });

        it('throws the uniform 404', async () => {
          const request: FakeRequest = { user: { sub: 7, isAdmin: false }, params: { orgId: '3' } };
          const error = await rejectionOf(guard.canActivate(contextFor(request)));

          expect(error).toBeInstanceOf(NotFoundException);
          expect((error as NotFoundException).getResponse()).toEqual(ownerNotFound().getResponse());
          expect(request.ownerContext).toBeUndefined();
        });

        it('answers 404 before the role check', async () => {
          metadata[MIN_ORG_ROLE_KEY] = OrgRole.ADMIN;
          const request: FakeRequest = { user: { sub: 7, isAdmin: false }, params: { orgId: '3' } };
          const error = await rejectionOf(guard.canActivate(contextFor(request)));

          expect(error).toBeInstanceOf(NotFoundException);
          expect(reflector.getAllAndOverride).not.toHaveBeenCalledWith(MIN_ORG_ROLE_KEY, expect.anything());
        });

        it('gives a global admin no bypass', async () => {
          const request: FakeRequest = { user: { sub: 1, isAdmin: true }, params: { orgId: '3' } };
          const error = await rejectionOf(guard.canActivate(contextFor(request)));

          expect(lookup.findRole).toHaveBeenCalledWith(1, 3);
          expect((error as NotFoundException).getResponse()).toEqual(ownerNotFound().getResponse());
        });
      });

      describe('and the id is malformed', () => {
        it.each(['abc', '007', '-1', '1.5', '1e3', '99999999999'])(
          'throws the uniform 404 for %p without a lookup',
          async (orgId) => {
            const request: FakeRequest = { user: { sub: 7, isAdmin: false }, params: { orgId } };
            const error = await rejectionOf(guard.canActivate(contextFor(request)));

            expect((error as NotFoundException).getResponse()).toEqual(ownerNotFound().getResponse());
            expect(lookup.findRole).not.toHaveBeenCalled();
          },
        );
      });
    });

    describe('when there is no authenticated user', () => {
      it('throws the uniform 404', async () => {
        const request: FakeRequest = { params: {} };
        const error = await rejectionOf(guard.canActivate(contextFor(request)));

        expect((error as NotFoundException).getResponse()).toEqual(ownerNotFound().getResponse());
      });
    });
  });
});
