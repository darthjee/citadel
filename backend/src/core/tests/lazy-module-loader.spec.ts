import { Injectable, Module, INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { LazyModuleLoaderService } from '../lazy-module-loader.service.js';

describe('LazyModuleLoaderService', () => {
  let app: INestApplicationContext;
  let service: LazyModuleLoaderService;
  let instantiated: boolean;

  // Trivial throwaway service/module used only to prove `LazyModuleLoader`
  // wiring works end to end — not a real feature module. `instantiated` is
  // flipped by the constructor itself, so a test can assert the module was
  // never built until `loadOnFirstRequest` is actually called.
  @Injectable()
  class ThrowawayService {
    constructor() {
      instantiated = true;
    }

    ping(): string {
      return 'pong';
    }
  }

  @Module({ providers: [ThrowawayService] })
  class ThrowawayModule {}

  @Module({ providers: [LazyModuleLoaderService] })
  class HostModule {}

  beforeEach(async () => {
    instantiated = false;
    // `LazyModuleLoader` needs the real module-scanning internals a full
    // Nest application wires up — a bare `Test.createTestingModule` doesn't
    // provide them — so this boots a real (controller/HTTP-less)
    // application context instead, same as `NestFactory.create` minus the
    // HTTP adapter.
    app = await NestFactory.createApplicationContext(HostModule, { logger: false });
    service = app.get(LazyModuleLoaderService);
  });

  afterEach(async () => {
    await app.close();
  });

  it('does not instantiate the module before it is requested', () => {
    expect(instantiated).toBe(false);
  });

  it('instantiates a module on demand and resolves its providers', async () => {
    const loadedModuleRef = await service.loadOnFirstRequest(() => ThrowawayModule);

    expect(instantiated).toBe(true);

    const throwaway = loadedModuleRef.get(ThrowawayService);

    expect(throwaway.ping()).toBe('pong');
  });
});
