import { plainToInstance, Transform } from 'class-transformer';
import { validate } from 'class-validator';
import { codePointLength, MaxCodePoints, NO_CONTROL_CHARACTERS, trimString } from '../string-validators.js';

class Sample {
  @Transform(trimString)
  @MaxCodePoints(3)
    value!: unknown;
}

class SampleWithMessage {
  @MaxCodePoints(1, { message: 'too long' })
    value!: unknown;
}

async function constraintsFor(value: unknown): Promise<Record<string, string>> {
  const errors = await validate(plainToInstance(Sample, { value }));
  return errors[0]?.constraints ?? {};
}

describe('string validators', () => {
  describe('NO_CONTROL_CHARACTERS', () => {
    it.each(['', 'plain', 'caf\u00e9 \u{1F600}'])('accepts %p', (value) => {
      expect(NO_CONTROL_CHARACTERS.test(value)).toBe(true);
    });

    it.each(['a\u0000b', 'tab\there', 'line\nbreak', 'del\u007f', 'c1\u0085'])('rejects %p', (value) => {
      expect(NO_CONTROL_CHARACTERS.test(value)).toBe(false);
    });
  });

  describe('trimString', () => {
    it('trims a string', () => {
      expect(plainToInstance(Sample, { value: '  ab \n' }).value).toBe('ab');
    });

    it.each([42, null, undefined, ['a'], { a: 1 }])('returns a non-string value unchanged (%p)', (value) => {
      expect(trimString({ value } as never)).toBe(value);
    });
  });

  describe('codePointLength', () => {
    it('counts an astral character once', () => {
      expect(codePointLength('😀😀')).toBe(2);
    });

    it('counts a variation selector as its own code point', () => {
      expect(codePointLength('❤️')).toBe(2);
    });
  });

  describe('MaxCodePoints', () => {
    it('accepts a string at the limit, counted in code points', async () => {
      await expect(constraintsFor('😀😀😀')).resolves.toEqual({});
    });

    it('rejects a string over the limit with the default message', async () => {
      await expect(constraintsFor('abcd')).resolves.toEqual({ maxCodePoints: 'value must be at most 3 characters' });
    });

    it('measures the trimmed value', async () => {
      await expect(constraintsFor(' abc ')).resolves.toEqual({});
    });

    it('lets a non-string value through', async () => {
      await expect(constraintsFor(12345)).resolves.toEqual({});
    });

    it('honours a custom message', async () => {
      const errors = await validate(plainToInstance(SampleWithMessage, { value: 'ab' }));

      expect(errors[0].constraints).toEqual({ maxCodePoints: 'too long' });
    });
  });
});
