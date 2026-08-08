import {
  validateRegistration,
  validateResetPassword,
} from '../../../../../assets/js/utils/validation/formValidators.js';

describe('formValidators', () => {
  describe('validateResetPassword', () => {
    const validFields = { password: 'secret', passwordConfirmation: 'secret' };

    it('returns no errors for a valid form', () => {
      expect(validateResetPassword(validFields)).toEqual({});
    });

    it('flags a missing password', () => {
      expect(validateResetPassword({ ...validFields, password: '' }).password)
        .toBe('Password is required');
    });

    it('flags a missing password confirmation', () => {
      expect(validateResetPassword({ ...validFields, passwordConfirmation: '' }).passwordConfirmation)
        .toBe('Password confirmation is required');
    });

    it('flags a mismatched password confirmation', () => {
      expect(
        validateResetPassword({ ...validFields, passwordConfirmation: 'other' }).passwordConfirmation,
      ).toBe('Passwords do not match');
    });

    it('does not flag a mismatch when the password is blank', () => {
      expect(validateResetPassword({ password: '', passwordConfirmation: 'other' }))
        .toEqual({ password: 'Password is required' });
    });
  });

  describe('validateRegistration', () => {
    const validFields = {
      username: 'alice',
      email: 'alice@example.com',
      password: 'secret',
      passwordConfirmation: 'secret',
    };

    it('returns no errors for a valid form', () => {
      expect(validateRegistration(validFields)).toEqual({});
    });

    it('flags a missing username', () => {
      expect(validateRegistration({ ...validFields, username: '' }).username)
        .toBe('Username is required');
    });

    it('flags a missing email', () => {
      expect(validateRegistration({ ...validFields, email: '' }).email)
        .toBe('Email is required');
    });

    it('flags a malformed email', () => {
      expect(validateRegistration({ ...validFields, email: 'not-an-email' }).email)
        .toBe('Email is invalid');
    });

    it('flags a missing password', () => {
      expect(validateRegistration({ ...validFields, password: '' }).password)
        .toBe('Password is required');
    });

    it('flags a missing password confirmation', () => {
      expect(validateRegistration({ ...validFields, passwordConfirmation: '' }).passwordConfirmation)
        .toBe('Password confirmation is required');
    });

    it('flags a mismatched password confirmation', () => {
      expect(
        validateRegistration({ ...validFields, passwordConfirmation: 'other' }).passwordConfirmation,
      ).toBe('Passwords do not match');
    });

    it('reports every error for an empty form', () => {
      expect(Object.keys(validateRegistration({
        username: '', email: '', password: '', passwordConfirmation: '',
      }))).toEqual(['username', 'email', 'password', 'passwordConfirmation']);
    });
  });
});
