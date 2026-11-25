import { hashQuery, withHashQuery } from '../../../../../assets/js/utils/routing/hashQuery.js';

describe('hashQuery', () => {
  it('is empty when there is no query', () => {
    expect(hashQuery('#/module/items').toString()).toBe('');
  });

  it('is empty for an empty query', () => {
    expect(hashQuery('#/module/items?').toString()).toBe('');
  });

  it('is empty for a missing hash', () => {
    expect(hashQuery(undefined).toString()).toBe('');
  });

  it('reads a single param', () => {
    expect(hashQuery('#/module/items/12?page=3').get('page')).toBe('3');
  });

  it('reads multiple params', () => {
    const query = hashQuery('#/orgs/5/module/items?archived=true&page=2');

    expect(query.get('archived')).toBe('true');
    expect(query.get('page')).toBe('2');
  });

  it('returns null for an absent param', () => {
    expect(hashQuery('#/x?a=1').get('b')).toBeNull();
  });
});

describe('withHashQuery', () => {
  it('returns the bare path without params', () => {
    expect(withHashQuery('#/module/items')).toBe('#/module/items');
  });

  it('omits empty values', () => {
    expect(withHashQuery('#/module/items', { archived: null, page: undefined, q: '' }))
      .toBe('#/module/items');
  });

  it('appends present values', () => {
    expect(withHashQuery('#/module/items/12', { page: 3, archived: 'true' }))
      .toBe('#/module/items/12?page=3&archived=true');
  });
});
