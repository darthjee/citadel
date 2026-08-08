import request from 'supertest';
import { expectUniformCreateResponse, useTestApp } from './authorization-request.controller.e2e-test-support.js';

describe('AuthorizationRequestController (e2e)', () => {
  const ctx = useTestApp();

  describe('create', () => {
    it('returns { uuid, pollToken, expiresAt } for a matching username', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/auth/authorization-requests.json')
        .send({ username: 'darthjee' })
        .expect(201);

      expectUniformCreateResponse(response.body);
    });

    it('returns the same shape for a non-matching username', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/auth/authorization-requests.json')
        .send({ username: 'nobody' })
        .expect(201);

      expectUniformCreateResponse(response.body);
    });

    it('sets the X-Skip-Cache header', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/auth/authorization-requests.json')
        .send({ username: 'darthjee' })
        .expect(201);

      expect(response.headers['x-skip-cache']).toBe('true');
    });
  });
});
