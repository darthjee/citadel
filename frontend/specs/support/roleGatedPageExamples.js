import React from 'react';
import {
  DEFAULT_OWNER_CONTEXT,
  OwnerContext,
} from '../../assets/js/components/common/ownerContext/hooks/useOwnerContext.js';
import { PERMISSION_DENIED_MESSAGE } from '../../assets/js/components/common/PermissionDenied.jsx';
import { renderedOutput } from './renderedOutput.js';
import { installFakeWindow, uninstallFakeWindow } from './fakeWindow.js';

const ORG = { kind: 'organization', orgId: 5 };
const ESCAPED_MESSAGE = PERMISSION_DENIED_MESSAGE.replace("'", '&#x27;');

/**
 * Registers the role-gate cases shared by the admin-only pages (e.g. the rename form).
 *
 * @description Must be called inside a `describe`. Renders the page in an organization context
 * with each role, the helper's `render` stubbed: a `user` sees the permission message and no
 * form; an `admin` or `owner` gets the form; a not-yet-known (`null`) role shows neither the
 * message nor a filled form.
 * @param {object} options - The options given to the example group.
 * @param {Function} options.Page - The page component under test.
 * @param {object} options.Helper - The helper whose `render` is spied on.
 * @param {string} [options.hash] - The window hash the page is reached at.
 * @param {boolean} [options.loadingWhileUnknown] - Whether the page renders its helper with
 *   `fields: null` (loading) while the role is unknown, rather than nothing.
 * @returns {void}
 */
export const itGatesThePageByRole = ({
  Page, Helper, hash = '', loadingWhileUnknown = true,
}) => {
  describe('role gate', () => {
    beforeEach(() => {
      installFakeWindow({ location: { hash } });
      spyOn(Helper, 'render').and.returnValue(React.createElement('form', null, 'FORM'));
    });

    afterEach(() => {
      uninstallFakeWindow();
    });

    const render = (role) => renderedOutput(React.createElement(
      OwnerContext.Provider,
      { value: { ...DEFAULT_OWNER_CONTEXT, context: ORG, userId: 1, role } },
      React.createElement(Page),
    ));

    it('shows the permission message, and no form, to a user', () => {
      const page = render('user');

      expect(page.contains(ESCAPED_MESSAGE)).toBeTrue();
      expect(page.contains('FORM')).toBeFalse();
      expect(Helper.render).not.toHaveBeenCalled();
    });

    ['admin', 'owner'].forEach((role) => {
      it(`shows the form to an ${role}`, () => {
        const page = render(role);

        expect(page.contains('FORM')).toBeTrue();
        expect(page.contains(ESCAPED_MESSAGE)).toBeFalse();
      });
    });

    it('shows neither the message nor a filled form while the role is unknown', () => {
      const page = render(null);

      expect(page.contains(ESCAPED_MESSAGE)).toBeFalse();

      if (loadingWhileUnknown) {
        expect(Helper.render.calls.mostRecent().args[0].fields).toBeNull();
      } else {
        expect(Helper.render).not.toHaveBeenCalled();
        expect(page.isEmpty()).toBeTrue();
      }
    });
  });
};
