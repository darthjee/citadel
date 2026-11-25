import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { OwnerContext } from './hooks/useOwnerContext.js';
import OrgListController, { EMPTY_ORG_STATE, buildOrgListEffect } from './controllers/OrgListController.js';
import buildForbiddenRefreshEffect from './controllers/forbiddenRefreshEffect.js';
import { runEntryResolution, trackVisit } from '../../../utils/context/entryResolution.js';
import { ROLES } from '../../../utils/permissions/orgPermissions.js';

/**
 * Resolve the caller's role in the active context.
 *
 * @param {{kind: string, orgId?: number}} context - The active owner context.
 * @param {Array<object>} orgs - The loaded organization list (each entry carries a `role`).
 * @returns {string|null} `owner` in personal context, the org's role in an organization
 *   context, or `null` while the list is loading or when the org is not in the list.
 */
function resolveRole(context, orgs) {
  if (context.kind === 'personal') {
    return ROLES.OWNER;
  }

  const org = orgs.find((entry) => String(entry.id) === String(context.orgId));

  return org?.role ?? null;
}

/**
 * Build the provider value from the route and the org-list state.
 *
 * @param {{page: string, context: object}} route - The resolved route (the URL is the only
 *   source of the active context).
 * @param {{userId: (number|null), orgs: Array<object>, orgsLoaded: boolean,
 *   orgsError: (string|null)}} orgState - The org-list state.
 * @param {Function} refreshOrgs - Refetches the org list (also exposed as `refreshRole`).
 * @returns {object} The owner-context value, including the caller's `role` in the active
 *   context.
 */
export function buildOwnerContextValue(route, orgState, refreshOrgs) {
  return {
    context: route.context,
    page: route.page,
    userId: orgState.userId,
    orgs: orgState.orgs,
    orgsLoaded: orgState.orgsLoaded,
    orgsError: orgState.orgsError,
    refreshOrgs,
    role: resolveRole(route.context, orgState.orgs),
    refreshRole: refreshOrgs,
  };
}

/**
 * Provides the active owner context, the user id and the organization list to the page tree.
 *
 * @description Loads the org list once per session (via {@link OrgListController}), runs entry
 * resolution after each session's first load, refreshes the list (and so the caller's role)
 * whenever the API answers `403 Forbidden`, and remembers the context of every visited
 * context-aware page.
 * @param {object} props - Component props.
 * @param {{page: string, context: object}} props.route - The resolved route.
 * @param {React.ReactNode} props.children - The page tree.
 * @returns {React.ReactElement} The provider.
 */
export default function OwnerContextProvider({ route, children }) {
  const [orgState, setOrgState] = useState(EMPTY_ORG_STATE);
  const controller = useMemo(
    () => new OrgListController(setOrgState, { onSessionLoaded: (state) => runEntryResolution(state) }),
    [],
  );
  const refreshOrgs = useCallback(() => controller.refresh(), [controller]);

  useEffect(() => buildOrgListEffect(controller)(), [controller]);
  useEffect(() => buildForbiddenRefreshEffect(refreshOrgs)(), [refreshOrgs]);
  useEffect(() => trackVisit(route, orgState.userId), [route, orgState.userId]);

  const value = useMemo(
    () => buildOwnerContextValue(route, orgState, refreshOrgs),
    [route, orgState, refreshOrgs],
  );

  return <OwnerContext.Provider value={value}>{children}</OwnerContext.Provider>;
}
