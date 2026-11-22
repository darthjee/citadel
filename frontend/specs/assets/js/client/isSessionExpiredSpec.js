import ApiError from '../../../../assets/js/client/ApiError.js';
import isSessionExpired, { isSessionExpired as named } from '../../../../assets/js/client/isSessionExpired.js';

describe('isSessionExpired', () => {
  it('exports the same function as default and named', () => {
    expect(named).toBe(isSessionExpired);
  });

  it('is true for an ApiError flagged sessionExpired', () => {
    const error = new ApiError(401, 'Unauthorized');

    error.sessionExpired = true;

    expect(isSessionExpired(error)).toBe(true);
  });

  it('is false for an unmarked ApiError', () => {
    expect(isSessionExpired(new ApiError(401, 'Unauthorized'))).toBe(false);
  });

  it('is false for a plain Error', () => {
    expect(isSessionExpired(new Error('boom'))).toBe(false);
  });

  it('is false for undefined', () => {
    expect(isSessionExpired(undefined)).toBe(false);
  });
});
