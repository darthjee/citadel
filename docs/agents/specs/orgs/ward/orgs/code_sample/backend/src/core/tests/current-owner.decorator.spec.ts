import { ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import { getCurrentOwner } from '../current-owner.decorator.js';
import type { OwnerContext } from '../owner-context.js';

function contextFor(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

describe('getCurrentOwner', () => {
  describe('when the guard resolved an owner context', () => {
    it.each<OwnerContext>([
      { kind: 'user', userId: 7 },
      { kind: 'organization', organizationId: 3, role: 'admin' },
    ])('returns %p unchanged', (ownerContext) => {
      expect(getCurrentOwner(undefined, contextFor({ ownerContext }))).toBe(ownerContext);
    });
  });

  describe('when the request has no owner context', () => {
    it('throws', () => {
      expect(() => getCurrentOwner(undefined, contextFor({}))).toThrow(InternalServerErrorException);
    });
  });
});
