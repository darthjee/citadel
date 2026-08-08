import { buildSecretKeys } from '../secret-keys.js';

/**
 * Runs `buildSecretKeys` against a fake env.
 * @param {Record<string, string | undefined>} env - The fake env var values.
 * @returns {ReturnType<typeof buildSecretKeys>} The resolved keys.
 */
function build(env: Record<string, string | undefined>): ReturnType<typeof buildSecretKeys> {
  const configService = {
    get: jest.fn((key: string, fallback?: string) => env[key] ?? fallback),
  };

  return buildSecretKeys(configService as never);
}

describe('buildSecretKeys', () => {
  it('returns no previous keys when the previous var is unset', () => {
    expect(build({ CITADEL_PLACEHOLDER_SECRET_KEY: 'current' })).toEqual({
      current: 'current',
      previous: [],
      all: ['current'],
    });
  });

  it('defaults the current key to an empty string when unset', () => {
    expect(build({}).current).toBe('');
  });

  it('returns no previous keys when the previous var is empty', () => {
    expect(build({ CITADEL_PLACEHOLDER_SECRET_KEY: 'current', CITADEL_PLACEHOLDER_PREVIOUS_SECRET_KEYS: '' }).previous).toEqual([]);
  });

  it('ignores whitespace and blank entries', () => {
    expect(build({
      CITADEL_PLACEHOLDER_SECRET_KEY: 'current',
      CITADEL_PLACEHOLDER_PREVIOUS_SECRET_KEYS: ' old-1 , , ,old-2 ,  ',
    }).previous).toEqual(['old-1', 'old-2']);
  });

  it('removes the current key and duplicates from the previous keys', () => {
    expect(build({
      CITADEL_PLACEHOLDER_SECRET_KEY: 'current',
      CITADEL_PLACEHOLDER_PREVIOUS_SECRET_KEYS: 'old-2,current,old-1,old-2, current ,old-1',
    }).previous).toEqual(['old-2', 'old-1']);
  });

  it('orders all as [current, ...previous]', () => {
    expect(build({
      CITADEL_PLACEHOLDER_SECRET_KEY: 'current',
      CITADEL_PLACEHOLDER_PREVIOUS_SECRET_KEYS: 'old-1,old-2',
    }).all).toEqual(['current', 'old-1', 'old-2']);
  });
});
