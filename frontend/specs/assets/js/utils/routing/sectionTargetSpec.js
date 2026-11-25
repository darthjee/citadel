import { sectionListPathFor, switchTargetFor } from '../../../../../assets/js/utils/routing/sectionTarget.js';
import { SECTIONS_CONTEXT } from '../../../../../assets/js/utils/routing/routes.js';

const PERSONAL = { kind: 'personal' };
const ORG_5 = { kind: 'organization', orgId: 5 };

const SECTIONS = [
  ['/module/items', '/module/items'],
  ['/module/others', '/module/others'],
  ['/module/one-off', '/module/others'],
];

describe('sectionTarget', () => {
  describe('SECTIONS_CONTEXT', () => {
    it('is an array', () => {
      expect(Array.isArray(SECTIONS_CONTEXT)).toBeTrue();
    });

    it('registers the todo lists section', () => {
      expect(SECTIONS_CONTEXT).toContain(['/todo/lists', '/todo/lists']);
    });

    it('maps a todo page to the todo lists index by default', () => {
      expect(sectionListPathFor('#/orgs/5/todo/lists/7/edit')).toBe('/todo/lists');
    });

    it('switches from a Personal todo list to the organization lists', () => {
      expect(switchTargetFor('#/todo/lists/5')(ORG_5)).toBe('#/orgs/5/todo/lists');
    });

    it('switches from an organization todo edit page to the Personal lists', () => {
      expect(switchTargetFor('#/orgs/1/todo/lists/5/edit')(PERSONAL)).toBe('#/todo/lists');
    });
  });

  describe('sectionListPathFor', () => {
    [
      '#/module/items',
      '#/module/items/',
      '#/module/items/new',
      '#/module/items/12',
      '#/module/items/12/edit',
      '#/module/items?archived=true',
      '#/orgs/3/module/items/12/edit',
      '#/orgs/5/module/items?archived=true',
      '/module/items/12',
    ].forEach((hash) => {
      it(`maps ${hash} to the items list`, () => {
        expect(sectionListPathFor(hash, SECTIONS)).toBe('/module/items');
      });
    });

    [
      '#/module/others/7/edit',
      '#/module/one-off/new',
      '#/orgs/5/module/one-off/9/edit',
    ].forEach((hash) => {
      it(`maps ${hash} to the others list`, () => {
        expect(sectionListPathFor(hash, SECTIONS)).toBe('/module/others');
      });
    });

    [
      '#/module/itemsx',
      '#/module/itemsx/12',
      '#/module',
      '#/account/my-account',
      '#/',
      '',
      '#/orgs/5',
      '#/orgs/abc/module/items',
    ].forEach((hash) => {
      it(`returns null for ${JSON.stringify(hash)}`, () => {
        expect(sectionListPathFor(hash, SECTIONS)).toBeNull();
      });
    });

    it('uses the first matching row of a custom registry', () => {
      const sections = [['/module/items', '/module/items'], ['/module', '/module/others']];

      expect(sectionListPathFor('#/orgs/2/module/items/4', sections)).toBe('/module/items');
      expect(sectionListPathFor('#/module/other', sections)).toBe('/module/others');
    });
  });

  describe('switchTargetFor', () => {
    it('lands on the Personal list from an organization edit page', () => {
      expect(switchTargetFor('#/orgs/3/module/items/12/edit', SECTIONS)(PERSONAL)).toBe('#/module/items');
    });

    it('lands on the organization list and drops the query', () => {
      expect(switchTargetFor('#/module/items?archived=true', SECTIONS)(ORG_5)).toBe('#/orgs/5/module/items');
    });

    it('lands on a sibling list from a one-off page, in both directions', () => {
      expect(switchTargetFor('#/module/one-off/new?x=3', SECTIONS)(ORG_5)).toBe('#/orgs/5/module/others');
      expect(switchTargetFor('#/orgs/5/module/one-off/9/edit', SECTIONS)(PERSONAL)).toBe('#/module/others');
    });

    it('lands on the landing page outside a section', () => {
      expect(switchTargetFor('#/account/my-account', SECTIONS)(ORG_5)).toBe('#/orgs/5');
      expect(switchTargetFor('#/account/my-account', SECTIONS)(PERSONAL)).toBe('#/');
    });

    it('lands on the landing page for an empty hash', () => {
      expect(switchTargetFor('', SECTIONS)(ORG_5)).toBe('#/orgs/5');
    });

    it('uses the registered sections by default', () => {
      expect(switchTargetFor('#/account/my-account')(ORG_5)).toBe('#/orgs/5');
    });
  });
});
