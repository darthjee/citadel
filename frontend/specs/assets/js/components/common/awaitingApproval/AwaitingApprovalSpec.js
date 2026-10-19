import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AwaitingApproval from '../../../../../../assets/js/components/common/awaitingApproval/AwaitingApproval.jsx';
import AwaitingApprovalHelper from '../../../../../../assets/js/components/common/awaitingApproval/helpers/AwaitingApprovalHelper.jsx';
import AwaitingApprovalController from '../../../../../../assets/js/components/common/awaitingApproval/controllers/AwaitingApprovalController.js';
import { renderedOutput } from '../../../../../support/renderedOutput.js';

describe('AwaitingApproval', () => {
  let onLogout;

  const captureHandlers = () => {
    let captured;
    spyOn(AwaitingApprovalHelper, 'render').and.callFake((_state, handlers) => {
      captured = handlers;
      return React.createElement('div');
    });
    renderToStaticMarkup(React.createElement(AwaitingApproval, { onLogout }));
    return captured;
  };

  beforeEach(() => {
    onLogout = jasmine.createSpy('onLogout').and.resolveTo();
  });

  it('renders the title, text and both buttons', () => {
    const view = renderedOutput(React.createElement(AwaitingApproval, { onLogout }));

    expect(view.contains('Awaiting approval')).toBeTrue();
    expect(view.contains('waiting for an administrator')).toBeTrue();
    expect(view.contains('Check again')).toBeTrue();
    expect(view.contains('Log out')).toBeTrue();
  });

  it('passes no error to the helper initially', () => {
    spyOn(AwaitingApprovalHelper, 'render').and.returnValue(React.createElement('div'));

    renderToStaticMarkup(React.createElement(AwaitingApproval, { onLogout }));

    expect(AwaitingApprovalHelper.render).toHaveBeenCalledWith(
      { error: null },
      { onCheckAgain: jasmine.any(Function), onLogout: jasmine.any(Function) },
    );
  });

  it('delegates Check again to the controller', async () => {
    spyOn(AwaitingApprovalController.prototype, 'checkAgain').and.resolveTo();

    await captureHandlers().onCheckAgain();

    expect(AwaitingApprovalController.prototype.checkAgain).toHaveBeenCalled();
  });

  it('delegates Log out to the given logout handler', async () => {
    const event = { preventDefault: jasmine.createSpy('preventDefault') };

    await captureHandlers().onLogout(event);

    expect(onLogout).toHaveBeenCalledOnceWith(event);
  });
});
