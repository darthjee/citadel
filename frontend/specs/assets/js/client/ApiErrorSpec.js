import ApiError from '../../../../assets/js/client/ApiError.js';

describe('ApiError', () => {
  it('carries the response status', () => {
    const error = new ApiError(409, 'username is not available');

    expect(error.status).toBe(409);
  });

  it('carries the backend message', () => {
    const error = new ApiError(409, 'username is not available');

    expect(error.message).toBe('username is not available');
  });

  it('carries the backend error code', () => {
    const error = new ApiError(409, 'username is not available', 'USERNAME_TAKEN');

    expect(error.code).toBe('USERNAME_TAKEN');
  });

  it('carries the validation details', () => {
    const details = ['username must be a string', 'email must be an email'];
    const error = new ApiError(400, details.join('; '), 'VALIDATION_FAILED', details);

    expect(error.details).toEqual(details);
  });

  it('leaves code and details undefined when not given', () => {
    const error = new ApiError(500, 'Request failed');

    expect(error.code).toBeUndefined();
    expect(error.details).toBeUndefined();
  });

  it('is named ApiError', () => {
    const error = new ApiError(400, 'bad request');

    expect(error.name).toBe('ApiError');
  });

  it('is an instance of Error', () => {
    const error = new ApiError(400, 'username is not available');

    expect(error instanceof Error).toBe(true);
  });
});
