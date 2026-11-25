import React from 'react';
import NotFound, { forgetStaleContext } from '../../../../../../assets/js/components/common/notFound/NotFound.jsx';
import ContextStorage from '../../../../../../assets/js/utils/context/ContextStorage.js';
import { renderedOutput } from '../../../../../support/renderedOutput.js';

describe('NotFound', () => {
  it('renders a generic message and a Go to Personal link', () => {
    const page = renderedOutput(React.createElement(NotFound));

    expect(page.containsElement('h1', 'Not found')).toBeTrue();
    expect(page.containsAttribute('href', '#/')).toBeTrue();
    expect(page.contains('Go to Personal')).toBeTrue();
  });

  it('never mentions the organization', () => {
    const page = renderedOutput(React.createElement(NotFound, { orgId: 5 }));

    expect(page.contains('rganization')).toBeFalse();
    expect(page.contains('5')).toBeFalse();
  });

  describe('forgetStaleContext', () => {
    it('forgets the remembered id when it matches', () => {
      const storage = jasmine.createSpyObj('storage', ['forgetIfMatches']);

      forgetStaleContext(1, 5, storage);

      expect(storage.forgetIfMatches).toHaveBeenCalledWith(1, 5);
    });

    it('does nothing without an org id (malformed id)', () => {
      const storage = jasmine.createSpyObj('storage', ['forgetIfMatches']);

      forgetStaleContext(1, null, storage);

      expect(storage.forgetIfMatches).not.toHaveBeenCalled();
    });

    it('defaults to ContextStorage', () => {
      spyOn(ContextStorage, 'forgetIfMatches');

      forgetStaleContext(1, 5);

      expect(ContextStorage.forgetIfMatches).toHaveBeenCalledWith(1, 5);
    });
  });
});
