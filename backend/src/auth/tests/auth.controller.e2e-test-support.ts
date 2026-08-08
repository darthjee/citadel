import { Controller, Get, INestApplication } from '@nestjs/common';
import { Public } from '../../core/public.decorator.js';
import { PasswordResetToken } from '../entities/password-reset-token.entity.js';
import { RefreshToken } from '../entities/refresh-token.entity.js';
import { User } from '../entities/user.entity.js';
import { loginAs, loginCookie, registerUser } from './support/auth-requests.js';
import { buildAuthTestApp } from './support/build-auth-test-app.js';
import { createInMemoryRepo, matchesCondition } from './support/in-memory-repo.js';

export { createInMemoryRepo, loginAs, loginCookie, matchesCondition, registerUser };

// Throwaway controller used only to exercise the global `JwtGuard` — the
// Auth module's own routes are all `@Public()` by design.
@Controller('protected')
export class ProtectedTestController {
  @Get()
  ping(): { ok: boolean } {
    return { ok: true };
  }
}

@Controller('public')
export class PublicTestController {
  @Public()
  @Get()
  ping(): { ok: boolean } {
    return { ok: true };
  }
}

// Builds a fresh app instance wired the same way across every
// `AuthController (e2e)` spec file via `buildAuthTestApp()`, adding the two
// `JwtGuard`-exercising test controllers.
//
// Options (defaults preserve the shared builder's behavior):
// - `adminGuard: true` also registers the `APP_GUARD`/`AdminGuard` provider,
//   after `JwtGuard`.
// - `registerDefaultUser: false` skips registering the `darthjee` user, for
//   specs that register their own users.
export async function buildTestApp({
  adminGuard = false,
  registerDefaultUser = true,
}: { adminGuard?: boolean; registerDefaultUser?: boolean } = {}): Promise<{
  app: INestApplication;
  userRepo: ReturnType<typeof createInMemoryRepo<User>>;
  refreshTokenRepo: ReturnType<typeof createInMemoryRepo<RefreshToken>>;
  passwordResetTokenRepo: ReturnType<typeof createInMemoryRepo<PasswordResetToken>>;
}> {
  const { app, userRepo, refreshTokenRepo, passwordResetTokenRepo } = await buildAuthTestApp({
    adminGuard,
    registerDefaultUser,
    controllers: [ProtectedTestController, PublicTestController],
  });

  return { app, userRepo, refreshTokenRepo, passwordResetTokenRepo };
}

type TestAppContext = Awaited<ReturnType<typeof buildTestApp>>;

// Registers the `beforeEach`/`afterEach` scaffold shared by the auth e2e specs: builds a fresh app per
// test (forwarding `options` to `buildTestApp`) and closes it afterwards. Must be called synchronously
// inside a `describe` body. The returned context exposes getters because the instances are reassigned
// before each test.
export function useTestApp(options: { adminGuard?: boolean; registerDefaultUser?: boolean } = {}): TestAppContext {
  let current: TestAppContext;

  beforeEach(async () => {
    current = await buildTestApp(options);
  });

  afterEach(async () => {
    await current.app.close();
  });

  return {
    get app() {
      return current.app;
    },
    get userRepo() {
      return current.userRepo;
    },
    get refreshTokenRepo() {
      return current.refreshTokenRepo;
    },
    get passwordResetTokenRepo() {
      return current.passwordResetTokenRepo;
    },
  };
}
