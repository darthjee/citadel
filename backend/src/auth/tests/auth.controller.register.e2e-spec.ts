import { registerUser, useTestApp } from './auth.controller.e2e-test-support.js';
import { expectErrorBody, expectValidationErrorBody } from './support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';
import { hashToken } from '../../core/token-hash.js';
import { User, UserStatus } from '../entities/user.entity.js';
import { buildAuthTestApp, type BuildAuthTestAppResult } from './support/build-auth-test-app.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('AuthController (e2e)', () => {
  const ctx = useTestApp();

  describe('sessions', () => {
    it('persists the refresh token with a fresh session, distinct from other sessions', async () => {
      const before = Date.now();
      const response = await registerUser(ctx.app, { username: 'newcomer', email: 'newcomer@example.com' }).expect(201);
      const row = ctx.refreshTokenRepo.rows.find((candidate) => candidate.tokenHash === hashToken(response.body.refreshToken));

      expect(row?.sessionUuid).toMatch(UUID_PATTERN);
      expect(row?.startedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(ctx.refreshTokenRepo.rows.filter((candidate) => candidate.sessionUuid === row?.sessionUuid)).toHaveLength(1);
    });
  });

  describe('POST /auth/register.json error bodies', () => {
    it('answers an invalid payload with 400 VALIDATION_FAILED and the message list as details', async () => {
      const response = await registerUser(ctx.app, { username: '', email: 'not-an-email', password: 'short' });

      expectValidationErrorBody(response);
      expect(response.body.error.details).toEqual(
        expect.arrayContaining(['email must be an email', 'password must be longer than or equal to 8 characters']),
      );
    });

    it('answers a taken username with 409 USERNAME_TAKEN', async () => {
      const response = await registerUser(ctx.app, { username: 'darthjee', email: 'other@example.com' });

      expectErrorBody(response, {
        status: 409,
        code: ErrorCodes.USERNAME_TAKEN,
        message: 'username is not available',
      });
    });

    it('answers a taken email with 409 EMAIL_TAKEN', async () => {
      const response = await registerUser(ctx.app, { username: 'someone-else', email: 'darthjee@example.com' });

      expectErrorBody(response, {
        status: 409,
        code: ErrorCodes.EMAIL_TAKEN,
        message: 'email is not available',
      });
    });
  });
});

describe('AuthController (e2e) — registration status', () => {
  const FLAG = 'CITADEL_PLACEHOLDER_USER_APPROVAL_REQUIRED';
  let current: BuildAuthTestAppResult;

  async function build(flag: string): Promise<BuildAuthTestAppResult> {
    current = await buildAuthTestApp({ registerDefaultUser: false, configOverrides: { [FLAG]: flag } });
    return current;
  }

  function seedUser(status: UserStatus, username = 'seeded'): User {
    const user = {
      id: 100,
      username,
      email: `${username}@example.com`,
      passwordDigest: 'irrelevant',
      isAdmin: false,
      status,
    } as User;
    current.userRepo.rows.push(user);
    return user;
  }

  afterEach(async () => {
    await current.app.close();
  });

  it('stores a new user as approved when the flag is off', async () => {
    const { app, userRepo } = await build('false');

    await registerUser(app, { username: 'newcomer', email: 'newcomer@example.com' }).expect(201);

    expect(userRepo.rows.find((row) => row.username === 'newcomer')?.status).toBe(UserStatus.APPROVED);
  });

  it('stores a new user as pending when the flag is on', async () => {
    const { app, userRepo } = await build('true');

    await registerUser(app, { username: 'newcomer', email: 'newcomer@example.com' }).expect(201);

    expect(userRepo.rows.find((row) => row.username === 'newcomer')?.status).toBe(UserStatus.PENDING);
  });

  it('answers the same shape with and without the flag, never carrying the status', async () => {
    const off = await registerUser((await build('false')).app, { username: 'off', email: 'off@example.com' });
    await current.app.close();
    const on = await registerUser((await build('true')).app, { username: 'on', email: 'on@example.com' });

    expect(Object.keys(on.body).sort()).toEqual(Object.keys(off.body).sort());
    expect(Object.keys(on.body.user).sort()).toEqual(Object.keys(off.body.user).sort());
    expect(on.body.user).not.toHaveProperty('status');
    expect(off.body.user).not.toHaveProperty('status');
  });

  it("answers a denied user's username with the existing 409 USERNAME_TAKEN", async () => {
    const { app } = await build('true');
    seedUser(UserStatus.DENIED, 'refused');

    const response = await registerUser(app, { username: 'refused', email: 'fresh@example.com' });

    expectErrorBody(response, { status: 409, code: ErrorCodes.USERNAME_TAKEN, message: 'username is not available' });
  });

  it("answers a denied user's email with the existing 409 EMAIL_TAKEN", async () => {
    const { app } = await build('false');
    seedUser(UserStatus.DENIED, 'refused');

    const response = await registerUser(app, { username: 'fresh', email: 'refused@example.com' });

    expectErrorBody(response, { status: 409, code: ErrorCodes.EMAIL_TAKEN, message: 'email is not available' });
  });

  it('keeps an existing approved user approved when the app boots with the flag on', async () => {
    const { app } = await build('true');
    const user = seedUser(UserStatus.APPROVED);

    await registerUser(app, { username: 'newcomer', email: 'newcomer@example.com' }).expect(201);

    expect(user.status).toBe(UserStatus.APPROVED);
  });

  it('keeps an existing pending user pending when the app boots with the flag off', async () => {
    const { app } = await build('false');
    const user = seedUser(UserStatus.PENDING);

    await registerUser(app, { username: 'newcomer', email: 'newcomer@example.com' }).expect(201);

    expect(user.status).toBe(UserStatus.PENDING);
  });
});
