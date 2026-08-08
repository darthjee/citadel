import { Injectable } from '@nestjs/common';
import { LazyModuleLoader, ModuleRef } from '@nestjs/core';

/**
 * Thin wrapper around Nest's built-in `LazyModuleLoader`, documenting
 * Citadel Placeholder's module classification (see
 * `docs/agents/architecture/modular-pattern.md`):
 *
 * | Type      | Loading                  | Examples                                          |
 * |-----------|---------------------------|---------------------------------------------------|
 * | Core      | Always resident, at boot  | Router, JWT Guard, DB Connection, CacheToken Svc  |
 * | Always-on | Always resident, at boot  | Auth Module, Mail Module                          |
 * | Lazy      | On demand, first request  | (future domain modules)                           |
 *
 * A lazy module is *not* imported into `AppModule` directly. Instead, its
 * controller's first route handler calls `loadOnFirstRequest()` with a
 * loader function that dynamically `import()`s the module class — Nest
 * instantiates (and thereafter caches) that module's DI graph on first
 * hit, not at application boot.
 *
 * Example (future lazy module):
 * ```ts
 * @Controller('widgets')
 * class WidgetController {
 *   constructor(private readonly lazyModuleLoader: LazyModuleLoaderService) {}
 *
 *   @Get()
 *   async list() {
 *     const moduleRef = await this.lazyModuleLoader.loadOnFirstRequest(
 *       () => import('../widget/widget.module.js').then((m) => m.WidgetModule),
 *     );
 *     return moduleRef.get(WidgetService).list();
 *   }
 * }
 * ```
 */
@Injectable()
export class LazyModuleLoaderService {
  private readonly lazyModuleLoader: LazyModuleLoader;

  /**
   * @param {LazyModuleLoader} lazyModuleLoader - Nest's built-in lazy loader,
   * itself always available for injection without explicit registration.
   */
  constructor(lazyModuleLoader: LazyModuleLoader) {
    this.lazyModuleLoader = lazyModuleLoader;
  }

  /**
   * Loads (and caches, on subsequent calls) a module on demand.
   * @param {Parameters<LazyModuleLoader['load']>[0]} loaderFn - Returns (or
   * resolves to) the module class, dynamic module, or forward reference to
   * load.
   * @returns {Promise<ModuleRef>} The loaded module's DI container.
   */
  loadOnFirstRequest(
    loaderFn: Parameters<LazyModuleLoader['load']>[0],
  ): Promise<ModuleRef> {
    return this.lazyModuleLoader.load(loaderFn);
  }
}
