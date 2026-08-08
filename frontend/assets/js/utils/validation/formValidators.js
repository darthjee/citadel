import { validateEmail, validatePasswordConfirmation } from './fieldValidators.js';

/**
 * Validate a required username.
 *
 * @param {string} username - The username value.
 * @returns {object} An error map, empty when a username is present.
 */
function validateRequiredUsername(username) {
  return username ? {} : { username: 'Username is required' };
}

/**
 * Validate a required email: present, then well-formed.
 *
 * @param {string} email - The email value.
 * @returns {object} An error map, empty when the email is present and well-formed.
 */
function validateRequiredEmail(email) {
  if (!email) {
    return { email: 'Email is required' };
  }

  return validateEmail(email);
}

/**
 * Validate a required password.
 *
 * @param {string} password - The password value.
 * @returns {object} An error map, empty when a password is present.
 */
function validateRequiredPassword(password) {
  return password ? {} : { password: 'Password is required' };
}

/**
 * Validate a required password confirmation: present, then matching a non-empty password.
 *
 * @param {string} password - The password value.
 * @param {string} passwordConfirmation - The confirmation value.
 * @returns {object} An error map, empty when the confirmation is present and matches.
 */
function validateRequiredPasswordConfirmation(password, passwordConfirmation) {
  if (!passwordConfirmation) {
    return { passwordConfirmation: 'Password confirmation is required' };
  }

  return password ? validatePasswordConfirmation(password, passwordConfirmation) : {};
}

/**
 * Validate the reset-password (Set-new-password) form: the new password is required and its
 * confirmation must be present and match.
 *
 * @param {{password: string, passwordConfirmation: string}} fields - Current form field
 *   values.
 * @returns {object} A map of field name to error message, empty when the form is valid.
 */
export function validateResetPassword({ password, passwordConfirmation }) {
  return {
    ...validateRequiredPassword(password),
    ...validateRequiredPasswordConfirmation(password, passwordConfirmation),
  };
}

/**
 * Validate the registration form: username, email and password are required, the email must be
 * well-formed, and the password confirmation must be present and match.
 *
 * @param {{username: string, email: string, password: string,
 *   passwordConfirmation: string}} fields - Current form field values.
 * @returns {object} A map of field name to error message, empty when the form is valid.
 */
export function validateRegistration({
  username, email, password, passwordConfirmation,
}) {
  return {
    ...validateRequiredUsername(username),
    ...validateRequiredEmail(email),
    ...validateResetPassword({ password, passwordConfirmation }),
  };
}
