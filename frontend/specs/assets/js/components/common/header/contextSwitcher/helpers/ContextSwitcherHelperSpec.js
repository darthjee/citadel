import React from 'react';
import ContextSwitcherHelper, {
  NEUTRAL_TITLE,
  ORGS_ERROR_MESSAGE,
} from '../../../../../../../../assets/js/components/common/header/contextSwitcher/helpers/ContextSwitcherHelper.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

const PERSONAL = { kind: 'personal' };
const ORGS = [{ id: 5, name: 'Acme', role: 'owner' }, { id: 6, name: 'Beta', role: 'user' }];

describe('ContextSwitcherHelper', () => {
  let onPick;

  beforeEach(() => {
    onPick = jasmine.createSpy('onPick');
  });

  const render = (state) => ContextSwitcherHelper.render({ orgsError: null, ...state }, { onPick });
  const output = (state) => renderedOutput(React.createElement('div', null, render(state)));

  const flatten = (node, acc = []) => {
    if (Array.isArray(node)) {
      node.forEach((child) => flatten(child, acc));
      return acc;
    }

    if (!node || typeof node !== 'object') {
      return acc;
    }

    acc.push(node);
    return flatten(node.props?.children, acc);
  };

  const itemWithHref = (state, href) => flatten(render(state).props.children)
    .find((node) => node.props?.href === href);

  describe('title', () => {
    it('shows Personal in the Personal context', () => {
      expect(output({ context: PERSONAL, orgs: ORGS }).containsAttribute('title', 'Personal')).toBeTrue();
    });

    it('shows the active organization name, truncated with the full name in title', () => {
      const page = output({ context: { kind: 'organization', orgId: 6 }, orgs: ORGS });

      expect(page.containsAttribute('title', 'Beta')).toBeTrue();
      expect(page.contains('text-truncate')).toBeTrue();
      expect(page.contains('max-width:12rem')).toBeTrue();
    });

    it('shows a neutral title when the active organization is not in the list', () => {
      expect(output({ context: { kind: 'organization', orgId: 9 }, orgs: ORGS })
        .containsAttribute('title', NEUTRAL_TITLE)).toBeTrue();
    });
  });

  describe('items', () => {
    it('lists Personal, every organization and Create organization in order', () => {
      expect(output({ context: PERSONAL, orgs: ORGS })
        .containsInOrder('Personal', 'Acme', 'Beta', '+ Create organization')).toBeTrue();
    });

    it('links Create organization to #/orgs/new', () => {
      expect(output({ context: PERSONAL, orgs: ORGS }).containsAttribute('href', '#/orgs/new')).toBeTrue();
    });

    it('links each organization to its landing', () => {
      const page = output({ context: PERSONAL, orgs: ORGS });

      expect(page.containsAttribute('href', '#/orgs/5')).toBeTrue();
      expect(page.containsAttribute('href', '#/orgs/6')).toBeTrue();
    });

    it('checks the active organization only', () => {
      const state = { context: { kind: 'organization', orgId: 5 }, orgs: ORGS };

      expect(itemWithHref(state, '#/orgs/5').props.active).toBeTrue();
      expect(itemWithHref(state, '#/orgs/6').props.active).toBeFalse();
      expect(itemWithHref(state, '#/').props.active).toBeFalse();
    });

    it('checks Personal in the Personal context', () => {
      expect(itemWithHref({ context: PERSONAL, orgs: ORGS }, '#/').props.active).toBeTrue();
    });

    it('does not show the role', () => {
      const page = output({ context: PERSONAL, orgs: ORGS });

      expect(page.contains('owner')).toBeFalse();
    });

    it('renders only Personal and Create organization without organizations', () => {
      const page = output({ context: PERSONAL, orgs: [] });

      expect(page.containsInOrder('Personal', '+ Create organization')).toBeTrue();
      expect(page.contains('href="#/orgs/5"')).toBeFalse();
    });

    it('tolerates a missing org list', () => {
      expect(output({ context: PERSONAL, orgs: undefined }).contains('Create organization')).toBeTrue();
    });

    it('renders names as text', () => {
      const page = output({ context: PERSONAL, orgs: [{ id: 7, name: '<script>alert(1)</script>' }] });

      expect(page.containsTag('script')).toBeFalse();
      expect(page.contains('&lt;script&gt;alert(1)&lt;/script&gt;')).toBeTrue();
    });

    it('truncates long item names with the full name in title', () => {
      const name = 'x'.repeat(255);
      const item = itemWithHref({ context: PERSONAL, orgs: [{ id: 7, name }] }, '#/orgs/7');

      expect(item.props.className).toContain('text-truncate');
      expect(item.props.title).toBe(name);
    });
  });

  describe('with a switch target', () => {
    const switchTarget = (context) => (context.orgId ? `#/orgs/${context.orgId}/module/items` : '#/module/items');

    it('builds every item href from the target', () => {
      const page = renderedOutput(React.createElement('div', null, ContextSwitcherHelper.render(
        { context: PERSONAL, orgs: ORGS, orgsError: null },
        { onPick, switchTarget },
      )));

      expect(page.containsAttribute('href', '#/module/items')).toBeTrue();
      expect(page.containsAttribute('href', '#/orgs/5/module/items')).toBeTrue();
      expect(page.containsAttribute('href', '#/orgs/6/module/items')).toBeTrue();
      expect(page.containsAttribute('href', '#/orgs/5')).toBeFalse();
    });
  });

  describe('when the org list failed to load', () => {
    it('keeps Personal and Create organization and shows an inline error', () => {
      const page = output({ context: PERSONAL, orgs: [], orgsError: 'boom' });

      expect(page.containsInOrder('Personal', ORGS_ERROR_MESSAGE, '+ Create organization')).toBeTrue();
    });
  });

  describe('picking', () => {
    it('picks Personal', () => {
      const preventDefault = jasmine.createSpy('preventDefault');

      itemWithHref({ context: { kind: 'organization', orgId: 5 }, orgs: ORGS }, '#/').props.onClick({ preventDefault });

      expect(preventDefault).toHaveBeenCalled();
      expect(onPick).toHaveBeenCalledWith({ kind: 'personal' });
    });

    it('picks an organization', () => {
      itemWithHref({ context: PERSONAL, orgs: ORGS }, '#/orgs/6').props.onClick({ preventDefault: () => undefined });

      expect(onPick).toHaveBeenCalledWith({ kind: 'organization', orgId: 6 });
    });
  });
});
