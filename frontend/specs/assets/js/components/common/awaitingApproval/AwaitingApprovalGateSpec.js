import React from 'react';
import AwaitingApprovalGate from '../../../../../../assets/js/components/common/awaitingApproval/AwaitingApprovalGate.jsx';
import { renderedOutput } from '../../../../../support/renderedOutput.js';

describe('AwaitingApprovalGate', () => {
  const onLogout = () => Promise.resolve();

  const renderGate = (pending) => renderedOutput(React.createElement(
    AwaitingApprovalGate,
    { pending, onLogout },
    React.createElement('p', null, 'page content'),
  ));

  it('renders the awaiting-approval view instead of the children while pending', () => {
    const view = renderGate(true);

    expect(view.contains('Awaiting approval')).toBeTrue();
    expect(view.contains('page content')).toBeFalse();
  });

  it('renders the children when not pending', () => {
    const view = renderGate(false);

    expect(view.contains('page content')).toBeTrue();
    expect(view.contains('Awaiting approval')).toBeFalse();
  });

  it('renders nothing when not pending and without children', () => {
    const view = renderedOutput(React.createElement(AwaitingApprovalGate, { pending: false, onLogout }));

    expect(view.isEmpty()).toBeTrue();
  });
});
