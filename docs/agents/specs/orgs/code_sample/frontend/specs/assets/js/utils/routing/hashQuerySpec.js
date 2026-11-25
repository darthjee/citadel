import { hashQuery, withHashQuery } from '../../../../../assets/js/utils/routing/hashQuery.js';

describe('hashQuery', () => {
  it('is empty when there is no query', () => {
    expect(hashQuery('#/bank/accounts').toString()).toBe('');
  });

  it('is empty for an empty query', () => {
    expect(hashQuery('#/bank/accounts?').toString()).toBe('');
  });

  it('is empty for a missing hash', () => {
    expect(hashQuery(undefined).toString()).toBe('');
  });

  it('reads a single param', () => {
    expect(hashQuery('#/bank/accounts/12?page=3').get('page')).toBe('3');
  });

  it('reads multiple params', () => {
    const query = hashQuery('#/orgs/5/bank/accounts?archived=true&page=2');

    expect(query.get('archived')).toBe('true');
    expect(query.get('page')).toBe('2');
  });

  it('returns null for an absent param', () => {
    expect(hashQuery('#/x?a=1').get('b')).toBeNull();
  });
});

describe('withHashQuery', () => {
  it('returns the bare path without params', () => {
    expect(withHashQuery('#/bank/accounts')).toBe('#/bank/accounts');
  });

  it('omits empty values', () => {
    expect(withHashQuery('#/bank/accounts', { archived: null, page: undefined, q: '' }))
      .toBe('#/bank/accounts');
  });

  it('appends present values', () => {
    expect(withHashQuery('#/bank/accounts/12', { page: 3, archived: 'true' }))
      .toBe('#/bank/accounts/12?page=3&archived=true');
  });
});
