import {
  EMAIL_PATTERN,
  MAX_ORGANIZATION_NAME_LENGTH,
  MAX_TEXT_LENGTH,
  validateRequiredText,
  MIN_PASSWORD_LENGTH,
  validateEmail,
  validateOrganizationName,
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

  describe('validateOrganizationName', () => {
    it('exposes the maximum length', () => {
      expect(MAX_ORGANIZATION_NAME_LENGTH).toBe(255);
    });

    it('returns no errors for a valid name', () => {
      expect(validateOrganizationName('Acme')).toEqual({});
    });

    it('flags an empty name', () => {
      expect(validateOrganizationName('')).toEqual({ name: 'Name is required' });
    });

    it('flags a whitespace-only name', () => {
      expect(validateOrganizationName('   \t ')).toEqual({ name: 'Name is required' });
    });

    it('flags an undefined name', () => {
      expect(validateOrganizationName(undefined)).toEqual({ name: 'Name is required' });
    });

    it('flags a null name', () => {
      expect(validateOrganizationName(null)).toEqual({ name: 'Name is required' });
    });

    it('accepts exactly 255 code points', () => {
      expect(validateOrganizationName('a'.repeat(255))).toEqual({});
    });

    it('flags 256 code points', () => {
      expect(validateOrganizationName('a'.repeat(256))).toEqual({
        name: 'Name must be at most 255 characters',
      });
    });

    it('counts astral characters as one code point each', () => {
      expect(validateOrganizationName('\u{1F600}'.repeat(255))).toEqual({});
    });

    it('flags 256 astral characters', () => {
      expect(validateOrganizationName('\u{1F600}'.repeat(256))).toEqual({
        name: 'Name must be at most 255 characters',
      });
    });

    it('ignores surrounding whitespace when counting', () => {
      expect(validateOrganizationName(`  ${'a'.repeat(255)}  `)).toEqual({});
    });

    it('keys the error under a custom field name', () => {
      expect(validateOrganizationName('', 'orgName')).toEqual({ orgName: 'Name is required' });
    });
  });

  describe('validateRequiredText', () => {
    it('exposes the maximum length', () => {
      expect(MAX_TEXT_LENGTH).toBe(255);
    });

    it('accepts a present value', () => {
      expect(validateRequiredText(' Groceries ', 'name', 'Name')).toEqual({});
    });

    [undefined, null, '', '   '].forEach((value) => {
      it(`requires a value (${JSON.stringify(value)})`, () => {
        expect(validateRequiredText(value, 'name', 'Name')).toEqual({ name: 'Name is required' });
      });
    });

    it('accepts exactly the maximum length, in code points', () => {
      expect(validateRequiredText('😀'.repeat(255), 'description', 'Description')).toEqual({});
    });

    it('rejects a value longer than the maximum', () => {
      expect(validateRequiredText('a'.repeat(256), 'description', 'Description'))
        .toEqual({ description: 'Description must be at most 255 characters' });
    });
  });
});
