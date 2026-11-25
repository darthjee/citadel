import { useEffect, useMemo, useState } from 'react';
import useOwnerContext from '../../../common/ownerContext/hooks/useOwnerContext.js';
import useCan from '../../../common/ownerContext/hooks/useCan.js';
import { ACTIONS } from '../../../../utils/permissions/orgPermissions.js';
import NotFound from '../../../common/notFound/NotFound.jsx';
import OrganizationLoader, { buildOrganizationLoadEffect } from './controllers/OrganizationLoader.js';
import OrganizationOverviewHelper from './helpers/OrganizationOverviewHelper.jsx';

/**
 * Organization overview page (`#/orgs/:orgId`): fetched on each visit; shows the name, the user's
 * role and a Rename link (only for a role that may rename). A `404` shows the Not-found view (which forgets the stale id).
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function OrganizationOverview() {
  const { context } = useOwnerContext();
  const [org, setOrg] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const loader = useMemo(() => new OrganizationLoader(), []);
  const canRename = useCan(ACTIONS.RENAME_ORGANIZATION);
  const { orgId } = context;

  useEffect(() => buildOrganizationLoadEffect(loader, orgId, {
    onLoaded: setOrg,
    onNotFound: () => setNotFound(true),
    onError: setLoadError,
  })(), [loader, orgId]);

  if (notFound) {
    return <NotFound orgId={orgId} />;
  }

  return OrganizationOverviewHelper.render({
    org, loadError, context, canRename,
  });
}
