import ApiClient from './ApiClient.js';

/**
 * HTTP client for the organization endpoints (`/orgs.json`, `/orgs/:orgId.json`).
 *
 * @description Callers only pass an `orgId` taken from the validated active context; the client
 * reads no global state. Every method may resolve `undefined` when the session turned out to be
 * expired (see {@link ApiClient}).
 */
const OrganizationsClient = {
  /**
   * List the organizations the logged-in user belongs to.
   *
   * @returns {Promise<Array<object>|undefined>} The organizations, ordered by id.
   */
  async list() {
    return ApiClient.getJson('/orgs.json');
  },

  /**
   * Create an organization owned by the logged-in user.
   *
   * @param {string} name - The organization name.
   * @returns {Promise<object|undefined>} The created organization (`role: 'owner'`).
   */
  async create(name) {
    return ApiClient.postJson('/orgs.json', { name });
  },

  /**
   * Fetch one organization the logged-in user belongs to.
   *
   * @param {number} orgId - The organization id.
   * @returns {Promise<object|undefined>} The organization.
   */
  async show(orgId) {
    return ApiClient.getJson(`/orgs/${orgId}.json`);
  },

  /**
   * Rename an organization.
   *
   * @param {number} orgId - The organization id.
   * @param {string} name - The new organization name.
   * @returns {Promise<object|undefined>} The updated organization.
   */
  async rename(orgId, name) {
    return ApiClient.patchJson(`/orgs/${orgId}.json`, { name });
  },
};

export default OrganizationsClient;
