import { useMemo, useState } from 'react';
import useOwnerContext from '../../../common/ownerContext/hooks/useOwnerContext.js';
import OrganizationNewController from './controllers/OrganizationNewController.js';
import OrganizationFormHelper from './helpers/OrganizationFormHelper.jsx';

const OPTIONS = { heading: 'Create organization', submitLabel: 'Create', idPrefix: 'org-new-' };

/**
 * Create organization page (`#/orgs/new`): a name form creating an organization owned by the
 * user, then going to its overview.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function OrganizationNew() {
  const { refreshOrgs } = useOwnerContext();
  const [name, setName] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [pending, setPending] = useState(false);
  const controller = useMemo(() => new OrganizationNewController({
    setFieldErrors, setSubmitError, setPending, refreshOrgs,
  }), [refreshOrgs]);

  const handlers = {
    onChange: (event) => setName(event.target.value),
    onSubmit: (event) => {
      event.preventDefault();
      return controller.handleSubmit({ name });
    },
  };

  return OrganizationFormHelper.render({
    name, fieldErrors, submitError, pending,
  }, handlers, OPTIONS);
}
