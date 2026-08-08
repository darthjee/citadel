import React from 'react';
import { renderedOutput } from './renderedOutput.js';

/**
 * Registers the cases shared by the account-edit pages (`MyAccount`, `AdminUserEdit`).
 *
 * @description Must be called inside a `describe`. Registers one case checking that the page
 * renders through its helper, handing over the default state and the submit/change handlers.
 * @param {object} options - The options given to the example group.
 * @param {Function} options.Page - The page component under test.
 * @param {object} options.Helper - The helper class whose static `render` is spied on.
 * @param {object} options.defaultState - The state the page is expected to start with.
 * @param {string} options.label - A marker rendered by the stubbed helper and looked up in the output.
 * @returns {void}
 */
export const itBehavesLikeAnAccountEditPage = ({ Page, Helper, defaultState, label }) => {
  it('passes the default state to the helper', () => {
    spyOn(Helper, 'render').and.returnValue(React.createElement('div', null, label));

    const output = renderedOutput(React.createElement(Page));

    expect(output.contains(label)).withContext('stubbed helper label').toBeTrue();
    expect(Helper.render).toHaveBeenCalledWith(
      defaultState,
      jasmine.objectContaining({
        onSubmit: jasmine.any(Function),
        onChange: jasmine.any(Function),
      }),
    );
  });
};
