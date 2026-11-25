import {
  ACTIONS,
  ROLES,
  can,
} from '../../../../../assets/js/utils/permissions/orgPermissions.js';

describe('orgPermissions', () => {
  describe('ROLES', () => {
    it('exposes the backend role values', () => {
      expect(ROLES).toEqual({ USER: 'user', ADMIN: 'admin', OWNER: 'owner' });
    });

    it('is frozen', () => {
      expect(Object.isFrozen(ROLES)).toBeTrue();
    });
  });

  describe('ACTIONS', () => {
    it('is frozen', () => {
      expect(Object.isFrozen(ACTIONS)).toBeTrue();
    });

    it('has distinct string values', () => {
      const values = Object.values(ACTIONS);

      values.forEach((value) => expect(typeof value).toBe('string'));
      expect(new Set(values).size).toBe(values.length);
    });
  });

  describe('can', () => {
    const MATRIX = [
      [ACTIONS.WRITE, { user: true, admin: true, owner: true }],
      [ACTIONS.RENAME_ORGANIZATION, { user: false, admin: true, owner: true }],
      [ACTIONS.DELETE, { user: false, admin: true, owner: true }],
    ];

    it('covers every action', () => {
      expect(MATRIX.map(([action]) => action).sort()).toEqual(Object.values(ACTIONS).sort());
    });

    MATRIX.forEach(([action, expected]) => {
      Object.values(ROLES).forEach((role) => {
        it(`returns ${expected[role]} for ${role} on ${action}`, () => {
          expect(can(role, action)).toBe(expected[role]);
        });
      });

      it(`returns false for a null role on ${action}`, () => {
        expect(can(null, action)).toBeFalse();
      });

      it(`returns false for an undefined role on ${action}`, () => {
        expect(can(undefined, action)).toBeFalse();
      });

      it(`returns false for an unknown role on ${action}`, () => {
        expect(can('superuser', action)).toBeFalse();
      });
    });

    it('returns false for an unknown action', () => {
      expect(can(ROLES.OWNER, 'launch_rockets')).toBeFalse();
    });
  });
});
