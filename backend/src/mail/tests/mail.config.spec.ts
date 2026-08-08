import { buildMailConfig } from '../mail.config.js';

function fakeConfigService(values: Record<string, string | undefined>) {
  return { get: jest.fn((key: string) => values[key]) } as never;
}

describe('buildMailConfig', () => {
  describe('when email is disabled', () => {
    it.each([
      ['unset', undefined],
      ['"false"', 'false'],
      ['"anything"', 'anything'],
    ])('returns a frozen disabled config when CITADEL_PLACEHOLDER_EMAILS_ENABLED is %s', (_label, value) => {
      const config = buildMailConfig(fakeConfigService({ CITADEL_PLACEHOLDER_EMAILS_ENABLED: value }));

      expect(config).toEqual({ enabled: false, from: '', transport: null, method: 'native' });
      expect(Object.isFrozen(config)).toBe(true);
    });

    it('defaults method to native when CITADEL_PLACEHOLDER_EMAIL_METHOD is unset', () => {
      const config = buildMailConfig(fakeConfigService({}));

      expect(config.method).toBe('native');
    });

    it('resolves an explicit known method', () => {
      const config = buildMailConfig(fakeConfigService({ CITADEL_PLACEHOLDER_EMAIL_METHOD: 'native' }));

      expect(config.method).toBe('native');
    });

    it('throws naming CITADEL_PLACEHOLDER_EMAIL_METHOD when it is set to an unknown value', () => {
      const config = fakeConfigService({ CITADEL_PLACEHOLDER_EMAIL_METHOD: 'carrier-pigeon' });

      expect(() => buildMailConfig(config)).toThrow('CITADEL_PLACEHOLDER_EMAIL_METHOD');
    });
  });

  describe('when email is enabled', () => {
    const base = {
      CITADEL_PLACEHOLDER_EMAILS_ENABLED: 'true',
      CITADEL_PLACEHOLDER_EMAIL_HOST: 'smtp.example.com',
      CITADEL_PLACEHOLDER_EMAIL_FROM: 'no-reply@citadel-placeholder.local',
    };

    it('resolves an enabled config echoing from and building a transport', () => {
      const config = buildMailConfig(fakeConfigService(base));

      expect(config.enabled).toBe(true);
      expect(config.from).toBe('no-reply@citadel-placeholder.local');
      expect(config.transport).not.toBeNull();
      expect(Object.isFrozen(config)).toBe(true);
    });

    it('defaults method to native when CITADEL_PLACEHOLDER_EMAIL_METHOD is unset', () => {
      const config = buildMailConfig(fakeConfigService(base));

      expect(config.method).toBe('native');
    });

    it('resolves an explicit known method', () => {
      const config = buildMailConfig(fakeConfigService({ ...base, CITADEL_PLACEHOLDER_EMAIL_METHOD: 'native' }));

      expect(config.method).toBe('native');
    });

    it('throws naming CITADEL_PLACEHOLDER_EMAIL_METHOD when it is set to an unknown value', () => {
      const config = fakeConfigService({ ...base, CITADEL_PLACEHOLDER_EMAIL_METHOD: 'carrier-pigeon' });

      expect(() => buildMailConfig(config)).toThrow('CITADEL_PLACEHOLDER_EMAIL_METHOD');
    });

    it('throws naming CITADEL_PLACEHOLDER_EMAIL_HOST when the host is missing', () => {
      const config = fakeConfigService({ ...base, CITADEL_PLACEHOLDER_EMAIL_HOST: undefined });

      expect(() => buildMailConfig(config)).toThrow('CITADEL_PLACEHOLDER_EMAIL_HOST');
    });

    it('throws naming CITADEL_PLACEHOLDER_EMAIL_FROM when the from address is missing', () => {
      const config = fakeConfigService({ ...base, CITADEL_PLACEHOLDER_EMAIL_FROM: undefined });

      expect(() => buildMailConfig(config)).toThrow('CITADEL_PLACEHOLDER_EMAIL_FROM');
    });

    it('throws naming CITADEL_PLACEHOLDER_EMAIL_PORT when the port is set but not a positive number', () => {
      const config = fakeConfigService({ ...base, CITADEL_PLACEHOLDER_EMAIL_PORT: 'not-a-port' });

      expect(() => buildMailConfig(config)).toThrow('CITADEL_PLACEHOLDER_EMAIL_PORT');
    });

    it('throws naming CITADEL_PLACEHOLDER_EMAIL_TIMEOUT_MS when the timeout is set but not a positive number', () => {
      const config = fakeConfigService({ ...base, CITADEL_PLACEHOLDER_EMAIL_TIMEOUT_MS: '-5' });

      expect(() => buildMailConfig(config)).toThrow('CITADEL_PLACEHOLDER_EMAIL_TIMEOUT_MS');
    });

    it('lists every offending var in a single thrown message', () => {
      const config = fakeConfigService({
        CITADEL_PLACEHOLDER_EMAILS_ENABLED: 'true',
        CITADEL_PLACEHOLDER_EMAIL_PORT: 'nope',
      });

      expect(() => buildMailConfig(config)).toThrow(
        'mail: CITADEL_PLACEHOLDER_EMAILS_ENABLED is true but the following are missing/invalid: '
          + 'CITADEL_PLACEHOLDER_EMAIL_HOST, CITADEL_PLACEHOLDER_EMAIL_FROM, CITADEL_PLACEHOLDER_EMAIL_PORT',
      );
    });

    it('defaults the port to 587 when unset', () => {
      const config = buildMailConfig(fakeConfigService(base));

      expect(config.transport?.port).toBe(587);
    });

    it('marks the transport secure with no STARTTLS upgrade on port 465', () => {
      const config = buildMailConfig(fakeConfigService({ ...base, CITADEL_PLACEHOLDER_EMAIL_PORT: '465' }));

      expect(config.transport?.secure).toBe(true);
      expect(config.transport?.requireTLS).toBeFalsy();
    });

    it('requires a STARTTLS upgrade on port 587 when USE_TLS is unset', () => {
      const config = buildMailConfig(fakeConfigService({ ...base, CITADEL_PLACEHOLDER_EMAIL_PORT: '587' }));

      expect(config.transport?.secure).toBe(false);
      expect(config.transport?.requireTLS).toBe(true);
    });

    it('does not require STARTTLS when USE_TLS is "false"', () => {
      const config = buildMailConfig(fakeConfigService({ ...base, CITADEL_PLACEHOLDER_EMAIL_USE_TLS: 'false' }));

      expect(config.transport?.requireTLS).toBe(false);
    });

    it('forces STARTTLS when credentials are set even if USE_TLS is "false" on a non-465 port', () => {
      const config = buildMailConfig(fakeConfigService({
        ...base,
        CITADEL_PLACEHOLDER_EMAIL_PORT: '587',
        CITADEL_PLACEHOLDER_EMAIL_USE_TLS: 'false',
        CITADEL_PLACEHOLDER_EMAIL_USER: 'mailer',
        CITADEL_PLACEHOLDER_EMAIL_PASSWORD: 'test-placeholder',
      }));

      expect(config.transport?.requireTLS).toBe(true);
    });

    it('includes auth only when both user and password are set', () => {
      const config = buildMailConfig(fakeConfigService({
        ...base,
        CITADEL_PLACEHOLDER_EMAIL_USER: 'mailer',
        CITADEL_PLACEHOLDER_EMAIL_PASSWORD: 'test-placeholder',
      }));

      expect(config.transport?.auth).toEqual({ user: 'mailer', pass: 'test-placeholder' });
    });

    it('omits auth when only the user is set', () => {
      const config = buildMailConfig(fakeConfigService({ ...base, CITADEL_PLACEHOLDER_EMAIL_USER: 'mailer' }));

      expect(config.transport?.auth).toBeUndefined();
    });

    it('defaults the three timeout fields to 10000 when TIMEOUT_MS is unset', () => {
      const config = buildMailConfig(fakeConfigService(base));

      expect(config.transport?.connectionTimeout).toBe(10000);
      expect(config.transport?.greetingTimeout).toBe(10000);
      expect(config.transport?.socketTimeout).toBe(10000);
    });

    it('echoes TIMEOUT_MS into the three timeout fields when set', () => {
      const config = buildMailConfig(fakeConfigService({ ...base, CITADEL_PLACEHOLDER_EMAIL_TIMEOUT_MS: '2500' }));

      expect(config.transport?.connectionTimeout).toBe(2500);
      expect(config.transport?.greetingTimeout).toBe(2500);
      expect(config.transport?.socketTimeout).toBe(2500);
    });

    it('trims surrounding whitespace on host, from and user', () => {
      const config = buildMailConfig(fakeConfigService({
        CITADEL_PLACEHOLDER_EMAILS_ENABLED: 'true',
        CITADEL_PLACEHOLDER_EMAIL_HOST: '  smtp.example.com  ',
        CITADEL_PLACEHOLDER_EMAIL_FROM: '  no-reply@citadel-placeholder.local  ',
        CITADEL_PLACEHOLDER_EMAIL_USER: '  mailer  ',
        CITADEL_PLACEHOLDER_EMAIL_PASSWORD: 'test-placeholder',
      }));

      expect(config.transport?.host).toBe('smtp.example.com');
      expect(config.from).toBe('no-reply@citadel-placeholder.local');
      expect(config.transport?.auth).toEqual({ user: 'mailer', pass: 'test-placeholder' });
    });
  });
});
