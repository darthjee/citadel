import AdminClient from '../../../../../client/AdminClient.js';
import AccountEditFormController from '../../../../common/forms/controllers/AccountEditFormController.js';
import { redirectIfForbidden } from '../../../../../utils/routing/redirects.js';

/**
 * Controller for the Admin User Edit page: lets an admin update a target user's username,
 * email, and/or password, with no current-password check (admin-only, ungated, matching #88's
 * self-service plumbing minus that gate). The shared submit/validate/payload flow lives in
 * {@link AccountEditFormController}; this class only adds the target `userId`, the nested
 * `{user}` response shape, and treats a `403` `ApiError` the same way `AdminUsersController`
 * does: redirect home, the fallback for this page being reached directly by hash despite the
 * current session not being an admin.
 */
export default class AdminUserEditController extends AccountEditFormController {
  /**
   * Create an Admin User Edit controller.
   *
   * @param {Function} setFields - React state setter for the form's field values, used on a
   *   successful save to reflect the backend's authoritative username/email back into the form
   *   and clear the password fields.
   * @param {Function} setFieldErrors - React state setter for per-field validation errors.
   * @param {Function} setSubmitError - React state setter for the submit-time error message.
   * @param {Function} setSuccess - React state setter for the success confirmation flag.
   * @param {typeof AdminClient} [client] - Admin HTTP client override, for testability.
   */
  constructor(setFields, setFieldErrors, setSubmitError, setSuccess, client = AdminClient) {
    super(setFields, setFieldErrors, setSubmitError, setSuccess, client);
  }

  /**
   * Validate and submit the Admin User Edit form for the given target user. Sets inline field
   * errors and skips the API call when validation fails, same as when no field was actually
   * filled in to update; on a clean form with at least one change, submits only the fields the
   * user filled in and either reflects the response's username/email back into the form and
   * clears the password fields on success, or sets a submit-error message on failure.
   *
   * @param {number} userId - The target user's numeric id, from the route param.
   * @param {{username: string, email: string, newPassword: string,
   *   newPasswordConfirmation: string}} fields - Current form field values.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async handleSubmit(userId, fields) {
    await this.submit(fields, (payload) => this.client.editUser(userId, payload));
  }

  /**
   * Pick the updated account out of the backend's `{user}` response body.
   *
   * @param {{user: {username: string, email: string}}} result - The backend's response body.
   * @returns {{username: string, email: string}} The account's username and email.
   */
  extractAccount({ user }) {
    return user;
  }

  /**
   * Handle a submit error: a `403` redirects home (the session is not an admin); anything else
   * is surfaced as the submit-error message.
   *
   * @param {Error & {status?: number}} error - The error thrown by the admin client.
   * @returns {void} Nothing.
   */
  handleSubmitError(error) {
    if (redirectIfForbidden(error)) {
      return;
    }

    super.handleSubmitError(error);
  }
}
