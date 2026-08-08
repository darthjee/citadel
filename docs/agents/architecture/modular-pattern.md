# Architecture — Modular Pattern

Cross-cutting rules every backend module — the Auth module today, and any future module (once the data model in `docs/agents/product.md` is decided) — must
follow. See `docs/agents/architecture/backend.md` for the stack/layout this pattern lives inside, and
`docs/agents/modules/auth.md` for a concrete example.

## Module classification

| Type | Loading | Examples |
|---|---|---|
| Core | Always resident, at boot | `src/core/` — JWT Guard, DB connection, CacheToken Service, `LazyModuleLoader` wrapper |
| Always-on | Always resident, at boot | Auth module, Mail module — imported directly into `AppModule` |
| Lazy | On demand, first request | Future domain modules — none exist yet |

A **lazy** module is *not* imported into `AppModule` directly. Instead, its controller's first
route handler calls `LazyModuleLoaderService#loadOnFirstRequest()`
(`src/core/lazy-module-loader.service.ts`) with a loader function that dynamically `import()`s
the module class:

```ts
@Controller('widgets')
class WidgetController {
  constructor(private readonly lazyModuleLoader: LazyModuleLoaderService) {}

  @Get('widgets.json')
  async list() {
    const moduleRef = await this.lazyModuleLoader.loadOnFirstRequest(
      () => import('../widget/widget.module.js').then((m) => m.WidgetModule),
    );
    return moduleRef.get(WidgetService).list();
  }
}
```

Nest instantiates (and thereafter caches) that module's DI graph on first hit, not at
application boot — this is what actually reduces startup footprint for modules nobody has
touched yet, per the issue's memory/performance considerations.

## Standard module structure

Every feature module (`src/<name>/`) follows the same shape:

- `<name>.module.ts` — module definition (imports, providers, exports)
- `<name>.controller.ts` — thin routes, delegating to the service; every route path ends in
  `.json` (see `architecture/backend.md`'s "Routing convention")
- `<name>.service.ts` — business logic; constructor-injected repositories/services only
- `dto/` — request/response DTOs, annotated with `class-validator` decorators
- `entities/` — TypeORM entities, table names prefixed with the module name (e.g. `auth_users`)
- `events/` — `@OnEvent` handlers and event payload classes
- `tests/` — Jest unit (`*.spec.ts`) and e2e (`*.e2e-spec.ts`) specs for the module

## Inter-module communication (hybrid pattern)

- **Direct DI (synchronous):** a module exports its service (`AuthModule` exports `AuthService`);
  a consuming module imports the module and injects the exported service. A module never writes
  to another module's tables — reads happen only through the exported service, never a direct
  repository/query against another module's entities.
- **Event-driven (reactive):** via `@nestjs/event-emitter`'s `EventEmitter2`, fire-and-forget.
  Event names follow `<entity>.<action>` (e.g. `user.registered`, fired by `AuthService` on
  successful registration). A module fires events without knowing or caring whether anything
  listens; `EventEmitterModule.forRoot()` is registered once, globally, in `AppModule`.

Use direct DI when the consumer needs an answer synchronously (e.g. "does this user exist");
use an event when the producer just needs to announce something happened and doesn't need (or
want to block on) any reaction.

## Database strategy

- Single MySQL database, shared across modules.
- Each module owns its tables under a distinct prefix (`auth_` for the Auth module, and so on
  for future modules).
- Cross-module references use **logical foreign keys** only: store the referenced ID (e.g.
  `RefreshToken.userId`), with no physical FK constraint and no cross-module SQL JOIN. Fetching
  the referenced row, if ever needed, goes through the owning module's exported service (direct
  DI), not a query against its table.
- Migrations live in `src/database/migrations/`, named `<timestamp>-<module>-<action>.ts`, run
  via `yarn migration:run`/`yarn migration:revert` (TypeORM CLI, `-d src/database/data-source.ts`).

## Dependency injection only

Classes never read env vars or import global state directly — see
`docs/agents/contributing.md`'s DI rule and `architecture/backend.md`'s one documented
exception (`src/database/data-source.ts`, consumed standalone by the TypeORM CLI).
