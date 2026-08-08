import FormFieldsHelper from './FormFieldsHelper.jsx';

const PROFILE_FIELDS = [
  ['username', 'text', 'Username (leave blank to keep current)'],
  ['email', 'email', 'Email (leave blank to keep current)'],
];

const PASSWORD_FIELDS = [
  ['newPassword', 'password', 'New password'],
  ['newPasswordConfirmation', 'password', 'Confirm new password'],
];

/**
 * Shared rendering helper for the account-edit pages (My Account and Admin User Edit): the
 * page container, heading, form with submit-error / success alerts, the username/email fields,
 * the change-password section and the save action. Page-specific copy, input-id prefix and any
 * extra leading password fields are supplied through `options`.
 */
const AccountEditFormHelper = {
  /**
   * Render an account-edit page.
   *
   * @param {{username: string, email: string, newPassword: string,
   *   newPasswordConfirmation: string, fieldErrors: object, submitError: (string|null),
   *   success: boolean}} state - Page state (plus any extra fields named in
   *   `options.leadingPasswordFields`).
   * @param {{onSubmit: Function, onChange: Function}} handlers - Event handlers; `onChange` is
   *   curried by field name.
   * @param {{heading: string, successMessage: string, idPrefix: string,
   *   leadingPasswordFields: (Array<Array<string>>|undefined)}} options - Page-specific
   *   heading, success message, input-id prefix (used verbatim, so it includes any trailing
   *   `-`) and optional `[name, type, label]` fields rendered in the "Change password" section
   *   before the new-password fields.
   * @returns {React.ReactElement} The rendered account-edit page.
   */
  render(state, handlers, options) {
    const { heading, successMessage, idPrefix, leadingPasswordFields = [] } = options;
    const renderField = ([name, type, label]) => FormFieldsHelper.renderField(
      name, type, label, state, handlers.onChange(name), idPrefix,
    );

    return (
      <div className="container mt-4">
        <h1>{heading}</h1>
        <form onSubmit={handlers.onSubmit} noValidate>
          {FormFieldsHelper.renderSubmitError(state)}
          {FormFieldsHelper.renderSuccess(state, successMessage)}
          {PROFILE_FIELDS.map(renderField)}
          <hr />
          <h2 className="h5">Change password</h2>
          {leadingPasswordFields.map(renderField)}
          {PASSWORD_FIELDS.map(renderField)}
          <button type="submit" className="btn btn-primary">Save</button>
        </form>
      </div>
    );
  },
};

export default AccountEditFormHelper;
