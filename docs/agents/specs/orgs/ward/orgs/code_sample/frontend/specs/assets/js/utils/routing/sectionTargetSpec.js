import { sectionListPathFor, switchTargetFor } from '../../../../../assets/js/utils/routing/sectionTarget.js';
import { SECTIONS_CONTEXT } from '../../../../../assets/js/utils/routing/routes.js';

const PERSONAL = { kind: 'personal' };
const ORG_5 = { kind: 'organization', orgId: 5 };

describe('sectionTarget', () => {
  describe('SECTIONS_CONTEXT', () => {
    it('registers the bank accounts section', () => {
      expect(SECTIONS_CONTEXT).toContain(['/bank/accounts', '/bank/accounts']);
    });

    it('registers the bank debts section', () => {
      expect(SECTIONS_CONTEXT).toContain(['/bank/debts', '/bank/debts']);
    });

    it('registers the bank investments section', () => {
      expect(SECTIONS_CONTEXT).toContain(['/bank/investments', '/bank/investments']);
    });

    it('registers the bank providers section', () => {
      expect(SECTIONS_CONTEXT).toContain(['/bank/providers', '/bank/providers']);
    });

    it('registers the bank calendar section', () => {
      expect(SECTIONS_CONTEXT).toContain(['/bank/calendar', '/bank/calendar']);
    });

    it('lands the one-off bill pages on the providers list', () => {
      expect(SECTIONS_CONTEXT).toContain(['/bank/bills', '/bank/providers']);
    });
  });

  describe('sectionListPathFor', () => {
    [
      '#/bank/accounts',
      '#/bank/accounts/',
      '#/bank/accounts/new',
      '#/bank/accounts/12',
      '#/bank/accounts/12/edit',
      '#/bank/accounts?archived=true',
      '#/orgs/3/bank/accounts/12/edit',
      '#/orgs/5/bank/accounts?archived=true',
      '/bank/accounts/12',
    ].forEach((hash) => {
      it(`maps ${hash} to the accounts list`, () => {
        expect(sectionListPathFor(hash)).toBe('/bank/accounts');
      });
    });

    [
      '#/bank/debts',
      '#/bank/debts/new',
      '#/bank/debts/7',
      '#/bank/debts/7/edit',
      '#/bank/debts?archived=true',
      '#/orgs/3/bank/debts/7/edit',
      '#/orgs/5/bank/debts?archived=true',
    ].forEach((hash) => {
      it(`maps ${hash} to the debts list`, () => {
        expect(sectionListPathFor(hash)).toBe('/bank/debts');
      });
    });

    [
      '#/bank/investments',
      '#/bank/investments/new',
      '#/bank/investments/3',
      '#/bank/investments/3/edit',
      '#/bank/investments?archived=true',
      '#/orgs/3/bank/investments/3/edit',
      '#/orgs/5/bank/investments?archived=true',
    ].forEach((hash) => {
      it(`maps ${hash} to the investments list`, () => {
        expect(sectionListPathFor(hash)).toBe('/bank/investments');
      });
    });

    [
      '#/bank/providers',
      '#/bank/providers/new',
      '#/bank/providers/accountant',
      '#/bank/providers/3',
      '#/bank/providers/3/edit',
      '#/bank/providers?archived=true',
      '#/orgs/5/bank/providers/3/edit',
      '#/orgs/5/bank/providers/accountant',
    ].forEach((hash) => {
      it(`maps ${hash} to the providers list`, () => {
        expect(sectionListPathFor(hash)).toBe('/bank/providers');
      });
    });

    [
      '#/bank/providersx',
      '#/bank/investmentsx',
      '#/bank/debtsx',
      '#/bank/accountsx',
      '#/bank/accountsx/12',
      '#/bank',
      '#/account/my-account',
      '#/',
      '',
      '#/orgs/5',
      '#/orgs/abc/bank/accounts',
    ].forEach((hash) => {
      it(`returns null for ${JSON.stringify(hash)}`, () => {
        expect(sectionListPathFor(hash)).toBeNull();
      });
    });

    it('uses the first matching row of a custom registry', () => {
      const sections = [['/bank/debts', '/bank/debts'], ['/bank', '/bank/accounts']];

      expect(sectionListPathFor('#/orgs/2/bank/debts/4', sections)).toBe('/bank/debts');
      expect(sectionListPathFor('#/bank/other', sections)).toBe('/bank/accounts');
    });
  });

  describe('switchTargetFor', () => {
    it('lands on the Personal list from an organization edit page', () => {
      expect(switchTargetFor('#/orgs/3/bank/accounts/12/edit')(PERSONAL)).toBe('#/bank/accounts');
    });

    it('lands on the organization list and drops the query', () => {
      expect(switchTargetFor('#/bank/accounts?archived=true')(ORG_5)).toBe('#/orgs/5/bank/accounts');
    });

    it('lands on the investments list in both directions', () => {
      expect(switchTargetFor('#/orgs/3/bank/investments/3/edit')(PERSONAL)).toBe('#/bank/investments');
      expect(switchTargetFor('#/bank/investments/3?page=2')(ORG_5)).toBe('#/orgs/5/bank/investments');
    });

    it('lands on the providers list in both directions, also from the hand-off page', () => {
      expect(switchTargetFor('#/orgs/5/bank/providers/3/edit')(PERSONAL)).toBe('#/bank/providers');
      expect(switchTargetFor('#/bank/providers/accountant')(ORG_5)).toBe('#/orgs/5/bank/providers');
      expect(switchTargetFor('#/orgs/5/bank/providers/accountant')(PERSONAL)).toBe('#/bank/providers');
    });

    it('lands on the providers list from a bill page, in both directions', () => {
      expect(switchTargetFor('#/bank/bills/new?provider=3')(ORG_5)).toBe('#/orgs/5/bank/providers');
      expect(switchTargetFor('#/orgs/5/bank/bills/9/edit')(PERSONAL)).toBe('#/bank/providers');
    });

    it('lands on the calendar list from the list and the month view, in both directions', () => {
      expect(switchTargetFor('#/bank/calendar')(ORG_5)).toBe('#/orgs/5/bank/calendar');
      expect(switchTargetFor('#/bank/calendar/month?m=2026-12')(ORG_5)).toBe('#/orgs/5/bank/calendar');
      expect(switchTargetFor('#/orgs/5/bank/calendar/month')(PERSONAL)).toBe('#/bank/calendar');
    });

    it('lands on the landing page outside a section', () => {
      expect(switchTargetFor('#/account/my-account')(ORG_5)).toBe('#/orgs/5');
      expect(switchTargetFor('#/account/my-account')(PERSONAL)).toBe('#/');
    });

    it('lands on the landing page for an empty hash', () => {
      expect(switchTargetFor('')(ORG_5)).toBe('#/orgs/5');
    });
  });
});
