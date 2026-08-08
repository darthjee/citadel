import { createHash } from 'node:crypto';
import { hashToken } from '../token-hash.js';

describe('hashToken', () => {
  it('returns the SHA-256 hex digest of the value', () => {
    expect(hashToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('is stable and matches a freshly computed digest', () => {
    const value = 'a-refresh-token';

    expect(hashToken(value)).toBe(
      createHash('sha256').update(value).digest('hex'),
    );
  });
});
