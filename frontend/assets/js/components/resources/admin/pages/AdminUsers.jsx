import { useMemo, useState } from 'react';
import AdminUsersController from './controllers/AdminUsersController.js';
import AdminUsersHelper from './helpers/AdminUsersHelper.jsx';

const INITIAL_QUERY = '';
const INITIAL_STATUS = '';
const INITIAL_USERS = [];
const INITIAL_ROW_RESULTS = {};

/**
 * Admin Users page: staff-only tool to search user accounts (optionally filtered by approval
 * status) and, for a given one, approve or deny it, generate a fresh recovery link or
 * force-send the recovery email. Real access control is enforced by the
 * backend's `@AdminOnly()` guard — a `403` from any action redirects home (see
 * `AdminUsersController`) — this page merely isn't advertised to non-admins (see
 * `HeaderHelper`'s admin-only nav link).
 *
 * @returns {React.ReactElement} The rendered Admin Users page.
 */
export default function AdminUsers() {
  const [query, setQuery] = useState(INITIAL_QUERY);
  const [status, setStatus] = useState(INITIAL_STATUS);
  const [users, setUsers] = useState(INITIAL_USERS);
  const [rowResults, setRowResults] = useState(INITIAL_ROW_RESULTS);
  const [searchError, setSearchError] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  const controller = useMemo(
    () => new AdminUsersController({
      setUsers, setCurrentUserId, setRowResults, setSearchError,
    }),
    [],
  );

  const handleQueryChange = (event) => setQuery(event.target.value);
  const handleStatusChange = (event) => setStatus(event.target.value);

  const handleSubmit = (event) => {
    event.preventDefault();
    return controller.handleSearch(query, status || undefined);
  };

  const handleGenerateLink = (userId) => () => controller.handleGenerateLink(userId);
  const handleSendEmail = (userId) => () => controller.handleSendEmail(userId);
  const handleApprove = (userId) => () => controller.handleApprove(userId);
  const handleDeny = (userId) => () => controller.handleDeny(userId);

  return AdminUsersHelper.render(
    {
      query, status, users, rowResults, searchError, currentUserId,
    },
    {
      onSubmit: handleSubmit,
      onQueryChange: handleQueryChange,
      onStatusChange: handleStatusChange,
      onGenerateLink: handleGenerateLink,
      onSendEmail: handleSendEmail,
      onApprove: handleApprove,
      onDeny: handleDeny,
    },
  );
}
