import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OrganizationNameDto } from '../dto/organization-name.dto.js';

async function errorsFor(body: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(OrganizationNameDto, body);
  const errors = await validate(dto);
  return errors.flatMap((error) => Object.keys(error.constraints ?? {}));
}

describe('OrganizationNameDto', () => {
  it('trims the name', () => {
    expect(plainToInstance(OrganizationNameDto, { name: '  Family \n' }).name).toBe('Family');
  });

  it('accepts a regular name', async () => {
    await expect(errorsFor({ name: 'Família 🏠' })).resolves.toEqual([]);
  });

  it.each([
    ['empty', ''],
    ['whitespace-only', '   \t '],
  ])('rejects an %s name', async (_label, name) => {
    await expect(errorsFor({ name })).resolves.toContain('isNotEmpty');
  });

  it('rejects a missing name', async () => {
    await expect(errorsFor({})).resolves.toContain('isString');
  });

  it.each([42, null, ['Family'], { name: 'x' }])('rejects a non-string name (%p)', async (name) => {
    await expect(errorsFor({ name })).resolves.toContain('isString');
  });

  describe('length, counted in code points', () => {
    it('accepts exactly 255 characters', async () => {
      await expect(errorsFor({ name: 'a'.repeat(255) })).resolves.toEqual([]);
    });

    it('rejects 256 characters', async () => {
      await expect(errorsFor({ name: 'a'.repeat(256) })).resolves.toContain('maxCodePoints');
    });

    it('accepts 255 astral characters (510 UTF-16 units)', async () => {
      await expect(errorsFor({ name: '😀'.repeat(255) })).resolves.toEqual([]);
    });

    it('rejects 256 astral characters', async () => {
      await expect(errorsFor({ name: '😀'.repeat(256) })).resolves.toContain('maxCodePoints');
    });

    it('counts variation selectors', async () => {
      await expect(errorsFor({ name: '❤️'.repeat(128) })).resolves.toContain('maxCodePoints');
    });

    it('measures the trimmed name', async () => {
      await expect(errorsFor({ name: ` ${'a'.repeat(255)} ` })).resolves.toEqual([]);
    });
  });

  it.each(['Fam\u0000ily', 'Fam\tily', 'Fam\nily', 'Fam\u007Fily', 'Fam\u0085ily'])(
    'rejects control characters (%j)',
    async (name) => {
      await expect(errorsFor({ name })).resolves.toContain('matches');
    },
  );
});
