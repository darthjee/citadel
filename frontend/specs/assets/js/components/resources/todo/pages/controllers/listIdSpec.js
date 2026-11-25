import listIdFrom from '../../../../../../../../assets/js/components/resources/todo/pages/controllers/listId.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../../support/fakeWindow.js';

describe('listIdFrom', () => {
  [
    ['#/todo/lists/7', '/todo/lists/:id', 7],
    ['#/orgs/5/todo/lists/7', '/todo/lists/:id', 7],
    ['#/orgs/5/todo/lists/7/edit', '/todo/lists/:id/edit', 7],
    ['#/todo/lists/7?x=1', '/todo/lists/:id', 7],
  ].forEach(([hash, pattern, id]) => {
    it(`reads ${id} from ${hash}`, () => {
      expect(listIdFrom(pattern, hash)).toBe(id);
    });
  });

  ['abc', '007', '0', '-1', '1.5', '2147483648'].forEach((segment) => {
    it(`rejects a malformed id ${segment}`, () => {
      expect(listIdFrom('/todo/lists/:id', `#/todo/lists/${segment}`)).toBeNull();
    });
  });

  it('returns null when the pattern does not match', () => {
    expect(listIdFrom('/todo/lists/:id', '#/todo/lists')).toBeNull();
  });

  describe('with the current location', () => {
    afterEach(() => uninstallFakeWindow());

    it('reads the window hash', () => {
      installFakeWindow({ location: { hash: '#/orgs/2/todo/lists/9' } });

      expect(listIdFrom('/todo/lists/:id')).toBe(9);
    });

    it('returns null without a window', () => {
      installFakeWindow(undefined);

      expect(listIdFrom('/todo/lists/:id')).toBeNull();
    });
  });
});
