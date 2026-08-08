import { LogContext } from '../log-context.js';

/**
 * Builds a `LoggerService` double exposing the four level methods as spies.
 * @returns {{ debug: jest.Mock, info: jest.Mock, warn: jest.Mock, error: jest.Mock }} The double.
 */
function buildLogger(): { debug: jest.Mock; info: jest.Mock; warn: jest.Mock; error: jest.Mock } {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

describe('LogContext', () => {
  it('merges the bound attributes into a call with no per-call attributes', () => {
    const logger = buildLogger();
    const context = new LogContext(logger as never, { requestId: 'r1', scope: 'job' });

    context.info('hi');

    expect(logger.info).toHaveBeenCalledWith('hi', { requestId: 'r1', scope: 'job' });
  });

  it('merges the bound attributes with per-call attributes', () => {
    const logger = buildLogger();
    const context = new LogContext(logger as never, { requestId: 'r1', scope: 'job' });

    context.warn('hi', { extra: 1 });

    expect(logger.warn).toHaveBeenCalledWith('hi', { requestId: 'r1', scope: 'job', extra: 1 });
  });

  it('lets a per-call key win over the bound value', () => {
    const logger = buildLogger();
    const context = new LogContext(logger as never, { requestId: 'r1', scope: 'job' });

    context.info('hi', { scope: 'override' });

    expect(logger.info).toHaveBeenCalledWith('hi', { requestId: 'r1', scope: 'override' });
  });

  it('forwards debug and error through the wrapped logger', () => {
    const logger = buildLogger();
    const context = new LogContext(logger as never, { requestId: 'r1' });

    context.debug('d');
    context.error('e');

    expect(logger.debug).toHaveBeenCalledWith('d', { requestId: 'r1' });
    expect(logger.error).toHaveBeenCalledWith('e', { requestId: 'r1' });
  });

  it('keeps a defensive copy of the bound attributes', () => {
    const logger = buildLogger();
    const attributes = { requestId: 'r1' };
    const context = new LogContext(logger as never, attributes);

    attributes.requestId = 'mutated';
    context.info('hi');

    expect(logger.info).toHaveBeenCalledWith('hi', { requestId: 'r1' });
  });
});
