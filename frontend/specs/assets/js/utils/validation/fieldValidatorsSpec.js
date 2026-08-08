import {
  EMAIL_PATTERN,
  MIN_PASSWORD_LENGTH,
  validateEmail,
  validatePasswordLength,
  validatePasswordConfirmation,
} from '../../../../../assets/js/utils/validation/fieldValidators.js';

describe('fieldValidators', () => {
  describe('constants', () => {
    it('exposes the minimum password length', () => {
      expect(MIN_PASSWORD_LENGTH).toBe(8);
    });

    it('exposes the email pattern', () => {
      expect(EMAIL_PATTERN.test('a@b.co')).toBe(true);
    });
  });

  describe('validateEmail', () => {
    it('returns no errors for a well-formed email', () => {
      expect(validateEmail('a@b.co')).toEqual({});
    });

    it('flags a malformed email', () => {
      expect(validateEmail('not-an-email')).toEqual({ email: 'Email is invalid' });
    });

    it('flags a blank email', () => {
      expect(validateEmail('')).toEqual({ email: 'Email is invalid' });
    });

    it('keys the error under a custom field name', () => {
      expect(validateEmail('nope', 'contact')).toEqual({ contact: 'Email is invalid' });
    });
  });

  describe('validatePasswordLength', () => {
    it('returns no errors for a password of the minimum length', () => {
      expect(validatePasswordLength('a'.repeat(MIN_PASSWORD_LENGTH))).toEqual({});
    });

    it('flags a password that is too short', () => {
      expect(validatePasswordLength('short')).toEqual({
        password: 'Password must be at least 8 characters',
      });
    });

    it('keys the error under a custom field name', () => {
      expect(validatePasswordLength('short', 'newPassword')).toEqual({
        newPassword: 'Password must be at least 8 characters',
      });
    });
  });

  describe('validatePasswordConfirmation', () => {
    it('returns no errors when the values match', () => {
      expect(validatePasswordConfirmation('secret', 'secret')).toEqual({});
    });

    it('flags a mismatch', () => {
      expect(validatePasswordConfirmation('secret', 'other')).toEqual({
        passwordConfirmation: 'Passwords do not match',
      });
    });

    it('flags a blank confirmation against a non-blank password', () => {
      expect(validatePasswordConfirmation('secret', '')).toEqual({
        passwordConfirmation: 'Passwords do not match',
      });
    });

    it('keys the error under a custom field name', () => {
      expect(validatePasswordConfirmation('secret', 'other', 'newPasswordConfirmation')).toEqual({
        newPasswordConfirmation: 'Passwords do not match',
      });
    });
  });
});
