import OrganizationFormController from './OrganizationFormController.js';

/**
 * Controller for the Create organization page.
 */
export default class OrganizationNewController extends OrganizationFormController {
  /**
   * Validate and create the organization, then go to its overview.
   *
   * @param {{name: string}} fields - Current form field values.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async handleSubmit({ name }) {
    await this.submitName(name, (trimmed) => this.client.create(trimmed));
  }
}
