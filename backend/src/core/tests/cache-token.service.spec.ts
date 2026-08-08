import { createHmac } from 'node:crypto';
import { CacheTokenService } from '../cache-token.service.js';

describe('CacheTokenService', () => {
  const configService = { get: jest.fn().mockReturnValue('test-secret') };
  const service = new CacheTokenService(configService as never);

  it('derives a hex-encoded HMAC-SHA256 digest of the user id', () => {
    const expected = createHmac('sha256', 'test-secret').update('42').digest('hex');

    expect(service.generate(42)).toBe(expected);
  });

  it('derives a stable digest for the same user id', () => {
    expect(service.generate('42')).toBe(service.generate(42));
  });

  it('derives different digests for different user ids', () => {
    expect(service.generate(1)).not.toBe(service.generate(2));
  });

  describe('when previous secret keys are configured', () => {
    const env: Record<string, string> = {
      CITADEL_PLACEHOLDER_SECRET_KEY: 'current-secret',
      CITADEL_PLACEHOLDER_PREVIOUS_SECRET_KEYS: 'old-secret-1,old-secret-2',
    };
    const rotatingService = new CacheTokenService({ get: jest.fn((key: string) => env[key]) } as never);

    it('derives the digest from the current key only', () => {
      const expected = createHmac('sha256', 'current-secret').update('42').digest('hex');

      expect(rotatingService.generate(42)).toBe(expected);
    });

    it('never derives the digest from a previous key', () => {
      const previous = createHmac('sha256', 'old-secret-1').update('42').digest('hex');

      expect(rotatingService.generate(42)).not.toBe(previous);
    });
  });

  describe('when CITADEL_PLACEHOLDER_SECRET_KEY is unset', () => {
    it('falls back to an empty secret', () => {
      const unsetService = new CacheTokenService({ get: jest.fn() } as never);
      const expected = createHmac('sha256', '').update('42').digest('hex');

      expect(unsetService.generate(42)).toBe(expected);
    });
  });
});
