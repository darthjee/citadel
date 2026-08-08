import { computeLockoutState } from '../lockout-state.js';

describe('computeLockoutState', () => {
  it('increments attempts and does not lock when below maxAttempts', () => {
    const result = computeLockoutState(1, 5, 60000);

    expect(result).toEqual({ attempts: 2, lockedUntil: null });
  });

  it('locks when attempts reach maxAttempts exactly (>= tie-break)', () => {
    const before = Date.now();
    const result = computeLockoutState(4, 5, 60000);
    const after = Date.now();

    expect(result.attempts).toBe(5);
    expect(result.lockedUntil).not.toBeNull();
    expect(result.lockedUntil!.getTime()).toBeGreaterThanOrEqual(before + 60000);
    expect(result.lockedUntil!.getTime()).toBeLessThanOrEqual(after + 60000);
  });

  it('still locks when attempts are already past maxAttempts', () => {
    const result = computeLockoutState(10, 5, 60000);

    expect(result.attempts).toBe(11);
    expect(result.lockedUntil).not.toBeNull();
  });

  it('sets lockedUntil roughly lockMs in the future when it trips', () => {
    const before = Date.now();
    const { lockedUntil } = computeLockoutState(4, 5, 30000);
    const after = Date.now();

    expect(lockedUntil!.getTime()).toBeGreaterThanOrEqual(before + 30000);
    expect(lockedUntil!.getTime()).toBeLessThanOrEqual(after + 30000);
  });
});
