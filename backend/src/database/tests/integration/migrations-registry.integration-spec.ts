import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { MIGRATIONS } from './test-data-source.js';

describe('integration migration registry', () => {
  const migrationsDir = join(__dirname, '..', '..', 'migrations');
  const files = readdirSync(migrationsDir)
    .filter((file) => /^\d+-.*\.ts$/.test(file))
    .map((file) => file.replace(/\.ts$/, ''))
    .sort();

  it('registers every timestamp-prefixed migration file, in order', () => {
    expect(MIGRATIONS.map(({ file }) => file)).toEqual(files);
  });

  it('pairs each file with the class whose timestamp suffix matches it', () => {
    for (const { file, migration } of MIGRATIONS) {
      const timestamp = file.split('-')[0];
      expect(migration.name.endsWith(timestamp)).toBe(true);
    }
  });
});
