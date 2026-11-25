import React from 'react';
import OrganizationFormHelper from '../../../../../../../../assets/js/components/resources/organizations/pages/helpers/OrganizationFormHelper.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

const OPTIONS = { heading: 'Create organization', submitLabel: 'Create', idPrefix: 'org-new-' };
const STATE = {
  name: '', fieldErrors: {}, submitError: null, pending: false,
};

describe('OrganizationFormHelper', () => {
  const handlers = { onSubmit: () => undefined, onChange: () => undefined };
  const output = (state) => renderedOutput(React.createElement(
    'div', null, OrganizationFormHelper.render({ ...STATE, ...state }, handlers, OPTIONS),
  ));

  it('renders the heading, the name field and the submit button', () => {
    const page = output({});

    expect(page.containsElement('h1', 'Create organization')).toBeTrue();
    expect(page.containsAttribute('id', 'org-new-name')).toBeTrue();
    expect(page.containsElement('button', 'Create')).toBeTrue();
  });

  it('enables the button when idle', () => {
    expect(output({}).contains('disabled')).toBeFalse();
  });

  it('disables the button while pending', () => {
    expect(output({ pending: true }).contains('disabled')).toBeTrue();
  });

  it('shows the field error', () => {
    expect(output({ fieldErrors: { name: 'Name is required' } }).contains('Name is required')).toBeTrue();
  });

  it('shows the submit error', () => {
    expect(output({ submitError: 'bad name' }).contains('bad name')).toBeTrue();
  });

  it('renders the prefilled name as an escaped value', () => {
    const page = output({ name: '<script>x</script>' });

    expect(page.containsTag('script')).toBeFalse();
    expect(page.containsAttribute('value', '&lt;script&gt;x&lt;/script&gt;')).toBeTrue();
  });
});
