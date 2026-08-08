import { useMemo } from 'react';
import useAccountEditForm from '../../../common/forms/hooks/useAccountEditForm.js';
import Router from '../../../../utils/routing/Router.js';
import AdminUserEditController from './controllers/AdminUserEditController.js';
import AdminUserEditHelper from './helpers/AdminUserEditHelper.jsx';

const INITIAL_FIELDS = {
  username: '',
  email: '',
  newPassword: '',
  newPasswordConfirmation: '',
};

/**
 * Read the current browser location hash, SSR/spec-safe.
 *
 * @returns {string} The current `window.location.hash`, or `''` when `window` is not defined
 *   (e.g. during a Node-based spec run).
 */
function currentHash() {
  return typeof window === 'undefined' ? '' : window.location.hash;
}

/**
 * Admin User Edit page: staff-only tool to update a target user's username, email, and/or
 * password, with no current-password check (matching #88's self-service plumbing but ungated).
 * The target user's id comes from the `:id` route param, not the logged-in session. Real access
 * control is enforced by the backend's `@AdminOnly()` guard — a `403` from the save action
 * redirects home (see `AdminUserEditController`) — this page merely isn't advertised to
 * non-admins (see `HeaderHelper`'s admin-only nav link).
 *
 * @returns {React.ReactElement} The rendered Admin User Edit page.
 */
export default function AdminUserEdit() {
  const userId = useMemo(
    () => Router.extractParams('/admin/users/:id/edit', currentHash()).id,
    [],
  );
  const { state, handlers } = useAccountEditForm({
    initialFields: INITIAL_FIELDS,
    createController: (...setters) => new AdminUserEditController(...setters),
    submit: (controller, fields) => controller.handleSubmit(userId, fields),
  });

  return AdminUserEditHelper.render(state, handlers);
}
