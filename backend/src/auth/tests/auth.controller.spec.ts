import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AccountService } from '../account.service.js';
import { AuthController } from '../auth.controller.js';
import { AuthService } from '../auth.service.js';
import { User } from '../entities/user.entity.js';

type AuthServiceMock = {
  login: jest.Mock;
  register: jest.Mock;
  refresh: jest.Mock;
  logout: jest.Mock;
  status: jest.Mock;
};

function authServiceMock(user: User): AuthServiceMock {
  return {
    login: jest.fn().mockResolvedValue({ user, accessToken: 'signed-access-token', refreshToken: 'a-refresh-token' }),
    register: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn().mockResolvedValue(undefined),
    status: jest.fn(),
  };
}

function defaultConfigService(): { get: jest.Mock } {
  return { get: jest.fn((_key: string, defaultValue: number) => defaultValue) };
}

function responseMock(): jest.Mocked<Pick<Response, 'cookie' | 'set' | 'clearCookie'>> {
  return {
    cookie: jest.fn(),
    set: jest.fn(),
    clearCookie: jest.fn(),
  } as never;
}

// Unit-level coverage for `AuthController`'s `ConfigService`-backed
// access-token cookie `maxAge`, independent of the e2e spec's real
// `INestApplication` — kept lightweight since the only behavior under test
// here is the DI wiring/default-fallback, not the full HTTP stack.
describe('AuthController', () => {
  let user: User;
  let authService: AuthServiceMock;
  let res: jest.Mocked<Pick<Response, 'cookie' | 'set' | 'clearCookie'>>;

  beforeEach(() => {
    user = { id: 1, username: 'darthjee', email: 'darthjee@example.com', isAdmin: false } as User;
    authService = authServiceMock(user);
    res = responseMock();
  });

  function buildController(
    { configService = defaultConfigService(), accountService }: {
      configService?: { get: jest.Mock };
      accountService?: { updateAccount: jest.Mock };
    } = {},
  ): AuthController {
    return new AuthController(
      authService as unknown as AuthService,
      configService as unknown as ConfigService,
      accountService as unknown as AccountService,
    );
  }

  describe('access-token cookie maxAge', () => {
    describe('when CITADEL_PLACEHOLDER_ACCESS_TOKEN_TTL_MS is unset', () => {
      it('defaults to 900000ms (15 minutes)', async () => {
        const configService = defaultConfigService();
        const controller = buildController({ configService });

        await controller.login({ username: 'darthjee', password: 'my-password' }, res as unknown as Response);

        expect(configService.get).toHaveBeenCalledWith('CITADEL_PLACEHOLDER_ACCESS_TOKEN_TTL_MS', 900000);
        expect(res.cookie).toHaveBeenCalledWith(
          'access_token',
          'signed-access-token',
          expect.objectContaining({ maxAge: 900000 }),
        );
      });
    });

    describe('when CITADEL_PLACEHOLDER_ACCESS_TOKEN_TTL_MS is set', () => {
      it('uses the configured value', async () => {
        const configService = { get: jest.fn().mockReturnValue(3_600_000) };
        const controller = buildController({ configService });

        await controller.login({ username: 'darthjee', password: 'my-password' }, res as unknown as Response);

        expect(res.cookie).toHaveBeenCalledWith(
          'access_token',
          'signed-access-token',
          expect.objectContaining({ maxAge: 3_600_000 }),
        );
      });
    });
  });

  describe('DELETE /auth/logoff.json', () => {
    it('revokes the refresh token and clears the access-token cookie', async () => {
      const controller = buildController();

      await controller.logout({ refreshToken: 'a-refresh-token' }, res as unknown as Response);

      expect(authService.logout).toHaveBeenCalledWith('a-refresh-token');
      expect(res.clearCookie).toHaveBeenCalledWith('access_token');
    });
  });

  describe('PATCH /auth/account.json', () => {
    it('delegates to AccountService with the session user id and returns its result', async () => {
      const accountService = {
        updateAccount: jest.fn().mockResolvedValue({ username: 'new-username', email: 'darthjee@example.com' }),
      };
      const controller = buildController({ accountService });
      const dto = { currentPassword: 'my-password', username: 'new-username' };
      const currentUser = { sub: 1, username: 'darthjee', isAdmin: false };

      const result = await controller.updateAccount(dto, currentUser);

      expect(accountService.updateAccount).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual({ username: 'new-username', email: 'darthjee@example.com' });
    });
  });

  describe('POST /auth/status.json', () => {
    describe('when the service reports an active session', () => {
      it('responds with { loggedIn: true, isAdmin }', async () => {
        authService.status.mockResolvedValue({ loggedIn: true, isAdmin: false });
        const controller = buildController();

        const result = await controller.status({ refreshToken: 'a-refresh-token' });

        expect(authService.status).toHaveBeenCalledWith('a-refresh-token');
        expect(result).toEqual({ loggedIn: true, isAdmin: false });
      });
    });

    describe('when the service reports no active session', () => {
      it('responds with { loggedIn: false, isAdmin: false }', async () => {
        authService.status.mockResolvedValue({ loggedIn: false, isAdmin: false });
        const controller = buildController();

        const result = await controller.status({ refreshToken: 'unknown-token' });

        expect(result).toEqual({ loggedIn: false, isAdmin: false });
      });
    });
  });
});
