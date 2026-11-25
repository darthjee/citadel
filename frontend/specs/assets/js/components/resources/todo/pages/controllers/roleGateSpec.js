import roleGate from '../../../../../../../../assets/js/components/resources/todo/pages/controllers/roleGate.js';
import { ACTIONS } from '../../../../../../../../assets/js/utils/permissions/orgPermissions.js';

describe('roleGate', () => {
  it('is null while the role is unknown', () => {
    expect(roleGate(null, ACTIONS.MANAGE_LISTS)).toBeNull();
  });

  it('denies a user from managing lists', () => {
    expect(roleGate('user', ACTIONS.MANAGE_LISTS)).toBeFalse();
  });

  it('allows an admin to manage lists', () => {
    expect(roleGate('admin', ACTIONS.MANAGE_LISTS)).toBeTrue();
  });
});
