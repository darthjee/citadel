import 'reflect-metadata';
import type { Request } from 'express';
import {
  type CacheInvalidation,
  INVALIDATION_KEY,
  InvalidatesOwner,
  InvalidatesPaths,
  NoCacheInvalidation,
} from '../cache-invalidation.decorator.js';

const build = (): string[] => ['/things.json'];

class Handlers {
  @InvalidatesOwner()
  owner(): void {}

  @InvalidatesPaths(build)
  paths(): void {}

  @NoCacheInvalidation()
  none(): void {}
}

const read = (handler: () => void): CacheInvalidation => Reflect.getMetadata(INVALIDATION_KEY, handler);

describe('cache invalidation decorators', () => {
  it('declares the owner prefix', () => {
    expect(read(Handlers.prototype.owner)).toEqual({ kind: 'owner' });
  });

  it('declares explicit paths through the given builder', () => {
    const declared = read(Handlers.prototype.paths);

    expect(declared.kind).toBe('paths');
    expect(declared.kind === 'paths' && declared.build({} as Request)).toEqual(['/things.json']);
  });

  it('declares no invalidation', () => {
    expect(read(Handlers.prototype.none)).toEqual({ kind: 'none' });
  });
});
