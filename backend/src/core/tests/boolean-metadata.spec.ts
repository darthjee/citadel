import { readBooleanMetadata } from '../boolean-metadata.js';

/**
 * Builds a minimal fake `Reflector`, only populating the `getAllAndOverride` method
 * `readBooleanMetadata` reads.
 * @param {unknown} value - The value `getAllAndOverride` returns.
 * @returns {{ getAllAndOverride: jest.Mock }} The fake reflector.
 */
function fakeReflector(value: unknown): { getAllAndOverride: jest.Mock } {
  return { getAllAndOverride: jest.fn().mockReturnValue(value) };
}

/**
 * Builds a minimal fake `ExecutionContext`, only populating the `getHandler`/`getClass` methods
 * `readBooleanMetadata` reads.
 * @returns {{ getHandler: jest.Mock; getClass: jest.Mock }} The fake execution context.
 */
function fakeContext(): { getHandler: jest.Mock; getClass: jest.Mock } {
  return {
    getHandler: jest.fn().mockReturnValue('handler'),
    getClass: jest.fn().mockReturnValue('class'),
  };
}

describe('readBooleanMetadata', () => {
  it('returns true when the metadata value is truthy', () => {
    const reflector = fakeReflector(true);
    const context = fakeContext();

    expect(readBooleanMetadata(reflector as never, 'SOME_KEY', context as never)).toBe(true);
  });

  it('returns false when the metadata value is undefined', () => {
    const reflector = fakeReflector(undefined);
    const context = fakeContext();

    expect(readBooleanMetadata(reflector as never, 'SOME_KEY', context as never)).toBe(false);
  });

  it('calls getAllAndOverride with the given key and [handler, class]', () => {
    const reflector = fakeReflector(true);
    const context = fakeContext();

    readBooleanMetadata(reflector as never, 'SOME_KEY', context as never);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith('SOME_KEY', ['handler', 'class']);
  });
});
