import { DataSource } from 'typeorm';
import { LoggerService } from '../../core/logger.service.js';
import { HealthService } from '../health.service.js';

describe('HealthService', () => {
  let query: jest.Mock;
  let logger: { error: jest.Mock };
  let service: HealthService;

  beforeEach(() => {
    query = jest.fn();
    logger = { error: jest.fn() };
    service = new HealthService(
      { query } as unknown as DataSource,
      logger as unknown as LoggerService,
    );
  });

  describe('when the database answers', () => {
    beforeEach(() => {
      query.mockResolvedValue([{ 1: 1 }]);
    });

    it('reports status ok with the database up', async () => {
      await expect(service.checkReadiness()).resolves.toEqual({
        status: 'ok',
        checks: { database: 'up' },
      });
    });

    it('probes the database with SELECT 1', async () => {
      await service.checkReadiness();

      expect(query).toHaveBeenCalledWith('SELECT 1');
    });

    it('logs no error', async () => {
      await service.checkReadiness();

      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe('when the database query fails', () => {
    const secret = 'connect ECONNREFUSED 10.0.0.5:3306';

    beforeEach(() => {
      query.mockRejectedValue(new Error(secret));
    });

    it('reports status error with the database down', async () => {
      await expect(service.checkReadiness()).resolves.toEqual({
        status: 'error',
        checks: { database: 'down' },
      });
    });

    it('logs the failure reason', async () => {
      await service.checkReadiness();

      expect(logger.error).toHaveBeenCalledWith('readiness check failed', {
        context: 'HealthService',
        check: 'database',
        reason: secret,
      });
    });

    it('never exposes the error message to the caller', async () => {
      const result = await service.checkReadiness();

      expect(JSON.stringify(result)).not.toContain(secret);
    });
  });

  describe('when the database query rejects with a non-Error value', () => {
    beforeEach(() => {
      query.mockRejectedValue('boom');
    });

    it('reports the database down and logs the stringified reason', async () => {
      const result = await service.checkReadiness();

      expect(result.checks.database).toBe('down');
      expect(logger.error).toHaveBeenCalledWith(
        'readiness check failed',
        expect.objectContaining({ reason: 'boom' }),
      );
    });
  });
});
