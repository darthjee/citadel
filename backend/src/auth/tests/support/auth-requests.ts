import { INestApplication } from '@nestjs/common';
import request from 'supertest';

// Issues `POST /auth/login.json` against `app`. Returns the un-awaited supertest `Test`, so callers can
// either `await` it for the full response or chain their own `.expect(status)` (failing-login specs
// assert their own status). Defaults to the seeded `darthjee` user.
export function loginAs(app: INestApplication, username = 'darthjee', password = 'my-password'): request.Test {
  return request(app.getHttpServer()).post('/auth/login.json').send({ username, password });
}

// Logs `username` in against `app` and returns the `access_token` cookie (`name=value`) to replay
// via `.set('Cookie', [cookie])`.
export async function loginCookie(
  app: INestApplication,
  username?: string,
  password?: string,
): Promise<string> {
  const response = await loginAs(app, username, password);
  return response.headers['set-cookie'][0].split(';')[0];
}

// Issues `POST /auth/register.json` against `app`. Returns the un-awaited supertest `Test`, like `loginAs`.
export function registerUser(
  app: INestApplication,
  { username, email, password = 'my-password' }: { username: string; email: string; password?: string },
): request.Test {
  return request(app.getHttpServer()).post('/auth/register.json').send({ username, email, password });
}
