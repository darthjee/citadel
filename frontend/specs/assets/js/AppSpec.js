import React from 'react';
import App from '../../../assets/js/App.jsx';
import AppHelper from '../../../assets/js/components/helpers/AppHelper.jsx';
import useOwnerContext, {
  DEFAULT_OWNER_CONTEXT,
} from '../../../assets/js/components/common/ownerContext/hooks/useOwnerContext.js';
import { renderedOutput } from '../../support/renderedOutput.js';

describe('App', () => {
  it('renders the header', () => {
    const page = renderedOutput(React.createElement(App));

    expect(page.contains('Citadel Placeholder')).withContext('header').toBeTrue();
  });

  it('renders the home page by default', () => {
    const page = renderedOutput(React.createElement(App));

    expect(page.containsElement('h1', 'Register')).withContext('register heading').toBeFalse();
  });

  it('mounts the owner-context provider around the page', () => {
    let captured;
    const Probe = () => {
      captured = useOwnerContext();
      return null;
    };

    spyOn(AppHelper, 'render').and.returnValue(React.createElement(Probe));
    renderedOutput(React.createElement(App));

    expect(AppHelper.render).toHaveBeenCalledWith('home');
    expect(captured).not.toBe(DEFAULT_OWNER_CONTEXT);
    expect(captured.context).toEqual({ kind: 'personal' });
    expect(captured.page).toBe('home');
    expect(captured.role).toBe('owner');
  });
});
