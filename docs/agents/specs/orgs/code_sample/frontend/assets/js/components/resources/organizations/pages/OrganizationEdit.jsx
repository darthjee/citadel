import { useEffect, useMemo, useState } from 'react';
import useOwnerContext from '../../../common/ownerContext/hooks/useOwnerContext.js';
import NotFound from '../../../common/notFound/NotFound.jsx';
import PermissionDenied from '../../../common/PermissionDenied.jsx';
import { ACTIONS, can } from '../../../../utils/permissions/orgPermissions.js';
import OrganizationLoader, { buildOrganizationLoadEffect } from './controllers/OrganizationLoader.js';
import OrganizationEditController from './controllers/OrganizationEditController.js';
import OrganizationFormHelper from './helpers/OrganizationFormHelper.jsx';

const OPTIONS = { heading: 'Rename organization', submitLabel: 'Save', idPrefix: 'org-edit-' };

/**
 * Rename organization page (`#/orgs/:orgId/edit`): prefilled from a fetch on visit; saving goes
 * back to the overview. A `404` (on load or save) shows the Not-found view. A role that may not
 * rename the organization sees the permission message; nothing is rendered while the role is
 * not yet known.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function OrganizationEdit() {
  const { context, refreshOrgs, role } = useOwnerContext();
  const [name, setName] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [pending, setPending] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const loader = useMemo(() => new OrganizationLoader(), []);
  const controller = useMemo(() => new OrganizationEditController({
    setFieldErrors, setSubmitError, setPending, refreshOrgs, onNotFound: () => setNotFound(true),
  }), [refreshOrgs]);
  const { orgId } = context;

  useEffect(() => buildOrganizationLoadEffect(loader, orgId, {
    onLoaded: (org) => setName(org.name),
    onNotFound: () => setNotFound(true),
    onError: setSubmitError,
  })(), [loader, orgId]);

  if (notFound) {
    return <NotFound orgId={orgId} />;
  }

  if (role === null) {
    return null;
  }

  if (!can(role, ACTIONS.RENAME_ORGANIZATION)) {
    return <PermissionDenied />;
  }

  const handlers = {
    onChange: (event) => setName(event.target.value),
    onSubmit: (event) => {
      event.preventDefault();
      return controller.handleSubmit(orgId, { name });
    },
  };

  return OrganizationFormHelper.render({
    name, fieldErrors, submitError, pending,
  }, handlers, OPTIONS);
}
