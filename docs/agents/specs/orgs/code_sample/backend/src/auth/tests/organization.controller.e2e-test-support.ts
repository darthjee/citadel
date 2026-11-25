import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { loginCookie, registerUser } from './support/auth-requests.js';
import { buildAuthTestApp, type BuildAuthTestAppResult } from './support/build-auth-test-app.js';

export { loginCookie, registerUser };

// Timeout for one-time (per-file) setup hooks, which run several bcrypt hashes in a row.
export const SETUP_TIMEOUT_MS = 30_000;

export const ORGANIZATION_KEYS = ['created_at', 'id', 'name', 'role', 'updated_at'];

// Every malformed `:orgId` the spec lists (plus `0`): each must answer the same 404 as an unknown id.
export const MALFORMED_ORG_IDS = ['abc', '007', '0', '-1', '1.5', '1e3', '99999999999', '2147483648'];

// Registers the app scaffold for the organization e2e specs (the default `darthjee` user is
// registered by `buildAuthTestApp`): a fresh app per test, or one per file with `perFile: true` (for
// specs whose bcrypt-heavy setup would otherwise exceed the hook timeout; they must undo their own
// state changes). Must be called synchronously inside a `describe` body; the returned getter object
// always points at the current app.
export function useOrganizationTestApp({ perFile = false }: { perFile?: boolean } = {}): {
  readonly current: BuildAuthTestAppResult;
} {
  let current: BuildAuthTestAppResult;

  (perFile ? beforeAll : beforeEach)(async () => {
    current = await buildAuthTestApp();
  }, SETUP_TIMEOUT_MS);

  (perFile ? afterAll : afterEach)(async () => {
    await current.app.close();
  });

  return {
    get current() {
      return current;
    },
  };
}

// Registers `username` and returns its access-token cookie.
export async function registerAndLogin(app: INestApplication, username: string): Promise<string> {
  await registerUser(app, { username, email: `${username}@example.com` }).expect(201);
  return loginCookie(app, username);
}

// `POST /orgs.json` as the cookie's user.
export function createOrganization(app: INestApplication, cookie: string, body: object): request.Test {
  return request(app.getHttpServer()).post('/orgs.json').set('Cookie', [cookie]).send(body);
}

// `GET /orgs/:orgId.json` as the cookie's user.
export function showOrganization(app: INestApplication, cookie: string, orgId: string | number): request.Test {
  return request(app.getHttpServer()).get(`/orgs/${orgId}.json`).set('Cookie', [cookie]);
}

// `PATCH /orgs/:orgId.json` as the cookie's user.
export function renameOrganization(
  app: INestApplication,
  cookie: string,
  orgId: string | number,
  body: object,
): request.Test {
  return request(app.getHttpServer()).patch(`/orgs/${orgId}.json`).set('Cookie', [cookie]).send(body);
}

// The error body without its `timestamp`, for comparing 404s across requests.
export function withoutTimestamp(response: request.Response): object {
  const rest = { ...(response.body as Record<string, unknown>) };
  delete rest.timestamp;
  return rest;
}
