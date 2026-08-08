import { readFileSync } from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { FRONTEND_ROOT, readSource } from './jsx-loader.mjs';

describe('jsx-loader', () => {
  describe('readSource', () => {
    it('reads a file inside the frontend root', () => {
      const filePath = path.join(FRONTEND_ROOT, 'package.json');

      const result = readSource(pathToFileURL(filePath).href);

      expect(result).toEqual({
        filePath,
        source: readFileSync(filePath, 'utf-8'),
      });
    });

    it('throws for a traversal that leaves the frontend root', () => {
      const filePath = path.join(FRONTEND_ROOT, '..', 'outside.js');

      expect(() => readSource(pathToFileURL(filePath).href))
        .toThrowError(/Refusing to read outside the frontend root/);
    });

    it('throws for a sibling path sharing the root prefix', () => {
      const filePath = `${FRONTEND_ROOT}-other/file.js`;

      expect(() => readSource(pathToFileURL(filePath).href))
        .toThrowError(/Refusing to read outside the frontend root/);
    });

    it('throws for an absolute path elsewhere', () => {
      expect(() => readSource(pathToFileURL('/etc/hosts').href))
        .toThrowError(/Refusing to read outside the frontend root/);
    });
  });
});
