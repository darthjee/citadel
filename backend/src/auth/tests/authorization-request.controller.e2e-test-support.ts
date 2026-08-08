import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthorizationRequest } from '../entities/authorization-request.entity.js';
import { User } from '../entities/user.entity.js';
import { loginCookie } from './support/auth-requests.js';
import { buildAuthTestApp } from './support/build-auth-test-app.js';
import { createInMemoryRepo, matchesCondition } from './support/in-memory-repo.js';

export { createInMemoryRepo, matchesCondition };

// Builds a fresh app instance wired the same way as the outer `beforeEach` via `buildAuthTestApp()`,
// optionally overriding `ConfigService#get` with `configOverrides` — used by the
// rate-limiting/abuse-hardening tests below to exercise non-default limits without env-var plumbing.
export async function buildTestApp(configOverrides: Record<string, string> = {}): Promise<{
  app: INestApplication;
  userRepo: ReturnType<typeof createInMemoryRepo<User>>;
  authorizationRequestRepo: ReturnType<typeof createInMemoryRepo<AuthorizationRequest>>;
}> {
  const { app, userRepo, authorizationRequestRepo } = await buildAuthTestApp({ configOverrides });

  return { app, userRepo, authorizationRequestRepo };
}

type TestAppContext = Awaited<ReturnType<typeof buildTestApp>>;

// Registers the `beforeEach`/`afterEach` scaffold shared by the e2e specs: builds a fresh app per test
// and closes it afterwards. Must be called synchronously inside a `describe` body. The returned
// context exposes getters because the instances are reassigned before each test.
export function useTestApp(): TestAppContext {
  let current: TestAppContext;

  beforeEach(async () => {
    current = await buildTestApp();
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
    get authorizationRequestRepo() {
      return current.authorizationRequestRepo;
    },
  };
}

// Issues `POST /auth/authorization-requests/mine.json` as the holder of `cookie` and returns the response.
export async function postMine(app: INestApplication, cookie: string): Promise<request.Response> {
  return request(app.getHttpServer())
    .post('/auth/authorization-requests/mine.json')
    .set('Cookie', [cookie])
    .send({})
    .expect(201);
}

// Asserts that `body` has the uniform create-response shape (`uuid`, `pollToken`, `expiresAt`).
export function expectUniformCreateResponse(body: unknown): void {
  expect(body).toEqual({
    uuid: expect.any(String),
    pollToken: expect.any(String),
    expiresAt: expect.any(String),
  });
}

// Raises `count` (default 5) authorization requests against `app`, sending `username(i)` and, when
// `ip` is given, `X-Forwarded-For: ip(i)`, so a limit can be exhausted before the request under test.
export async function fillCreateLimit(
  app: INestApplication,
  options: { username: (index: number) => string; ip?: (index: number) => string; count?: number },
): Promise<void> {
  const { username, ip, count = 5 } = options;

  for (let i = 0; i < count; i++) {
    const call = request(app.getHttpServer()).post('/auth/authorization-requests.json');

    if (ip) {
      call.set('X-Forwarded-For', ip(i));
    }

    await call.send({ username: username(i) }).expect(201);
  }
}

// Raises an authorization request for `username` against `app` and returns its `uuid`/`pollToken`.
export async function createAuthorizationRequest(
  app: INestApplication,
  username = 'darthjee',
): Promise<{ uuid: string; pollToken: string }> {
  const response = await request(app.getHttpServer())
    .post('/auth/authorization-requests.json')
    .send({ username })
    .expect(201);

  return response.body;
}

// Logs `username` in against `app` and returns the `access_token` cookie (`name=value`) to replay
// via `.set('Cookie', [cookie])`.
export async function login(app: INestApplication, username: string, password: string): Promise<string> {
  return loginCookie(app, username, password);
}
