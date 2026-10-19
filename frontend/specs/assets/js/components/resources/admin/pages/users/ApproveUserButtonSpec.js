import React from 'react';
import ApproveUserButton from '../../../../../../../../assets/js/components/resources/admin/pages/users/ApproveUserButton.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('ApproveUserButton', () => {
  let onApprove;

  const render = (status) => renderedOutput(
    React.createElement(ApproveUserButton, { user: { id: 1, status }, onApprove }),
  );

  beforeEach(() => {
    onApprove = jasmine.createSpy('onApprove');
  });

  it('renders an Approve button for a pending user', () => {
    const page = render('pending');

    expect(page.containsElement('button', 'Approve')).withContext('button').toBeTrue();
    expect(page.contains('btn btn-sm btn-success me-2')).withContext('classes').toBeTrue();
  });

  it('renders nothing for an approved user', () => {
    expect(render('approved').isEmpty()).toBeTrue();
  });

  it('renders nothing for a denied user', () => {
    expect(render('denied').isEmpty()).toBeTrue();
  });

  it('calls onApprove when clicked', () => {
    const element = ApproveUserButton({ user: { id: 1, status: 'pending' }, onApprove });

    element.props.onClick();

    expect(onApprove).toHaveBeenCalled();
  });
});
