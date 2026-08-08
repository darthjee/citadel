import bcrypt from 'bcryptjs';
import { compareOrDummy, DUMMY_DIGEST } from '../dummy-digest.js';

describe('compareOrDummy', () => {
  it('resolves to true when digest is provided and password matches it', async () => {
    const digest = await bcrypt.hash('correct-password', 4);

    await expect(compareOrDummy('correct-password', digest)).resolves.toBe(true);
  });

  it('resolves to false when digest is provided and password does not match it', async () => {
    const digest = await bcrypt.hash('correct-password', 4);

    await expect(compareOrDummy('wrong-password', digest)).resolves.toBe(false);
  });

  it('falls back to comparing against DUMMY_DIGEST when digest is undefined', async () => {
    await expect(compareOrDummy('anything', undefined)).resolves.toBe(
      await bcrypt.compare('anything', DUMMY_DIGEST),
    );
  });
});
