import React from 'react';
import DenyUserButton from '../../../../../../../../assets/js/components/resources/admin/pages/users/DenyUserButton.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('DenyUserButton', () => {
  let onDeny;

  const render = (user, currentUserId = 99) => renderedOutput(
    React.createElement(DenyUserButton, { user, currentUserId, onDeny }),
  );

  beforeEach(() => {
    onDeny = jasmine.createSpy('onDeny');
  });

  it('renders a Deny button for another pending user', () => {
    const page = render({ id: 1, status: 'pending' });

    expect(page.containsElement('button', 'Deny')).withContext('button').toBeTrue();
    expect(page.contains('btn btn-sm btn-danger me-2')).withContext('classes').toBeTrue();
  });

  it('renders a Deny button for another approved user', () => {
    expect(render({ id: 1, status: 'approved' }).containsElement('button', 'Deny')).toBeTrue();
  });

  it('renders nothing on the own row', () => {
    expect(render({ id: 1, status: 'approved' }, 1).isEmpty()).toBeTrue();
  });

  it('renders nothing for a denied user', () => {
    expect(render({ id: 1, status: 'denied' }).isEmpty()).toBeTrue();
  });

  it('calls onDeny when clicked', () => {
    const element = DenyUserButton({ user: { id: 1, status: 'approved' }, currentUserId: 99, onDeny });

    element.props.onClick();

    expect(onDeny).toHaveBeenCalled();
  });
});
