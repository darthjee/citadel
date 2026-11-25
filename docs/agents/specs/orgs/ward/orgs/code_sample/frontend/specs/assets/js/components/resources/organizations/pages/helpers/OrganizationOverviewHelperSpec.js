import React from 'react';
import OrganizationOverviewHelper from '../../../../../../../../assets/js/components/resources/organizations/pages/helpers/OrganizationOverviewHelper.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

const CONTEXT = { kind: 'organization', orgId: 5 };

describe('OrganizationOverviewHelper', () => {
  const output = (state) => renderedOutput(React.createElement(
    'div', null, OrganizationOverviewHelper.render({
      org: null, loadError: null, context: CONTEXT, canRename: true, ...state,
    }),
  ));

  it('renders the name, role and Rename link', () => {
    const page = output({ org: { id: 5, name: 'Acme', role: 'admin' } });

    expect(page.containsElement('h1', 'Acme')).toBeTrue();
    expect(page.contains('admin')).toBeTrue();
    expect(page.containsAttribute('href', '#/orgs/5/edit')).toBeTrue();
    expect(page.contains('Rename')).toBeTrue();
  });

  it('hides the Rename link without the rename permission, keeping the name and role', () => {
    const page = output({ org: { id: 5, name: 'Acme', role: 'user' }, canRename: false });

    expect(page.containsElement('h1', 'Acme')).toBeTrue();
    expect(page.contains('user')).toBeTrue();
    expect(page.containsAttribute('href', '#/orgs/5/edit')).toBeFalse();
    expect(page.contains('Rename')).toBeFalse();
  });

  it('escapes the name', () => {
    const page = output({ org: { id: 5, name: '<script>alert(1)</script>', role: 'owner' } });

    expect(page.containsTag('script')).toBeFalse();
    expect(page.contains('&lt;script&gt;alert(1)&lt;/script&gt;')).toBeTrue();
  });

  it('renders a loading notice before the answer', () => {
    expect(output({}).contains('Loading')).toBeTrue();
  });

  it('renders a load error', () => {
    expect(output({ loadError: 'boom' }).contains('boom')).toBeTrue();
  });
});
