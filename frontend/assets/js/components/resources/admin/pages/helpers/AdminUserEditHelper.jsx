import AccountEditFormHelper from '../../../../common/forms/helpers/AccountEditFormHelper.jsx';

/**
 * Rendering helper for the Admin User Edit page.
 */
const AdminUserEditHelper = {
  /**
   * Render the Admin User Edit page: editable username/email fields, a change-password
   * section, a save action, and inline error/success display. Unlike `MyAccountHelper`, there is
   * no current-password field — this page is admin-only and ungated. The shared markup is
   * rendered by {@link AccountEditFormHelper}.
   *
   * @param {{username: string, email: string, newPassword: string,
   *   newPasswordConfirmation: string, fieldErrors: object, submitError: (string|null),
   *   success: boolean}} state - Page state.
   * @param {{onSubmit: Function, onChange: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The rendered Admin User Edit page.
   */
  render(state, handlers) {
    return AccountEditFormHelper.render(state, handlers, {
      heading: 'Edit User',
      successMessage: 'User updated.',
      idPrefix: 'admin-user-edit-',
    });
  },
};

export default AdminUserEditHelper;
