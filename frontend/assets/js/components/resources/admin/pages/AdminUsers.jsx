import { useMemo, useState } from 'react';
import AdminUsersController from './controllers/AdminUsersController.js';
import AdminUsersHelper from './helpers/AdminUsersHelper.jsx';

const INITIAL_QUERY = '';
const INITIAL_USERS = [];
const INITIAL_ROW_RESULTS = {};

/**
 * Admin Users page: staff-only tool to search user accounts and, for a given one, generate a
 * fresh recovery link or force-send the recovery email. Real access control is enforced by the
 * backend's `@AdminOnly()` guard — a `403` from any action redirects home (see
 * `AdminUsersController`) — this page merely isn't advertised to non-admins (see
 * `HeaderHelper`'s admin-only nav link).
 *
 * @returns {React.ReactElement} The rendered Admin Users page.
 */
export default function AdminUsers() {
  const [query, setQuery] = useState(INITIAL_QUERY);
  const [users, setUsers] = useState(INITIAL_USERS);
  const [rowResults, setRowResults] = useState(INITIAL_ROW_RESULTS);
  const [searchError, setSearchError] = useState(null);

  const controller = useMemo(
    () => new AdminUsersController(setUsers, setRowResults, setSearchError),
    [],
  );

  const handleQueryChange = (event) => setQuery(event.target.value);

  const handleSubmit = (event) => {
    event.preventDefault();
    return controller.handleSearch(query);
  };

  const handleGenerateLink = (userId) => () => controller.handleGenerateLink(userId);
  const handleSendEmail = (userId) => () => controller.handleSendEmail(userId);

  return AdminUsersHelper.render(
    {
      query, users, rowResults, searchError,
    },
    {
      onSubmit: handleSubmit,
      onQueryChange: handleQueryChange,
      onGenerateLink: handleGenerateLink,
      onSendEmail: handleSendEmail,
    },
  );
}
