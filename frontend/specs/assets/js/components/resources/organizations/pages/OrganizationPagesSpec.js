import React from 'react';
import OrganizationNew from '../../../../../../../assets/js/components/resources/organizations/pages/OrganizationNew.jsx';
import OrganizationOverview from '../../../../../../../assets/js/components/resources/organizations/pages/OrganizationOverview.jsx';
import OrganizationEdit from '../../../../../../../assets/js/components/resources/organizations/pages/OrganizationEdit.jsx';
import OrganizationFormHelper from '../../../../../../../assets/js/components/resources/organizations/pages/helpers/OrganizationFormHelper.jsx';
import OrganizationOverviewHelper from '../../../../../../../assets/js/components/resources/organizations/pages/helpers/OrganizationOverviewHelper.jsx';
import OrganizationNewController from '../../../../../../../assets/js/components/resources/organizations/pages/controllers/OrganizationNewController.js';
import OrganizationEditController from '../../../../../../../assets/js/components/resources/organizations/pages/controllers/OrganizationEditController.js';
import {
  DEFAULT_OWNER_CONTEXT,
  OwnerContext,
} from '../../../../../../../assets/js/components/common/ownerContext/hooks/useOwnerContext.js';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';
import { itGatesThePageByRole } from '../../../../../../support/roleGatedPageExamples.js';

const ORG_CONTEXT = { kind: 'organization', orgId: 5 };

function inContext(Page, value = {}) {
  return () => React.createElement(
    OwnerContext.Provider,
    {
      value: {
        ...DEFAULT_OWNER_CONTEXT, context: ORG_CONTEXT, userId: 1, role: 'owner', ...value,
      },
    },
    React.createElement(Page),
  );
}

function capture(Page, Helper) {
  let captured;

  spyOn(Helper, 'render').and.callFake((state, handlers, options) => {
    captured = { state, handlers, options };
    return React.createElement('div');
  });
  renderedOutput(React.createElement(Page));

  return captured;
}

const fakeEvent = () => ({ preventDefault: jasmine.createSpy('preventDefault') });

describe('organization pages', () => {
  describe('OrganizationNew', () => {
    it('renders an empty, idle create form', () => {
      const page = renderedOutput(React.createElement(inContext(OrganizationNew)));

      expect(page.containsElement('h1', 'Create organization')).toBeTrue();
      expect(page.contains('disabled')).toBeFalse();
    });

    it('submits the current name through the controller', async () => {
      spyOn(OrganizationNewController.prototype, 'handleSubmit').and.resolveTo();
      const { handlers } = capture(inContext(OrganizationNew), OrganizationFormHelper);
      const event = fakeEvent();

      await handlers.onSubmit(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(OrganizationNewController.prototype.handleSubmit).toHaveBeenCalledWith({ name: '' });
    });
  });

  describe('OrganizationOverview', () => {
    it('renders the loading state for the context organization', () => {
      const { state } = capture(inContext(OrganizationOverview), OrganizationOverviewHelper);

      expect(state).toEqual({
        org: null, loadError: null, context: ORG_CONTEXT, canRename: true,
      });
    });

    ['owner', 'admin'].forEach((role) => {
      it(`allows an ${role} to rename`, () => {
        const { state } = capture(inContext(OrganizationOverview, { role }), OrganizationOverviewHelper);

        expect(state.canRename).toBeTrue();
      });
    });

    it('does not allow rename while the role is unknown', () => {
      const { state } = capture(inContext(OrganizationOverview, { role: null }), OrganizationOverviewHelper);

      expect(state.canRename).toBeFalse();
    });

    it('does not allow a user to rename', () => {
      const { state } = capture(inContext(OrganizationOverview, { role: 'user' }), OrganizationOverviewHelper);

      expect(state.canRename).toBeFalse();
    });
  });

  describe('OrganizationEdit', () => {
    itGatesThePageByRole({ Page: OrganizationEdit, Helper: OrganizationFormHelper, loadingWhileUnknown: false });

    it('renders the rename form', () => {
      const page = renderedOutput(React.createElement(inContext(OrganizationEdit)));

      expect(page.containsElement('h1', 'Rename organization')).toBeTrue();
      expect(page.containsAttribute('id', 'org-edit-name')).toBeTrue();
    });

    it('submits the context org id and the current name', async () => {
      spyOn(OrganizationEditController.prototype, 'handleSubmit').and.resolveTo();
      const { handlers } = capture(inContext(OrganizationEdit), OrganizationFormHelper);

      await handlers.onSubmit(fakeEvent());

      expect(OrganizationEditController.prototype.handleSubmit).toHaveBeenCalledWith(5, { name: '' });
    });

    it('wires the name field change handler', () => {
      const { handlers } = capture(inContext(OrganizationEdit), OrganizationFormHelper);

      expect(() => handlers.onChange({ target: { value: 'x' } })).not.toThrow();
    });
  });
});
