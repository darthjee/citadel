import ContextSwitcherController from '../../../../../../../../assets/js/components/common/header/contextSwitcher/controllers/ContextSwitcherController.js';
import ContextStorage from '../../../../../../../../assets/js/utils/context/ContextStorage.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../../support/fakeWindow.js';

describe('ContextSwitcherController', () => {
  let log;
  let storage;
  let navigate;
  let controller;

  beforeEach(() => {
    log = [];
    storage = {
      rememberPersonal: jasmine.createSpy('rememberPersonal').and.callFake((userId) => log.push(['personal', userId])),
      rememberOrganization: jasmine.createSpy('rememberOrganization')
        .and.callFake((userId, orgId) => log.push(['organization', userId, orgId])),
    };
    navigate = jasmine.createSpy('navigate').and.callFake((hash) => log.push(['navigate', hash]));
    controller = new ContextSwitcherController({ storage, navigate });
  });

  it('stores Personal before navigating to the Personal landing', () => {
    const target = controller.pick({ kind: 'personal' }, 1);

    expect(target).toBe('#/');
    expect(log).toEqual([['personal', 1], ['navigate', '#/']]);
  });

  it('stores the organization before navigating to its landing', () => {
    const target = controller.pick({ kind: 'organization', orgId: 5 }, 1);

    expect(target).toBe('#/orgs/5');
    expect(log).toEqual([['organization', 1, 5], ['navigate', '#/orgs/5']]);
  });

  it('uses a page-provided switch target', () => {
    const switchTarget = (context) => `#/orgs/${context.orgId}/module/items`;

    controller.pick({ kind: 'organization', orgId: 5 }, 1, switchTarget);

    expect(navigate).toHaveBeenCalledWith('#/orgs/5/module/items');
  });

  describe('with the default dependencies', () => {
    afterEach(() => {
      uninstallFakeWindow();
    });

    it('stores in ContextStorage and sets window.location.hash', () => {
      const fakeWindow = installFakeWindow({ location: { hash: '#/' } });

      spyOn(ContextStorage, 'rememberOrganization');
      new ContextSwitcherController().pick({ kind: 'organization', orgId: 5 }, 1);

      expect(ContextStorage.rememberOrganization).toHaveBeenCalledWith(1, 5);
      expect(fakeWindow.location.hash).toBe('#/orgs/5');
    });

    it('does not navigate without a window', () => {
      spyOn(ContextStorage, 'rememberPersonal');

      expect(new ContextSwitcherController().pick({ kind: 'personal' }, 1)).toBe('#/');
    });
  });
});
