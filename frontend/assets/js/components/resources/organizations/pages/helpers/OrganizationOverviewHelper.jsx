import { contextHash } from '../../../../../utils/context/ownerContext.js';

/**
 * Render the Rename link, offered only to a role that may rename the organization.
 *
 * @param {object} context - The active owner context.
 * @param {boolean} canRename - Whether the caller's role may rename the organization.
 * @returns {React.ReactElement|null} The link, or `null`.
 */
function renderRename(context, canRename) {
  if (!canRename) {
    return null;
  }

  return <a className="btn btn-outline-primary" href={contextHash(context, '/edit')}>Rename</a>;
}

/**
 * Render the loaded organization: name, the user's role and the Rename link (when allowed).
 *
 * @param {object} org - The organization.
 * @param {object} context - The active owner context.
 * @param {boolean} canRename - Whether the caller's role may rename the organization.
 * @returns {React.ReactElement} The organization details.
 */
function renderOrganization(org, context, canRename) {
  return (
    <>
      <h1 className="text-break">{org.name}</h1>
      <p>
        Your role:
        {' '}
        <span className="badge text-bg-secondary">{org.role}</span>
      </p>
      {renderRename(context, canRename)}
    </>
  );
}

/**
 * Render the body: an error, the organization, or a loading notice.
 *
 * @param {{org: (object|null), loadError: (string|null), context: object,
 *   canRename: boolean}} state - Page state.
 * @returns {React.ReactElement} The page body.
 */
function renderBody({
  org, loadError, context, canRename,
}) {
  if (loadError) {
    return <div className="alert alert-danger">{loadError}</div>;
  }

  if (!org) {
    return <p className="text-muted">Loading…</p>;
  }

  return renderOrganization(org, context, canRename);
}

/**
 * Rendering helper for the organization overview page.
 */
const OrganizationOverviewHelper = {
  /**
   * Render the organization overview.
   *
   * @param {{org: (object|null), loadError: (string|null), context: object,
   *   canRename: boolean}} state - The loaded organization, the load error, the active owner
   *   context and whether the caller's role may rename the organization.
   * @returns {React.ReactElement} The rendered overview.
   */
  render(state) {
    return <div className="container mt-4">{renderBody(state)}</div>;
  },
};

export default OrganizationOverviewHelper;
