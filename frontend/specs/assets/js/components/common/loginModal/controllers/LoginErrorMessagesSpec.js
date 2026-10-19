import LoginErrorMessages, {
  USER_DENIED_MESSAGE,
} from '../../../../../../../assets/js/components/common/loginModal/controllers/LoginErrorMessages.js';
import ApiError from '../../../../../../../assets/js/client/ApiError.js';

describe('LoginErrorMessages', () => {
  describe('USER_DENIED_MESSAGE', () => {
    it('is the frontend-owned denied-account text', () => {
      expect(USER_DENIED_MESSAGE).toBe('This account has been denied access.');
    });
  });

  describe('.forLogin', () => {
    it('maps a USER_DENIED error to the denied-account message', () => {
      const error = new ApiError(403, 'backend wording', 'USER_DENIED');

      expect(LoginErrorMessages.forLogin(error)).toBe(USER_DENIED_MESSAGE);
    });

    it('keeps the error message for any other code', () => {
      const error = new ApiError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');

      expect(LoginErrorMessages.forLogin(error)).toBe('Invalid credentials');
    });

    it('keeps the error message when the error has no code', () => {
      expect(LoginErrorMessages.forLogin(new Error('network down'))).toBe('network down');
    });
  });
});
