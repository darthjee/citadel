import React from 'react';
import ContextSwitcher from '../../../../../../../assets/js/components/common/header/contextSwitcher/ContextSwitcher.jsx';
import ContextSwitcherHelper from '../../../../../../../assets/js/components/common/header/contextSwitcher/helpers/ContextSwitcherHelper.jsx';
import ContextSwitcherController from '../../../../../../../assets/js/components/common/header/contextSwitcher/controllers/ContextSwitcherController.js';
import {
  DEFAULT_OWNER_CONTEXT,
  OwnerContext,
} from '../../../../../../../assets/js/components/common/ownerContext/hooks/useOwnerContext.js';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';
import { renderCapturingHandlers } from '../../../../../../support/renderCapturingHandlers.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';

const ORGS = [{ id: 5, name: 'Acme', role: 'owner' }];

function withValue(props, value = {}) {
  return React.createElement(
    OwnerContext.Provider,
    { value: { ...DEFAULT_OWNER_CONTEXT, userId: 1, ...value } },
    React.createElement(ContextSwitcher, props),
  );
}

describe('ContextSwitcher', () => {
  it('renders nothing while logged out', () => {
    expect(renderedOutput(withValue({ loggedIn: false })).isEmpty()).toBeTrue();
  });

  it('renders nothing while pending', () => {
    expect(renderedOutput(withValue({ loggedIn: true, pending: true })).isEmpty()).toBeTrue();
  });

  it('renders the dropdown with the organizations once logged in', () => {
    const page = renderedOutput(withValue({ loggedIn: true }, { orgs: ORGS }));

    expect(page.containsInOrder('Personal', 'Acme', 'Create organization')).toBeTrue();
  });

  it('picks through the controller with the user id', () => {
    spyOn(ContextSwitcherController.prototype, 'pick');

    const handlers = renderCapturingHandlers(() => withValue({ loggedIn: true }), ContextSwitcherHelper);

    handlers.onPick({ kind: 'organization', orgId: 5 });

    expect(ContextSwitcherController.prototype.pick)
      .toHaveBeenCalledWith({ kind: 'organization', orgId: 5 }, 1, jasmine.any(Function));
  });

  describe('switch target', () => {
    const PERSONAL = { kind: 'personal' };
    const ORG_5 = { kind: 'organization', orgId: 5 };

    let navigated;

    beforeEach(() => {
      navigated = [];
      spyOn(ContextSwitcherController.prototype, 'pick').and.callFake((picked, _userId, switchTarget) => {
        navigated.push(switchTarget(picked));
      });
    });

    afterEach(() => {
      uninstallFakeWindow();
    });

    function render(hash, context) {
      installFakeWindow({ location: { hash } });

      return renderCapturingHandlers(
        () => withValue({ loggedIn: true }, { context, orgs: ORGS }),
        ContextSwitcherHelper,
      );
    }

    [
      ['#/orgs/3/edit', { kind: 'organization', orgId: 3 }, PERSONAL, '#/'],
      ['#/orgs/3?x=1', { kind: 'organization', orgId: 3 }, ORG_5, '#/orgs/5'],
      ['#/account/my-account', PERSONAL, ORG_5, '#/orgs/5'],
    ].forEach(([hash, context, picked, expected]) => {
      it(`lands on ${expected} when picking from ${hash}, with a matching href`, () => {
        const handlers = render(hash, context);

        handlers.onPick(picked);

        expect(navigated).toEqual([expected]);
        expect(handlers.switchTarget(picked)).toBe(expected);
      });
    });

    it('renders the item href from the same target', () => {
      installFakeWindow({ location: { hash: '#/account/my-account' } });

      const page = renderedOutput(withValue({ loggedIn: true }, { orgs: ORGS }));

      expect(page.containsAttribute('href', '#/orgs/5')).toBeTrue();
      expect(page.containsAttribute('href', '#/')).toBeTrue();
      expect(page.containsAttribute('href', '#/account/my-account')).toBeFalse();
    });

    it('falls back to landings outside the browser', () => {
      const page = renderedOutput(withValue({ loggedIn: true }, { orgs: ORGS }));

      expect(page.containsAttribute('href', '#/orgs/5')).toBeTrue();
    });
  });
});
