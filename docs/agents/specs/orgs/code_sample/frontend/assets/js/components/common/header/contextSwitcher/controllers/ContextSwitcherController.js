import ContextStorage from '../../../../../utils/context/ContextStorage.js';
import { landingFor } from '../../../../../utils/context/ownerContext.js';

/**
 * Navigate to a hash, SSR-safe.
 *
 * @param {string} hash - The hash to navigate to.
 * @returns {void} Nothing.
 */
function defaultNavigate(hash) {
  if (typeof window !== 'undefined') {
    window.location.hash = hash;
  }
}

/**
 * Controller for the header's context switcher: remembers the picked context, then navigates.
 */
export default class ContextSwitcherController {
  #storage;

  #navigate;

  /**
   * Create a switcher controller.
   *
   * @param {{storage: object, navigate: Function}} [deps] - Injectable dependencies (default:
   *   {@link ContextStorage} and setting `window.location.hash`).
   */
  constructor({ storage = ContextStorage, navigate = defaultNavigate } = {}) {
    this.#storage = storage;
    this.#navigate = navigate;
  }

  /**
   * Switch to a context: store it as the user's last context **before** navigating.
   *
   * @description Without an organization variant of the current page (every page so far), the
   * target is the context's landing. `switchTarget` is the hook for module pages (#49 onwards)
   * that keep the user on the same page in the other context.
   * @param {object} context - The picked owner context.
   * @param {number|null} userId - The logged-in user id.
   * @param {Function} [switchTarget] - Maps the picked context to the hash to navigate to.
   * @returns {string} The hash navigated to.
   */
  pick(context, userId, switchTarget = landingFor) {
    if (context.kind === 'organization') {
      this.#storage.rememberOrganization(userId, context.orgId);
    } else {
      this.#storage.rememberPersonal(userId);
    }

    const target = switchTarget(context);

    this.#navigate(target);

    return target;
  }
}
