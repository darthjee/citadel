import ApiError from '../../assets/js/client/ApiError.js';
import sessionExpiredError from './sessionExpiredError.js';

describe('sessionExpiredError support', () => {
  it('builds a 401 UNAUTHORIZED ApiError flagged sessionExpired', () => {
    const error = sessionExpiredError();

    expect(error instanceof ApiError).toBe(true);
    expect(error).toEqual(jasmine.objectContaining({
      status: 401, code: 'UNAUTHORIZED', sessionExpired: true,
    }));
  });
});
