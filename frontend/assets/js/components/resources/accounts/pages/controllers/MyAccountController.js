import AccountsClient from '../../../../../client/AccountsClient.js';
import AccountEditFormController from '../../../../common/forms/controllers/AccountEditFormController.js';

/**
 * Controller for the "My account" page: lets the logged-in user update their username, email,
 * and/or password, always confirmed by their current password. There is currently no "get my
 * account" read endpoint, so the username/email fields start blank — leaving one blank means
 * "keep the current value", not "clear it" (prefilling them is a follow-up, once such a read
 * endpoint exists). The shared submit/validate/payload flow lives in
 * {@link AccountEditFormController}; this class only adds the current-password specifics.
 */
export default class MyAccountController extends AccountEditFormController {
  /**
   * Create a My Account controller.
   *
   * @param {Function} setFields - React state setter for the form's field values, used on a
   *   successful save to reflect the backend's authoritative username/email back into the form
   *   and clear the password fields.
   * @param {Function} setFieldErrors - React state setter for per-field validation errors.
   * @param {Function} setSubmitError - React state setter for the submit-time error message.
   * @param {Function} setSuccess - React state setter for the success confirmation flag.
   * @param {typeof AccountsClient} [client] - Accounts HTTP client override, for testability.
   */
  constructor(setFields, setFieldErrors, setSubmitError, setSuccess, client = AccountsClient) {
    super(setFields, setFieldErrors, setSubmitError, setSuccess, client);
  }

  /**
   * Validate and submit the My Account form. Sets inline field errors and skips the API call
   * when validation fails, same as when no field was actually filled in to update; on a clean
   * form with at least one change, submits only the fields the user filled in (plus the
   * always-required current password) and either reflects the response's username/email back
   * into the form and clears the password fields on success, or sets a submit-error message on
   * failure.
   *
   * @param {{username: string, email: string, currentPassword: string, newPassword: string,
   *   newPasswordConfirmation: string}} fields - Current form field values.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async handleSubmit(fields) {
    await this.submit(fields, (payload) => this.client.updateAccount(payload));
  }

  /**
   * Validate the My Account form fields: the current password is always required, on top of the
   * shared email and new-password rules.
   *
   * @param {{email: string, currentPassword: string, newPassword: string,
   *   newPasswordConfirmation: string}} fields - Current form field values.
   * @returns {object} A map of field name to error message, empty when the form is valid.
   */
  validate(fields) {
    return {
      ...this.#validateCurrentPassword(fields.currentPassword),
      ...super.validate(fields),
    };
  }

  /**
   * Build the PATCH request body: the always-required current password, plus the shared
   * filled-in `username`, `email`, and `newPassword` fields — never a `newPasswordConfirmation`
   * field.
   *
   * @param {{username: string, email: string, currentPassword: string,
   *   newPassword: string}} fields - Current form field values.
   * @returns {object} The request body for {@link AccountsClient.updateAccount}.
   */
  buildPayload(fields) {
    return {
      currentPassword: fields.currentPassword,
      ...super.buildPayload(fields),
    };
  }

  /**
   * Also clear the current password after a successful save, on top of the new-password fields.
   *
   * @returns {object} A map of field name to its cleared value.
   */
  clearedFields() {
    return { currentPassword: '', ...super.clearedFields() };
  }

  #validateCurrentPassword(currentPassword) {
    return currentPassword ? {} : { currentPassword: 'Current password is required' };
  }
}
