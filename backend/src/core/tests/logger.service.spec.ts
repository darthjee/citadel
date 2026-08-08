import { Injectable, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { LoggerService } from '../logger.service.js';
import { LoggingModule } from '../logging.module.js';
import { clearConsoleSpies, createConsoleSpies, restoreConsoleSpies } from './console-spies.test-support.js';

/**
 * Builds a `ConfigService` double that returns `level` for
 * `CITADEL_PLACEHOLDER_LOG_LEVEL` and falls back to the caller-supplied default
 * otherwise, mirroring how `@nestjs/config`'s real `ConfigService.get`
 * behaves.
 * @param {string} [level] - The value to return for `CITADEL_PLACEHOLDER_LOG_LEVEL`; `undefined` to fall through to the default.
 * @returns {{ get: jest.Mock }} The `ConfigService` double.
 */
function buildConfigService(level?: string): { get: jest.Mock } {
  return {
    get: jest.fn((_key: string, defaultValue?: unknown) => level ?? defaultValue),
  };
}

/**
 * Builds a `RequestContextService` double whose `getRequestId()` returns the
 * supplied `requestId` (or `undefined` for "no active request context").
 * @param {string} [requestId] - The correlation id to report as active.
 * @returns {{ getRequestId: jest.Mock }} The `RequestContextService` double.
 */
function buildRequestContext(requestId?: string): { getRequestId: jest.Mock } {
  return { getRequestId: jest.fn(() => requestId) };
}

describe('LoggerService', () => {
  const consoleSpies = createConsoleSpies();

  afterEach(() => {
    clearConsoleSpies(consoleSpies);
  });

  afterAll(() => {
    restoreConsoleSpies(consoleSpies);
  });

  describe('default level', () => {
    const service = new LoggerService(buildConfigService() as never, buildRequestContext() as never);

    it('defaults to info, filtering out debug', () => {
      service.debug('hidden');

      expect(consoleSpies.debug).not.toHaveBeenCalled();
    });

    it('defaults to info, allowing info and above', () => {
      service.info('shown');

      expect(consoleSpies.info).toHaveBeenCalledWith('shown');
    });
  });

  describe('configured level override', () => {
    const service = new LoggerService(buildConfigService('debug') as never, buildRequestContext() as never);

    it('allows debug when the threshold is lowered', () => {
      service.debug('now visible');

      expect(consoleSpies.debug).toHaveBeenCalledWith('now visible');
    });
  });

  describe('level filtering', () => {
    const service = new LoggerService(buildConfigService('warn') as never, buildRequestContext() as never);

    it('suppresses a level below the threshold', () => {
      service.info('suppressed');

      expect(consoleSpies.info).not.toHaveBeenCalled();
    });

    it('emits a level at the threshold', () => {
      service.warn('at threshold');

      expect(consoleSpies.warn).toHaveBeenCalledWith('at threshold');
    });

    it('emits a level above the threshold', () => {
      service.error('above threshold');

      expect(consoleSpies.error).toHaveBeenCalledWith('above threshold');
    });
  });

  describe('structured attributes', () => {
    const service = new LoggerService(buildConfigService('debug') as never, buildRequestContext() as never);

    it('passes the attributes object unmodified as the second console argument', () => {
      const attributes = { userId: 42, nested: { flag: true } };

      service.info('message with attributes', attributes);

      expect(consoleSpies.info).toHaveBeenCalledWith('message with attributes', attributes);
    });

    it('accepts a plain attributes object on error(), with no special Error-instance handling', () => {
      const attributes = { message: 'boom', stack: 'fake-stack' };

      service.error('caught exception', attributes);

      expect(consoleSpies.error).toHaveBeenCalledWith('caught exception', attributes);
    });
  });

  describe('NestJS LoggerService interface methods', () => {
    const service = new LoggerService(buildConfigService('debug') as never, buildRequestContext() as never);

    it('routes log() to the info level', () => {
      service.log('via log');

      expect(consoleSpies.info).toHaveBeenCalledWith('via log');
    });

    it('filters log() the same as info() would be filtered', () => {
      const infoService = new LoggerService(buildConfigService('warn') as never, buildRequestContext() as never);

      infoService.log('suppressed via log');

      expect(consoleSpies.info).not.toHaveBeenCalled();
    });

    it('routes warn() to the same behavior as the warn level', () => {
      service.warn('via warn');

      expect(consoleSpies.warn).toHaveBeenCalledWith('via warn');
    });

    it('routes error() to the same behavior as the error level', () => {
      service.error('via error');

      expect(consoleSpies.error).toHaveBeenCalledWith('via error');
    });

    it('routes debug() to the same behavior as the debug level', () => {
      service.debug('via debug');

      expect(consoleSpies.debug).toHaveBeenCalledWith('via debug');
    });

    it('routes verbose() to the debug level, collecting optionalParams into attributes', () => {
      service.verbose('via verbose', 'extra');

      expect(consoleSpies.debug).toHaveBeenCalledWith('via verbose', { optionalParams: ['extra'] });
    });
  });

  describe('request context correlation', () => {
    it('merges the active requestId into a message logged with no attributes', () => {
      const service = new LoggerService(
        buildConfigService('debug') as never,
        buildRequestContext('req-1') as never,
      );

      service.info('msg');

      expect(consoleSpies.info).toHaveBeenCalledWith('msg', { requestId: 'req-1' });
    });

    it('merges the active requestId alongside caller-supplied attributes', () => {
      const service = new LoggerService(
        buildConfigService('debug') as never,
        buildRequestContext('req-1') as never,
      );

      service.info('msg', { userId: 7 });

      expect(consoleSpies.info).toHaveBeenCalledWith('msg', { requestId: 'req-1', userId: 7 });
    });

    it('lets a caller-supplied requestId win over the active context', () => {
      const service = new LoggerService(
        buildConfigService('debug') as never,
        buildRequestContext('req-1') as never,
      );

      service.info('msg', { requestId: 'caller' });

      expect(consoleSpies.info).toHaveBeenCalledWith('msg', { requestId: 'caller' });
    });

    it('keeps the single-argument console path when no context is active', () => {
      const service = new LoggerService(
        buildConfigService('debug') as never,
        buildRequestContext() as never,
      );

      service.info('msg');

      expect(consoleSpies.info).toHaveBeenCalledWith('msg');
    });
  });

  describe('cross-module injection', () => {
    // Trivial throwaway service/module used only to prove `LoggingModule` is
    // actually injectable from a module that never declares `LoggerService`
    // as its own provider — not a real feature module.
    @Injectable()
    class ThrowawayConsumer {
      readonly logger: LoggerService;

      constructor(logger: LoggerService) {
        this.logger = logger;
      }
    }

    @Module({ imports: [LoggingModule], providers: [ThrowawayConsumer] })
    class ThrowawayModule {}

    it('injects LoggerService into a provider declared in a different module', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({ isGlobal: true }), ThrowawayModule],
      }).compile();

      const consumer = moduleRef.get(ThrowawayConsumer);

      expect(consumer.logger).toBeInstanceOf(LoggerService);

      await moduleRef.close();
    });
  });
});
