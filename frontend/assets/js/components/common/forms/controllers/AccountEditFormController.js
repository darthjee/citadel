import {
  validateEmail,
  validatePasswordLength,
  validatePasswordConfirmation,
} from '../../../../utils/validation/fieldValidators.js';

/**
 * Shared base class for the account-edit form controllers (My Account and Admin User Edit).
 * Holds the submit/validate/payload flow both pages have in common: validate the fields, skip
 * the API call when there are inline errors or nothing to update, submit only the fields the
 * user filled in, and reflect the backend's response (or its error) back into the form.
 * Subclasses supply the actual API call (via the `send` callback given to {@link #submit}) and
 * tailor behaviour by overriding the hook methods: `validate`, `buildPayload`,
 * `extractAccount`, `clearedFields` and `handleSubmitError`. Client-side validation never sends
 * a `newPasswordConfirmation` field to the backend; the match check happens here only.
 */
export default class AccountEditFormController {
  /**
   * Create an account-edit form controller.
   *
   * @param {Function} setFields - React state setter for the form's field values, used on a
   *   successful save to reflect the backend's authoritative username/email back into the form
   *   and clear the password fields.
   * @param {Function} setFieldErrors - React state setter for per-field validation errors.
   * @param {Function} setSubmitError - React state setter for the submit-time error message.
   * @param {Function} setSuccess - React state setter for the success confirmation flag.
   * @param {object} client - HTTP client used by the subclass to submit the form.
   */
  constructor(setFields, setFieldErrors, setSubmitError, setSuccess, client) {
    this.setFields = setFields;
    this.setFieldErrors = setFieldErrors;
    this.setSubmitError = setSubmitError;
    this.setSuccess = setSuccess;
    this.client = client;
  }

  /**
   * Run the shared submit flow: validate the fields, set inline errors and skip the API call
   * when validation fails, likewise when no field was actually filled in to update; otherwise
   * send the payload and either apply the response on success or report the failure.
   *
   * @description The concrete API call is delegated to `send`, so each subclass keeps its own
   *   public `handleSubmit` signature.
   * @param {object} fields - Current form field values.
   * @param {Function} send - Async callback receiving the built payload and resolving to the
   *   backend's response body (a falsy result is ignored).
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async submit(fields, send) {
    const errors = this.validate(fields);

    this.setFieldErrors(errors);
    this.setSuccess(false);

    if (Object.keys(errors).length > 0) {
      return;
    }

    const payload = this.buildPayload(fields);

    if (!this.hasUpdate(payload)) {
      this.setSubmitError('Provide a username, email, or new password to update.');
      return;
    }

    this.setSubmitError(null);
    await this.#send(payload, send);
  }

  /**
   * Validate the shared form fields: a non-blank email must be well-formed, and a non-blank new
   * password must meet the backend's minimum length and match its confirmation. Subclasses
   * extend this with their own rules.
   *
   * @param {{email: string, newPassword: string, newPasswordConfirmation: string}} fields -
   *   Current form field values.
   * @returns {object} A map of field name to error message, empty when the form is valid.
   */
  validate({ email, newPassword, newPasswordConfirmation }) {
    return {
      ...this.#validateEmail(email),
      ...this.#validateNewPassword(newPassword, newPasswordConfirmation),
    };
  }

  /**
   * Build the request body: `username`, `email`, and `newPassword` only when the user actually
   * filled them in — never a `newPasswordConfirmation` field. Subclasses extend this with
   * their own always-present fields.
   *
   * @param {{username: string, email: string, newPassword: string}} fields - Current form field
   *   values.
   * @returns {object} The request body containing only the filled-in fields.
   */
  buildPayload({ username, email, newPassword }) {
    return {
      ...(username && { username }),
      ...(email && { email }),
      ...(newPassword && { newPassword }),
    };
  }

  /**
   * Whether the payload carries at least one updatable field.
   *
   * @param {object} payload - The request body built by {@link buildPayload}.
   * @returns {boolean} `true` when `username`, `email`, or `newPassword` is present.
   */
  hasUpdate(payload) {
    return ('username' in payload) || ('email' in payload) || ('newPassword' in payload);
  }

  /**
   * Apply a successful save: reflect the backend's authoritative username/email back into the
   * form, clear the fields returned by {@link clearedFields} (never keep a submitted password
   * around), and flag the success confirmation.
   *
   * @param {object} result - The backend's response body.
   * @returns {void} Nothing.
   */
  applySuccess(result) {
    const { username, email } = this.extractAccount(result);

    this.setFields((current) => ({
      ...current,
      username,
      email,
      ...this.clearedFields(),
    }));
    this.setSuccess(true);
  }

  /**
   * Hook: pick the account (`username`/`email`) out of the backend's response body. Defaults to
   * the body itself; subclasses whose response nests the account override this.
   *
   * @param {{username: string, email: string}} result - The backend's response body.
   * @returns {{username: string, email: string}} The account's username and email.
   */
  extractAccount(result) {
    return result;
  }

  /**
   * Hook: the form fields to reset after a successful save. Defaults to the new-password
   * fields; subclasses add any other secret fields they hold.
   *
   * @returns {object} A map of field name to its cleared value.
   */
  clearedFields() {
    return { newPassword: '', newPasswordConfirmation: '' };
  }

  /**
   * Hook: handle an error thrown while submitting. Defaults to surfacing the error message as
   * the submit error; subclasses override for status-specific handling.
   *
   * @param {Error} error - The error thrown by the submit callback.
   * @returns {void} Nothing.
   */
  handleSubmitError(error) {
    this.setSubmitError(error.message);
  }

  async #send(payload, send) {
    try {
      const result = await send(payload);

      if (!result) {
        return;
      }

      this.applySuccess(result);
    } catch (error) {
      this.handleSubmitError(error);
    }
  }

  #validateEmail(email) {
    return email ? validateEmail(email) : {};
  }

  #validateNewPassword(newPassword, newPasswordConfirmation) {
    if (!newPassword) {
      return {};
    }

    const lengthErrors = validatePasswordLength(newPassword, 'newPassword');

    if (Object.keys(lengthErrors).length > 0) {
      return lengthErrors;
    }

    return validatePasswordConfirmation(
      newPassword,
      newPasswordConfirmation,
      'newPasswordConfirmation',
    );
  }
}
