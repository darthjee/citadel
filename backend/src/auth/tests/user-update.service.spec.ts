import bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity.js';
import { UserUpdateService } from '../user-update.service.js';

type RepoMock<T extends object> = {
  save: jest.Mock;
} & Partial<T>;

function repoMock<T extends object>(): RepoMock<T> {
  return {
    save: jest.fn(async (entity) => entity),
  } as RepoMock<T>;
}

describe('UserUpdateService', () => {
  let userRepository: RepoMock<User>;
  let service: UserUpdateService;
  let user: User;
  let originalDigest: string;

  beforeEach(async () => {
    originalDigest = await bcrypt.hash('original-password', 4);
    user = {
      id: 1,
      username: 'darthjee',
      email: 'darthjee@example.com',
      passwordDigest: originalDigest,
      isAdmin: false,
    } as User;

    userRepository = repoMock<User>();
    service = new UserUpdateService(userRepository as never);
  });

  describe('applyUserUpdate', () => {
    describe('when only a username change is given', () => {
      it('updates the username and returns the resulting { username, email }', async () => {
        const result = await service.applyUserUpdate(user, { username: 'new-username' });

        expect(result).toEqual({ username: 'new-username', email: 'darthjee@example.com' });
      });

      it('leaves the password digest untouched', async () => {
        await service.applyUserUpdate(user, { username: 'new-username' });

        expect(user.passwordDigest).toBe(originalDigest);
      });
    });

    describe('when only an email change is given', () => {
      it('updates the email and returns the resulting { username, email }', async () => {
        const result = await service.applyUserUpdate(user, { email: 'new-email@example.com' });

        expect(result).toEqual({ username: 'darthjee', email: 'new-email@example.com' });
      });
    });

    describe('when only a newPassword is given', () => {
      it('hashes and stores the new password digest', async () => {
        await service.applyUserUpdate(user, { newPassword: 'brand-new-password' });

        expect(user.passwordDigest).not.toBe(originalDigest);
        await expect(bcrypt.compare('brand-new-password', user.passwordDigest)).resolves.toBe(true);
      });

      it('returns the unchanged { username, email }', async () => {
        const result = await service.applyUserUpdate(user, { newPassword: 'brand-new-password' });

        expect(result).toEqual({ username: 'darthjee', email: 'darthjee@example.com' });
      });
    });

    describe('when username, email, and newPassword are all given', () => {
      it('applies all three changes and persists the user', async () => {
        const result = await service.applyUserUpdate(user, {
          username: 'new-username',
          email: 'new-email@example.com',
          newPassword: 'brand-new-password',
        });

        expect(result).toEqual({ username: 'new-username', email: 'new-email@example.com' });
        expect(userRepository.save).toHaveBeenCalledWith(user);
      });
    });

    describe('when no changes are given', () => {
      it('persists the user unchanged', async () => {
        const result = await service.applyUserUpdate(user, {});

        expect(result).toEqual({ username: 'darthjee', email: 'darthjee@example.com' });
        expect(userRepository.save).toHaveBeenCalledWith(user);
      });
    });
  });
});
