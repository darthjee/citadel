import bcrypt from 'bcryptjs';
import { User, UserStatus } from '../entities/user.entity.js';
import { UserUpdateService } from '../user-update.service.js';

type RepoMock<T extends object> = {
  save: jest.Mock;
  update: jest.Mock;
} & Partial<T>;

function repoMock<T extends object>(): RepoMock<T> {
  return {
    save: jest.fn(async (entity) => entity),
    update: jest.fn(async () => ({ affected: 1 })),
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
      status: UserStatus.APPROVED,
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
      it('applies all three changes and persists only those columns', async () => {
        const result = await service.applyUserUpdate(user, {
          username: 'new-username',
          email: 'new-email@example.com',
          newPassword: 'brand-new-password',
        });

        expect(result).toEqual({ username: 'new-username', email: 'new-email@example.com' });
        expect(userRepository.update).toHaveBeenCalledWith(1, {
          username: 'new-username',
          email: 'new-email@example.com',
          passwordDigest: user.passwordDigest,
        });
        expect(userRepository.save).not.toHaveBeenCalled();
      });
    });

    describe('when no changes are given', () => {
      it('persists nothing and returns the unchanged { username, email }', async () => {
        const result = await service.applyUserUpdate(user, {});

        expect(result).toEqual({ username: 'darthjee', email: 'darthjee@example.com' });
        expect(userRepository.update).not.toHaveBeenCalled();
        expect(userRepository.save).not.toHaveBeenCalled();
      });
    });

    it.each([
      ['username', { username: 'new-username' }],
      ['email', { email: 'new-email@example.com' }],
      ['newPassword', { newPassword: 'brand-new-password' }],
    ])('never writes status (or any column it does not own) when changing %s', async (_field, changes) => {
      await service.applyUserUpdate(user, changes);

      const [, columns] = userRepository.update.mock.calls[0];

      expect(Object.keys(columns).every((key) => ['username', 'email', 'passwordDigest'].includes(key))).toBe(true);
      expect(columns).not.toHaveProperty('status');
    });
  });
});
