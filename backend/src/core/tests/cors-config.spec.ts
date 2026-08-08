import { buildCorsOptions } from '../cors-config.js';

/**
 * Builds a minimal fake `ConfigService` whose `get` returns values from `env`.
 * @param {Record<string, string | undefined>} env - The fake env var values.
 * @returns {{ get: jest.Mock }} The fake config service.
 */
function fakeConfigService(env: Record<string, string | undefined>): { get: jest.Mock } {
  return { get: jest.fn((key: string) => env[key]) };
}

/**
 * Runs `buildCorsOptions` against a fake env.
 * @param {Record<string, string | undefined>} env - The fake env var values.
 * @returns {ReturnType<typeof buildCorsOptions>} The resolved options.
 */
function build(env: Record<string, string | undefined>): ReturnType<typeof buildCorsOptions> {
  return buildCorsOptions(fakeConfigService(env) as never);
}

describe('buildCorsOptions', () => {
  describe('with CITADEL_PLACEHOLDER_ALLOWED_ORIGINS', () => {
    it('returns a single origin', () => {
      expect(build({ CITADEL_PLACEHOLDER_ALLOWED_ORIGINS: 'https://app.example.com' })).toEqual({
        origin: ['https://app.example.com'],
        credentials: true,
      });
    });

    it('returns multiple comma-separated origins, trimming whitespace', () => {
      expect(build({ CITADEL_PLACEHOLDER_ALLOWED_ORIGINS: ' https://a.example.com , http://localhost:3000 ' })).toEqual({
        origin: ['https://a.example.com', 'http://localhost:3000'],
        credentials: true,
      });
    });

    it('returns frozen options', () => {
      expect(Object.isFrozen(build({ CITADEL_PLACEHOLDER_ALLOWED_ORIGINS: 'https://a.example.com' }))).toBe(true);
    });

    it('takes precedence over FRONTEND_BASE_URL', () => {
      expect(build({
        CITADEL_PLACEHOLDER_ALLOWED_ORIGINS: 'https://a.example.com',
        FRONTEND_BASE_URL: 'https://b.example.com',
      })).toEqual({ origin: ['https://a.example.com'], credentials: true });
    });

    it.each([
      ['an empty entry', 'https://a.example.com,,https://b.example.com', '""'],
      ['a trailing comma', 'https://a.example.com,', '""'],
      ['a path', 'https://a.example.com/app', '"https://a.example.com/app"'],
      ['a trailing slash', 'https://a.example.com/', '"https://a.example.com/"'],
      ['a query', 'https://a.example.com?x=1', '"https://a.example.com?x=1"'],
      ['a fragment', 'https://a.example.com#x', '"https://a.example.com#x"'],
      ['credentials', 'https://u:p@a.example.com', '"https://u:p@a.example.com"'],
      ['a default port', 'https://a.example.com:443', '"https://a.example.com:443"'],
      ['an uppercase host', 'https://A.example.com', '"https://A.example.com"'],
      ['a non-http(s) scheme', 'ftp://a.example.com', '"ftp://a.example.com"'],
      ['garbage input', 'not a url', '"not a url"'],
    ])('throws on %s, naming the entry', (_label, value, quoted) => {
      expect(() => build({ CITADEL_PLACEHOLDER_ALLOWED_ORIGINS: value })).toThrow(
        `Invalid CITADEL_PLACEHOLDER_ALLOWED_ORIGINS entry ${quoted}`,
      );
    });

    describe('with the wildcard', () => {
      it('throws when NODE_ENV is production', () => {
        expect(() => build({ CITADEL_PLACEHOLDER_ALLOWED_ORIGINS: '*', NODE_ENV: 'production' })).toThrow(
          'Invalid CITADEL_PLACEHOLDER_ALLOWED_ORIGINS entry "*"',
        );
      });

      it('returns origin: true when NODE_ENV is development', () => {
        expect(build({ CITADEL_PLACEHOLDER_ALLOWED_ORIGINS: '*', NODE_ENV: 'development' })).toEqual({
          origin: true,
          credentials: true,
        });
      });

      it('returns origin: true when NODE_ENV is unset', () => {
        expect(build({ CITADEL_PLACEHOLDER_ALLOWED_ORIGINS: '*' })).toEqual({ origin: true, credentials: true });
      });

      it('throws when mixed with other origins', () => {
        expect(() => build({ CITADEL_PLACEHOLDER_ALLOWED_ORIGINS: '*,https://a.example.com' })).toThrow(
          'wildcard must be the sole entry',
        );
      });
    });
  });

  describe('with only FRONTEND_BASE_URL', () => {
    it('returns the origin, dropping the path', () => {
      expect(build({ FRONTEND_BASE_URL: 'https://app.example.com/some/path' })).toEqual({
        origin: ['https://app.example.com'],
        credentials: true,
      });
    });

    it('falls back to it when CITADEL_PLACEHOLDER_ALLOWED_ORIGINS is blank', () => {
      expect(build({ CITADEL_PLACEHOLDER_ALLOWED_ORIGINS: '  ', FRONTEND_BASE_URL: 'http://localhost:3000' })).toEqual({
        origin: ['http://localhost:3000'],
        credentials: true,
      });
    });

    it('throws when unparseable', () => {
      expect(() => build({ FRONTEND_BASE_URL: 'garbage' })).toThrow('Invalid FRONTEND_BASE_URL "garbage"');
    });

    it('throws when not http(s)', () => {
      expect(() => build({ FRONTEND_BASE_URL: 'ftp://app.example.com' })).toThrow('Invalid FRONTEND_BASE_URL');
    });
  });

  describe('with neither variable', () => {
    it('returns undefined when both are unset', () => {
      expect(build({})).toBeUndefined();
    });

    it('returns undefined when both are blank', () => {
      expect(build({ CITADEL_PLACEHOLDER_ALLOWED_ORIGINS: ' ', FRONTEND_BASE_URL: '' })).toBeUndefined();
    });
  });
});
