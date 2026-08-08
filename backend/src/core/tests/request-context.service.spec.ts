import { RequestContextService } from '../request-context.service.js';

describe('RequestContextService', () => {
  const service = new RequestContextService();

  describe('getRequestId', () => {
    it('returns undefined when called outside any run()', () => {
      expect(service.getRequestId()).toBeUndefined();
    });

    it('returns the bound requestId inside run()', () => {
      service.run('abc', () => {
        expect(service.getRequestId()).toBe('abc');
      });
    });
  });

  describe('run', () => {
    it('returns the callback return value', () => {
      const result = service.run('abc', () => 42);

      expect(result).toBe(42);
    });

    it('shadows the outer requestId within a nested run() and restores it after', () => {
      service.run('outer', () => {
        expect(service.getRequestId()).toBe('outer');

        service.run('inner', () => {
          expect(service.getRequestId()).toBe('inner');
        });

        expect(service.getRequestId()).toBe('outer');
      });

      expect(service.getRequestId()).toBeUndefined();
    });
  });
});
