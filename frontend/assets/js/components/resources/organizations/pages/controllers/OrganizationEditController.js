import OrganizationFormController from './OrganizationFormController.js';
import { PERMISSION_DENIED_MESSAGE } from '../../../../common/PermissionDenied.jsx';

/**
 * Controller for the Rename organization page. A `404` on save shows the Not-found view; a
 * `403` shows the permission message.
 */
export default class OrganizationEditController extends OrganizationFormController {
  /**
   * Create an edit controller.
   *
   * @param {object} options - Same dependencies as {@link OrganizationFormController}, plus
   *   `onNotFound`, called on a `404`.
   */
  constructor(options) {
    super(options);
    this.onNotFound = options.onNotFound;
  }

  /**
   * Validate and rename the organization, then go back to its overview.
   *
   * @param {number} orgId - The organization id, from the validated active context.
   * @param {{name: string}} fields - Current form field values.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async handleSubmit(orgId, { name }) {
    await this.submitName(name, (trimmed) => this.client.rename(orgId, trimmed));
  }

  /**
   * Handle a failed request: a `404` shows Not-found, a `403` the permission message,
   * anything else the backend message.
   *
   * @param {Error & {status?: number}} error - The error thrown by the client.
   * @returns {void} Nothing.
   */
  handleSubmitError(error) {
    if (error.status === 404) {
      this.onNotFound();
      return;
    }

    if (error.status === 403) {
      this.setSubmitError(PERMISSION_DENIED_MESSAGE);
      this.setPending(false);
      return;
    }

    super.handleSubmitError(error);
  }
}
