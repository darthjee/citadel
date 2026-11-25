import { IsNull } from 'typeorm';
import { ownerRole, ownerSqlWhere, ownerWhere, type OwnerContext, type OwnerScope } from '../owner-context.js';

const PERSONAL: OwnerScope = { kind: 'user', userId: 7 };
const ORGANIZATION: OwnerScope = { kind: 'organization', organizationId: 3 };

describe('ownerWhere', () => {
  describe('for a user owner', () => {
    it('filters by the user and requires no organization', () => {
      expect(ownerWhere(PERSONAL)).toEqual({ userId: 7, organizationId: IsNull() });
    });
  });

  describe('for an organization owner', () => {
    it('filters by the organization and requires no user', () => {
      expect(ownerWhere(ORGANIZATION)).toEqual({
        userId: IsNull(),
        organizationId: 3,
      });
    });
  });
});

describe('ownerSqlWhere', () => {
  describe('for a user owner', () => {
    it('binds the user and requires no organization', () => {
      expect(ownerSqlWhere(PERSONAL, 'a')).toEqual({
        sql: 'a.user_id = ? AND a.organization_id IS NULL',
        params: [7],
      });
    });
  });

  describe('for an organization owner', () => {
    it('binds the organization and requires no user', () => {
      expect(ownerSqlWhere(ORGANIZATION, 'a')).toEqual({
        sql: 'a.user_id IS NULL AND a.organization_id = ?',
        params: [3],
      });
    });
  });

  describe('alias handling', () => {
    it('prefixes both columns with the given alias', () => {
      expect(ownerSqlWhere({ kind: 'user', userId: 1 }, 'bank_accounts').sql).toBe(
        'bank_accounts.user_id = ? AND bank_accounts.organization_id IS NULL',
      );
    });

    it('accepts underscores and digits after the first character', () => {
      expect(ownerSqlWhere({ kind: 'user', userId: 1 }, '_acc2').sql).toContain('_acc2.user_id');
    });

    it.each(['', '1a', 'a.b', 'a b', 'a; DROP TABLE x', 'a--', '`a`', 'a OR 1=1'])(
      'rejects the non-identifier alias %p',
      (alias) => {
        expect(() => ownerSqlWhere({ kind: 'user', userId: 1 }, alias)).toThrow('Invalid SQL alias');
      },
    );
  });
});

describe('ownerRole', () => {
  it('counts the personal context as owner', () => {
    expect(ownerRole({ kind: 'user', userId: 7 })).toBe('owner');
  });

  it.each(['owner', 'admin', 'user'] as const)('returns the organization membership role %p', (role) => {
    const ctx: OwnerContext = { kind: 'organization', organizationId: 3, role };

    expect(ownerRole(ctx)).toBe(role);
  });
});
