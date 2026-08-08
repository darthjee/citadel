import React from 'react';
import App from '../../../assets/js/App.jsx';
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
});
