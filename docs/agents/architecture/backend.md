# Architecture — Backend

NestJS + TypeORM + MySQL. See [Modular Pattern](./modular-pattern.md) for the cross-cutting rules (module classification,
lazy loading, inter-module communication, database strategy) any module — this one or a future
one — must follow. See `docs/agents/modules/auth.md` for the Auth module itself.

## Stack

- NestJS (Express platform adapter) + TypeScript, strict mode, ES Modules
  (`"module": "NodeNext"`, `.js` extensions required on every relative import path, per
  Node's ESM resolution rules)
- TypeORM (entity/repository ORM + CLI migrations) + MySQL 8, connection pool capped at
  `poolSize: 5` (per ward's precedent and the issue's performance considerations)
- Jest + `@swc/jest` (transform) + `supertest` (e2e HTTP assertions) + `@nestjs/testing`
- ESLint (flat config, `typescript-eslint` + the same `complexity`/`jsdoc`/`import`/
  `sort-class-members` plugins used project-wide)
- Yarn (package manager)

## Layout

```
backend/src/
├── main.ts                    # boots the app: cookie-parser, global ValidationPipe, PORT
├── app.module.ts              # root module: ConfigModule, TypeOrmModule, JwtModule (global),
│                               #   EventEmitterModule, AuthModule, core providers, global
│                               #   OriginGuard + JwtGuard + AdminGuard, HttpExceptionFilter
├── core/                      # Core layer — always resident, independent of any feature module
│   ├── origin.guard.ts        #   global CanActivate rejecting cross-site mutating requests (CSRF)
│   ├── jwt.guard.ts           #   global CanActivate verifying the access-token cookie
│   ├── public.decorator.ts    #   @Public() escape hatch from the JWT guard
│   ├── admin.guard.ts         #   global CanActivate enforcing @AdminOnly() routes
│   ├── admin-only.decorator.ts #  @AdminOnly() marker read by AdminGuard
│   ├── access-token-payload.ts #  shape signed by AuthService / verified by JwtGuard
│   ├── http-exception.filter.ts #  global APP_FILTER writing the standard error body
│   ├── error-codes.ts         #   category/specific error codes + status → code mapping
│   ├── locked.exception.ts    #   423 Locked HttpException
│   ├── cache-token.service.ts #   HMAC cache-token generation for Tent cache keying
│   ├── lazy-module-loader.service.ts  # thin wrapper around Nest's LazyModuleLoader
│   └── tests/
├── database/
│   ├── data-source.ts         # TypeORM DataSource config, read once from env vars (CLI + AppModule)
│   └── migrations/            # <timestamp>-<module>-<action>.ts
├── health/
│   ├── health.controller.ts   # GET /health.json (liveness) + GET /ready.json (readiness) — @Public()
│   ├── health.service.ts      # readiness checks (database only)
│   └── tests/
├── auth/                      # first feature module — see docs/agents/modules/auth.md
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── dto/
│   ├── entities/
│   ├── events/
│   └── tests/
└── mail/                      # Mail module — always-on, general-purpose transactional email sender, no HTTP surface
    ├── mail.module.ts
    ├── mail.config.ts
    ├── mail.service.ts
    ├── mail.method.ts
    ├── mail.tokens.ts
    ├── render-template.ts
    ├── template-registry.ts
    ├── templates/            # Filesystem email templates — subject.txt / body.txt / body.html per <name>/
    └── tests/
```

## Owned tables

Each module owns its tables under a distinct prefix (see [Modular Pattern](./modular-pattern.md)
for the rule) — only Auth owns tables today (Mail has no HTTP surface and no entities, see
`docs/agents/modules/mail.md`). Column-level detail lives in `docs/agents/modules/auth.md`'s
"Entities" section, not repeated here.

| Table | Module | Notes |
|---|---|---|
| `auth_users` | Auth | |
| `auth_refresh_tokens` | Auth | |
| `auth_sessions` | Auth | |
| `auth_authorization_requests` | Auth | `user_id` is a logical FK (no physical FK, no cross-module JOIN) — `NULL` when the request's username didn't resolve to a real user |
| `auth_account_edit_lockouts` | Auth | `user_id` is a logical FK (no physical FK, no cross-module JOIN), unique — one row per user, upserted in place |

## Build

`nest build` (via `nest-cli.json`) compiles against `tsconfig.build.json`, not `tsconfig.json`
directly — `tsconfig.build.json` extends the base config but excludes `**/*.spec.ts`,
`**/*.e2e-spec.ts`, and `src/**/tests/**`, so test files never end up compiled into `dist/`.
`tsconfig.json` intentionally does **not** set `incremental: true`: combined with `nest-cli.json`'s
`deleteOutDir: true`, an incremental build's `.tsbuildinfo` cache can believe stale output is
still current after `dist/` is wiped externally (e.g. a container restart) and skip re-emitting
entirely, breaking `nest start --watch`.

`nest-cli.json`'s `compilerOptions.assets` copies the non-TS files under `mail/templates/**`
into `dist/`, and the mail template registry resolves that directory via `import.meta.url` so it
works from `dist/mail/` as well as `src/mail/`.

## Routing convention

Every route the backend exposes must end in `.json` — Tent's `backend.php` rule
(`proxy/dev_configuration/rules/backend.php`) only forwards requests whose URI `ends_with`
`.json` to the backend; anything else falls through to the frontend/static catch-all. This
applies to **every** route, including ones that don't look like a resource fetch at a glance
(e.g. `POST /auth/login.json`, not `POST /auth/login`) — verify a new route end-to-end through a
live `citadel_placeholder_proxy` container, not just by hitting `citadel_placeholder_app` directly, before considering it
done.

## Data source

`src/database/data-source.ts` reads `CITADEL_PLACEHOLDER_MYSQL_*` env vars directly (`process.env`) — the
one deliberate exception to the DI-only rule below, since it's also consumed standalone by the
TypeORM CLI (`yarn migration:run`/`migration:revert`), outside Nest's DI container entirely.
`AppModule` builds its own, DI-friendly `TypeOrmModule.forRootAsync` options through
`ConfigService` instead of importing this file, so the two stay independently testable/usable.

## Origin Guard (CSRF)

`core/origin.guard.ts` is the **first** global `APP_GUARD` in `AppModule`, registered ahead of
`JwtGuard`, so a forged cross-site request to an authenticated route gets `403` rather than
`401`. It checks only `POST`/`PUT`/`PATCH`/`DELETE`, deciding from the `Sec-Fetch-Site` and
`Origin` headers, and trusts exactly the origins resolved by `buildCorsOptions`
(`core/cors-config.ts`). Requests with neither header (non-browser clients, supertest e2e
specs) pass. See [`security.md`](./security.md#csrf) for the decision table and rationale.

## Health probes

`health/health.controller.ts` exposes two public, `never`-cached probes:

| Route | Purpose | Success | Failure |
|---|---|---|---|
| `GET /health.json` | liveness — the process is up; touches no dependency | `200 { "status": "ok" }` | — |
| `GET /ready.json` | readiness — dependencies are reachable | `200 { "status": "ok", "checks": { "database": "up" } }` | `503 { "status": "error", "checks": { "database": "down" } }` |

The readiness logic lives in `health/health.service.ts` (`HealthService#checkReadiness`), which
runs `SELECT 1` through the injected TypeORM `DataSource`. Only the database is checked — SMTP
is deliberately not. The body never carries error messages, hosts or stack
traces; a failed check is logged through `LoggerService` instead. The `503` is set on the
response (`@Res({ passthrough: true })`) rather than thrown, so `HttpExceptionFilter` does not
reshape it into the standard error body.

## JWT Guard

`core/jwt.guard.ts` is registered as a global `APP_GUARD` in `AppModule`, so every route requires
a valid access token by default. Routes that must stay reachable without one (`/health.json`,
`/ready.json`, and the Auth module's own `login.json`/`register.json`/`refresh.json`/`logoff.json`) opt out with
`@Public()`. `JwtModule` itself is registered with `{ global: true }` in `AppModule` — without
that, only modules that import `JwtModule` directly (not just `AuthModule`) can inject
`JwtService`, which broke `AuthService`'s constructor resolution the first time this was wired up.

## Admin Guard

`core/admin.guard.ts` is another global `APP_GUARD`, registered in `AppModule` right after
`JwtGuard` (`APP_GUARD`s run in registration order, and `AdminGuard` depends on `request.user`
already being populated by `JwtGuard`). It is a no-op unless the route (or controller) is
annotated `@AdminOnly()` (`core/admin-only.decorator.ts`), in which case it requires
`request.user.isAdmin === true`, throwing `403 Forbidden` otherwise — it never re-verifies the
JWT itself. See `docs/agents/modules/auth.md`'s "Admin authorization" section for the
`isAdmin` claim/provisioning details.

## Error responses

Every non-2xx JSON response has the same body, written by the global catch-all filter
`core/http-exception.filter.ts` (`HttpExceptionFilter`). It is registered in `AppModule` as an
`APP_FILTER` provider (not `app.useGlobalFilters` in `main.ts`) so it receives `LoggerService`
through DI and e2e test apps register it the same way (`build-auth-test-app.ts`). It covers
`ValidationPipe` failures, guard rejections, service exceptions and unexpected errors alike.

```json
{
  "error": {
    "code": "USERNAME_TAKEN",
    "message": "username is not available",
    "details": ["..."]
  },
  "statusCode": 409,
  "timestamp": "2026-09-28T12:00:00.000Z"
}
```

| Field | Notes |
|---|---|
| `error.code` | Always present. Category code by default; specific code when set at the throw site. |
| `error.message` | Always present, human-readable. For validation failures: the messages joined with `"; "`. |
| `error.details` | Only for `ValidationPipe` failures — the full list of validation messages. |
| `statusCode` | Same as the HTTP status. |
| `timestamp` | ISO-8601 (`new Date().toISOString()`). |

**Category codes** (`categoryCodeFor` in `core/error-codes.ts`), used when the throw site gives
no specific code:

| Status | Code |
|---|---|
| 400 (`ValidationPipe`, array `message`) | `VALIDATION_FAILED` |
| 400 (other) | `BAD_REQUEST` |
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` |
| 423 | `LOCKED` (`core/locked.exception.ts`'s `LockedException`) |
| 429 | `TOO_MANY_REQUESTS` |
| 500 / non-HTTP errors | `INTERNAL_ERROR` |
| any other status | `HTTP_<status>` |

**Specific codes** are attached at the throw site by passing an object response, with the
constant taken from `ErrorCodes` in `core/error-codes.ts` (never a repeated string literal):

```ts
throw new ConflictException({ code: ErrorCodes.USERNAME_TAKEN, message: 'username is not available' });
```

Current specific codes: `USERNAME_TAKEN` and `EMAIL_TAKEN` (`409`, from registration, account
edit and admin user edit). Pick the status by meaning — a uniqueness conflict is `409`, not `400`.

**Client errors from Express middleware.** Express body-parser failures other than malformed
JSON (which Nest itself turns into a `BadRequestException`) are http-errors-style plain errors
carrying a numeric `statusCode`/`status` — e.g. `413` for a body over the parser limit (100kb by
default), `415` for an unsupported charset/encoding, `400` for an aborted request. Any
non-`HttpException` error with a numeric 4xx `statusCode` (preferred) or `status` keeps that
status and its category code (`HTTP_413`, `HTTP_415`, `BAD_REQUEST`, ...), with the fixed
standard reason phrase from `node:http`'s `STATUS_CODES` as `error.message` (e.g.
`Payload Too Large`) — never the raw parser text. They are logged at `debug` only (`client
error`, status and error name, no stack) so anonymous clients cannot flood the error log.

**Unexpected errors.** Anything else that is not an `HttpException` answers `500` with
`{ code: 'INTERNAL_ERROR', message: 'Internal server error' }`; the real message and stack are
logged through `LoggerService#error('unhandled exception', ...)` and never sent to the client.

**Enumeration safety.** Errors that are deliberately uniform (e.g. `Invalid username or
password`, `Invalid or expired refresh token`, `Invalid or expired token`, the
authorization-request `Unable to authorize/deny this request` failures, and the `404` for an
unknown vs. wrong-token authorization request) must keep one status, one message and the
category code only. Never attach a specific code that would let a caller tell the underlying
cases apart.

## Dependency injection only

Classes never read env vars or import global state directly (`src/database/data-source.ts`
above is the sole, deliberate exception) — the DB connection, JWT secret, etc. are constructed
once (via `ConfigService`) and injected. See `docs/agents/contributing.md`'s DI rule.

## Testing

No live database in CI yet (`backend_tests` has no `cimg/mysql` service container) — specs inject
mocked/fake TypeORM repositories rather than hitting MySQL:

- **Unit specs** (`*.spec.ts`): plain `jest.fn()`-based repository doubles, service instantiated
  directly (no `TestingModule` needed when there's no DI graph to exercise).
- **e2e specs** (`*.e2e-spec.ts`): a real `INestApplication` built via `Test.createTestingModule`,
  with each entity's repository token overridden
  (`.overrideProvider(getRepositoryToken(Entity)).useValue(fakeRepo)`) by a small in-memory fake
  (array-backed `findOne`/`findOneBy`/`find`/`count`/`create`/`save`/`update`, plus a
  `createQueryBuilder().update()` stub), driven end-to-end via `supertest`. The single shared
  fake lives in `auth/tests/support/in-memory-repo.ts` (`createInMemoryRepo`/`matchesCondition`,
  understanding the `isNull`/`moreThan`/`ilike` find operators and auto-filling `createdAt` on
  insert); the auth e2e specs get it wired up via `auth/tests/auth.controller.e2e-test-support.ts`'s
  `buildTestApp()`. This exercises real controller/service/DTO-validation/guard behavior without a
  real database.
- **`LazyModuleLoader`-dependent specs**: need a real Nest application context
  (`NestFactory.createApplicationContext`), not a bare `Test.createTestingModule` — the loader's
  internals (module scanning) aren't fully wired by the lightweight testing container.

Add a `cimg/mysql` service to `.circleci/config.yml` (see `docs/agents/architecture/infra.md`)
when the first spec actually needs a real database (e.g. testing a TypeORM migration itself, or
a query too complex to fake convincingly).
