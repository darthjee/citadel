import request from 'supertest';
import { loginAs, registerUser, useTestApp } from './auth.controller.e2e-test-support.js';

describe('AuthController (e2e)', () => {
  const ctx = useTestApp();

  describe('cache headers (CacheClass.Never)', () => {
    it('is set on the login response, so Tent never caches it across users', async () => {
      const response = await loginAs(ctx.app).expect(201);

      expect(response.headers['x-skip-cache']).toBe('true');
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('is set on the register response', async () => {
      const response = await registerUser(ctx.app, {
        username: 'obi-wan',
        email: 'obi-wan@example.com',
        password: 'another-password',
      }).expect(201);

      expect(response.headers['x-skip-cache']).toBe('true');
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('is set on the refresh response', async () => {
      const login = await loginAs(ctx.app);

      const response = await request(ctx.app.getHttpServer())
        .post('/auth/refresh.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(201);

      expect(response.headers['x-skip-cache']).toBe('true');
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('is set on the logout response', async () => {
      const login = await loginAs(ctx.app);

      const response = await request(ctx.app.getHttpServer())
        .delete('/auth/logoff.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(204);

      expect(response.headers['x-skip-cache']).toBe('true');
      expect(response.headers['cache-control']).toBe('no-store');
    });
  });
});
