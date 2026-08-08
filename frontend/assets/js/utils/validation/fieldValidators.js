/** Pattern an email address must match to be considered well-formed. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Minimum password length; mirrors the backend's limit. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Check that an email is well-formed. Only the format is checked; callers decide whether a
 * blank email is an error.
 *
 * @description Returns an error map so the result can be spread into a controller's errors.
 * @param {string} email - The email value to check.
 * @param {string} [field] - The field name the error is keyed under.
 * @returns {object} `{ [field]: 'Email is invalid' }` when malformed, otherwise `{}`.
 */
export function validateEmail(email, field = 'email') {
  return EMAIL_PATTERN.test(email) ? {} : { [field]: 'Email is invalid' };
}

/**
 * Check that a password meets the minimum length.
 *
 * @description Returns an error map so the result can be spread into a controller's errors.
 * @param {string} password - The password value to check.
 * @param {string} [field] - The field name the error is keyed under.
 * @returns {object} `{ [field]: message }` when shorter than {@link MIN_PASSWORD_LENGTH},
 *   otherwise `{}`.
 */
export function validatePasswordLength(password, field = 'password') {
  if (password.length >= MIN_PASSWORD_LENGTH) {
    return {};
  }

  return { [field]: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
}

/**
 * Check that a password confirmation matches the password. Only the match is checked; callers
 * decide whether a blank confirmation is an error.
 *
 * @description Returns an error map so the result can be spread into a controller's errors.
 * @param {string} password - The password value.
 * @param {string} confirmation - The confirmation value to compare against the password.
 * @param {string} [field] - The field name the error is keyed under.
 * @returns {object} `{ [field]: 'Passwords do not match' }` when they differ, otherwise `{}`.
 */
export function validatePasswordConfirmation(password, confirmation, field = 'passwordConfirmation') {
  return password === confirmation ? {} : { [field]: 'Passwords do not match' };
}
