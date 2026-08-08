import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Renders a page with its helper's `render` stubbed, returning the handlers the page passed in.
 *
 * @description Spies on `Helper.render` so it records its second argument (the handlers) and
 * returns an empty `div`, then renders `Page` with `renderToStaticMarkup`. Uses `spyOn`, so it
 * must be called from within a spec (`it` / `beforeEach`).
 * @param {Function} Page - The page component to render.
 * @param {object} Helper - The helper class whose static `render` is stubbed.
 * @returns {object} The handlers the page handed to `Helper.render`.
 */
export const renderCapturingHandlers = (Page, Helper) => {
  let capturedHandlers;
  spyOn(Helper, 'render').and.callFake((_state, handlers) => {
    capturedHandlers = handlers;
    return React.createElement('div');
  });
  renderToStaticMarkup(React.createElement(Page));
  return capturedHandlers;
};
