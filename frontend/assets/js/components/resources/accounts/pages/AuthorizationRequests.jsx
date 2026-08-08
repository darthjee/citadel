import { useEffect, useMemo, useState } from 'react';
import AuthorizationRequestsController from './controllers/AuthorizationRequestsController.js';
import AuthorizationRequestsHelper from './helpers/AuthorizationRequestsHelper.jsx';

const INITIAL_REQUESTS = [];
const INITIAL_ROW_STATE = new Map();

/**
 * Build the mount-time load effect: triggers `controller.load()` once, unconditionally — no
 * session/login check of any kind, since a logged-out `401` is handled entirely by
 * `ApiClient`'s existing refresh/login-modal flow. Extracted as a plain function, separate from
 * the `useEffect` call itself, so it can be exercised directly in tests without a React
 * renderer — mirroring {@link module:components/AppController}'s `buildEffect()`.
 *
 * @param {AuthorizationRequestsController} controller - The page's controller.
 * @returns {Function} Effect callback.
 */
export function buildLoadEffect(controller) {
  return () => {
    controller.load();
  };
}

/**
 * Authorization Requests page: lists the caller's own open authorization requests (opened by
 * another device attempting to log in as them) and lets them approve, with their password, or
 * deny each one. Performs no client-side login check of its own — `load()` always fires, and a
 * logged-out `401` is handled entirely by `ApiClient`'s existing refresh/login-modal flow.
 *
 * @returns {React.ReactElement} The rendered Authorization Requests page.
 */
export default function AuthorizationRequests() {
  const [requests, setRequests] = useState(INITIAL_REQUESTS);
  const [loadError, setLoadError] = useState(null);
  const [rowState, setRowState] = useState(INITIAL_ROW_STATE);

  const controller = useMemo(
    () => new AuthorizationRequestsController(setRequests, setLoadError, setRowState),
    [],
  );

  useEffect(() => buildLoadEffect(controller)(), [controller]);

  const handleToggleAuthorize = (uuid) => () => controller.patchRow(
    uuid,
    { open: !(rowState.get(uuid)?.open ?? false) },
  );

  const handlePasswordChange = (uuid) => (event) => controller.patchRow(
    uuid,
    { password: event.target.value },
  );

  const handleConfirmAuthorize = (uuid) => (event) => {
    event.preventDefault();
    return controller.authorize(uuid, rowState.get(uuid)?.password ?? '');
  };

  const handleDeny = (uuid) => () => controller.deny(uuid);

  return AuthorizationRequestsHelper.render(
    { requests, loadError, rowState },
    {
      onToggleAuthorize: handleToggleAuthorize,
      onPasswordChange: handlePasswordChange,
      onConfirmAuthorize: handleConfirmAuthorize,
      onDeny: handleDeny,
    },
  );
}
