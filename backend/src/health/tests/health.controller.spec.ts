import { INestApplication } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CachePolicyInterceptor } from '../../core/cache-policy.interceptor.js';
import { HealthController } from '../health.controller.js';
import { HealthService } from '../health.service.js';

describe('HealthController', () => {
  let checkReadiness: jest.Mock;

  beforeEach(() => {
    checkReadiness = jest.fn();
  });

  it('responds with a status ok payload', () => {
    const service = { checkReadiness } as unknown as HealthService;
    const result = new HealthController(service).check();

    expect(result).toEqual({ status: 'ok' });
  });

  describe('HTTP routes', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        controllers: [HealthController],
        providers: [
          { provide: HealthService, useValue: { checkReadiness: (): unknown => checkReadiness() } },
          { provide: APP_INTERCEPTOR, useClass: CachePolicyInterceptor },
        ],
      }).compile();
      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    describe('GET /health.json', () => {
      let response: request.Response;

      beforeEach(async () => {
        response = await request(app.getHttpServer()).get('/health.json').expect(200);
      });

      it('responds with a status ok payload', () => {
        expect(response.body).toEqual({ status: 'ok' });
      });

      it('does not run the readiness checks', () => {
        expect(checkReadiness).not.toHaveBeenCalled();
      });

      it('sets X-Skip-Cache so Tent never caches the health check', () => {
        expect(response.headers['x-skip-cache']).toBe('true');
      });

      it('sets Cache-Control: no-store', () => {
        expect(response.headers['cache-control']).toBe('no-store');
      });
    });

    describe('GET /ready.json when every dependency is up', () => {
      let response: request.Response;

      beforeEach(async () => {
        checkReadiness.mockResolvedValue({ status: 'ok', checks: { database: 'up' } });
        response = await request(app.getHttpServer()).get('/ready.json');
      });

      it('responds 200', () => {
        expect(response.status).toBe(200);
      });

      it('returns the up body', () => {
        expect(response.body).toEqual({ status: 'ok', checks: { database: 'up' } });
      });

      it('sets X-Skip-Cache: true', () => {
        expect(response.headers['x-skip-cache']).toBe('true');
      });

      it('sets Cache-Control: no-store', () => {
        expect(response.headers['cache-control']).toBe('no-store');
      });
    });

    describe('GET /ready.json when the database is down', () => {
      let response: request.Response;

      beforeEach(async () => {
        checkReadiness.mockResolvedValue({ status: 'error', checks: { database: 'down' } });
        response = await request(app.getHttpServer()).get('/ready.json');
      });

      it('responds 503', () => {
        expect(response.status).toBe(503);
      });

      it('returns exactly the down body', () => {
        expect(response.body).toEqual({ status: 'error', checks: { database: 'down' } });
      });

      it('sets X-Skip-Cache: true', () => {
        expect(response.headers['x-skip-cache']).toBe('true');
      });

      it('sets Cache-Control: no-store', () => {
        expect(response.headers['cache-control']).toBe('no-store');
      });
    });
  });
});
