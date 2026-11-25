# Organization pages

Move the organization pages from
`docs/agents/specs/orgs/code_sample/frontend/assets/js/components/resources/organizations/pages/` to
`frontend/assets/js/components/resources/organizations/pages/`, unchanged apart from comments. Every
import they need already exists in citadel:

- `useOwnerContext` and `useCan`;
- `orgPermissions` (`ACTIONS.RENAME_ORGANIZATION`);
- `OrganizationsClient`;
- `isSessionExpired`;
- `ownerContext` (`landingFor`, `organizationContext`, `contextHash`);
- `FormFieldsHelper` (`renderField`, `renderSubmitError`);
- `validateOrganizationName` (from step 01), plus `NotFound` and `PermissionDenied`.

Files to move:

- Pages: `OrganizationNew.jsx`, `OrganizationOverview.jsx`, `OrganizationEdit.jsx`.
- `controllers/`:
  - `OrganizationFormController.js`: the shared submit flow. It validates, toggles `pending`, then
    runs `refreshOrgs()` and navigates to `landingFor(organizationContext(org.id))`. On a failure it
    shows the message, except for a session-expired rejection, which only resets `pending`.
  - `OrganizationNewController.js`.
  - `OrganizationEditController.js`: a `404` calls `onNotFound`; a `403` sets
    `PERMISSION_DENIED_MESSAGE`.
  - `OrganizationLoader.js`, with `buildOrganizationLoadEffect`.
  - `navigation.js`.
- `helpers/`: `OrganizationFormHelper.jsx` and `OrganizationOverviewHelper.jsx`.

Behaviour to keep:

- `OrganizationEdit` renders nothing while `role === null` and `PermissionDenied` when
  `!can(role, ACTIONS.RENAME_ORGANIZATION)`.
- The overview shows the Rename link only when `useCan(ACTIONS.RENAME_ORGANIZATION)` is true.
- A `404` on load or save renders `<NotFound orgId={orgId} />`.

Specs:

- Move the 5 sample specs from `code_sample/frontend/specs/.../organizations/pages/`, adapting import
  paths, and compare them against ward's copies, keeping the more complete one:
  - `OrganizationNewControllerSpec.js`, `OrganizationEditControllerSpec.js`, `OrganizationLoaderSpec.js`;
  - `OrganizationFormHelperSpec.js`, `OrganizationOverviewHelperSpec.js`.
- Port ward's `OrganizationPagesSpec.js`, which covers the page wiring and the role gating. Port the
  support file it uses, `specs/support/roleGatedPageExamples.js`, which citadel does not have yet. Its
  imports (`renderedOutput`, `fakeWindow`, `PermissionDenied`, the owner-context hook) all exist after
  step 01.
- If the controller specs do not already cover the shared `OrganizationFormController` paths, add them:
  - validation errors stop the request;
  - `pending` is toggled;
  - `refreshOrgs` runs before navigation;
  - a session-expired error shows no message.

  `navigation.js` is covered through the injected `navigate` or through `fakeWindow`.
- Delete every sample file moved here, specs included.

## Files to Change

- `frontend/assets/js/components/resources/organizations/pages/OrganizationNew.jsx`: new.
- `frontend/assets/js/components/resources/organizations/pages/OrganizationOverview.jsx`: new.
- `frontend/assets/js/components/resources/organizations/pages/OrganizationEdit.jsx`: new.
- `frontend/assets/js/components/resources/organizations/pages/controllers/{OrganizationFormController,OrganizationNewController,OrganizationEditController,OrganizationLoader,navigation}.js`:
  new.
- `frontend/assets/js/components/resources/organizations/pages/helpers/{OrganizationFormHelper,OrganizationOverviewHelper}.jsx`:
  new.
- `frontend/specs/assets/js/components/resources/organizations/pages/controllers/*Spec.js`: new (from
  the sample and ward).
- `frontend/specs/assets/js/components/resources/organizations/pages/helpers/*Spec.js`: new (from the
  sample and ward).
- `frontend/specs/assets/js/components/resources/organizations/pages/OrganizationPagesSpec.js`: new
  (from ward).
- `frontend/specs/support/roleGatedPageExamples.js`: new (from ward).
- Delete `docs/agents/specs/orgs/code_sample/frontend/assets/js/components/resources/` and
  `docs/agents/specs/orgs/code_sample/frontend/specs/`.
