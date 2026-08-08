# Folder Structure

## Project Root

| Path | Purpose |
|---|---|
| `backend/` | Node.js/NestJS app, TypeScript + TypeORM/MySQL (the Auth and Mail modules exist — the domain data model is left to each project, see `docs/agents/product.md`) |
| `frontend/` | React 19 + Vite app — the login modal, device-authorization flow, hash routing, and `client/` HTTP layer already exist; application views are added per project |
| `proxy/` | PHP Tent proxy config (`dev_configuration/`, `prod_configuration/`, `extension/`) |
| `dockerfiles/` | `base/` (one shared Dockerfile for all four `*-base` images) plus one directory per leaf image |
| `docker_volumes/` | Bind-mount targets for local dev (gitignored contents) |
| `docs/agents/` | Agent-facing documentation, hub + per-topic pages (this directory) |
| `bin/` | Language-agnostic CI shell scripts (`image.sh`, `deploy_frontend.sh`) |
| `scripts/` | Release shell scripts (`bump_version.sh`, `deploy.sh`, `render.sh`, `wake_navi.sh`, `warm_navi_cache.sh`), plus `init_project.sh`, which replaces the template's placeholder name with a new project's name |
| `.circleci/` | CI pipeline config (validate with `docker-compose run --rm circleci config validate`) |
| `.claude/agents/` | Specialist AI agent definitions |
| `.github/` | Commit/PR templates + `copilot-instructions.md` |
| `navi/` | Navi cache-warmer config |
| `Makefile` | Dev command interface |
| `docker-compose.yml` | Full stack service definitions (includes a `circleci` service running the CircleCI CLI to validate `.circleci/config.yml`) |
| `version` | Base-image version registry |
| `.env.dev.sample`, `.env`, `.env.prod` | Environment variable files |
| `.codacy.yml`, `.gitguardian.yaml`, `.trivyignore` | Static analysis / secret-scanning / vulnerability-scan config |

## `backend/` — Backend

| Subdirectory / File | Description |
|---|---|
| `src/main.ts` | Nest app bootstrap (cookie-parser, global `ValidationPipe`, `PORT`) |
| `src/app.module.ts` | Root module — see `docs/agents/architecture/backend.md` |
| `src/core/` | Core layer: JWT Guard, `@Public()` decorator, CacheToken service, `LazyModuleLoader` wrapper, `tests/` |
| `src/database/` | TypeORM `DataSource` config + `migrations/` (`<timestamp>-<module>-<action>.ts`) |
| `src/health/` | `GET /health.json` controller |
| `src/auth/` | Auth module — see `docs/agents/modules/auth.md` |
| `src/mail/` | Mail module — always-on, no routes/entities; filesystem email templates live under `mail/templates/` — see `docs/agents/modules/mail.md` |
| `dist/` | Compiled build output (gitignored) |
| `nest-cli.json`, `tsconfig.json`, `tsconfig.build.json`, `jest.config.ts`, `package.json`, `eslint.config.mjs` | Tooling config |

## `frontend/` — Frontend

| Subdirectory / File | Description |
|---|---|
| `assets/js/` | React source code — `App.jsx`/`main.jsx` entry, `components/` (login modal, header, resource pages), `client/` (HTTP layer), `utils/routing/` (hash router), `utils/polling/` (device-authorization poller), `utils/validation/` (shared form validators) |
| `specs/` | Jasmine test files, mirrors `assets/js/`; `specs/support/jsx-loader.mjs` runs JSX under Node |
| `index.html` | Vite HTML entry point |
| `vite.config.js`, `eslint.config.mjs`, `package.json` | Tooling config |

## `proxy/` — Tent Proxy

| Subdirectory / File | Description |
|---|---|
| `dev_configuration/` | Dev routing rules: `configure.php`, `locals.php`, `rules/{frontend,backend,redirects}.php` |
| `prod_configuration/` | Prod routing rules — same shape, host-specific vars via `locals.php.sample` |
| `extension/lib/` | Custom PHP middleware (`CacheControlMiddleware`, `SetClientIpMiddleware`, `TestHeaderMiddleware`) + `cache/DomainHash.php` — trimmed to backend-agnostic classes only, no upload/admin-staff code |
| `extension/tests/` | PHPUnit tests, mirrors `extension/lib/` |

## `docker_volumes/` — Mounted Volumes

| Subdirectory | Description |
|---|---|
| `mysql_data/` | MySQL data persistence |
| `node_modules/` | Frontend deps cache |
| `static/` | Frontend build output, served by the proxy |
| `proxy_cache/` | Tent's HTTP response cache |

## `.claude/agents/` — Claude Code Configuration

| File | Description |
|---|---|
| `architect.md` | Cross-cutting coordinator |
| `backend.md` | NestJS/TypeORM/Jest/ESLint |
| `infra.md` | docker-compose, Dockerfiles, CI, deploy scripts, Makefile |
| `frontend.md` | React/Vite/Jasmine/ESLint |
| `proxy.md` | Tent PHP proxy config + extension |
| `cache.md` | Navi cache-warmer config |
| `security.md` | Read-only security reviewer |
| `data-access.md` | Read-only access-control reviewer |
| `product-owner.md` | Read-only product-definitions reference |

## `docs/agents/` — Documentation

| Subdirectory / File | Description |
|---|---|
| `architecture/` | Per-area architecture pages (`proxy.md`, `frontend.md`, `backend.md`, `modular-pattern.md`, `infra.md`) |
| `modules/` | Per-backend-module documentation (routes, entities, events) — `auth.md` today |
| `plans/` | Implementation plans, one directory per issue |
| `issues/` | Detailed specs for open issues, one file per issue |
| `index.md`, `summary.md`, `folder-structure.md`, `flow.md`, `architecture.md`, `contributing.md`, `cache-warmer.md`, `product.md`, `issue-enhancement.md` | Top-level reference docs |

## `dockerfiles/` — Service Images

The four `*-base` images (`citadel_placeholder-base`, `vite_citadel_placeholder-base`, `production_citadel_placeholder-base`,
`circleci_citadel_placeholder-base`) are all built from the single parameterised `dockerfiles/base/Dockerfile`:
one named target per image (`docker build --target <image>`), with the per-image build args
(base image, user, directories, rsync pin, ...) defined in the `build_args` function of
`bin/image.sh`. The leaf images (`citadel_placeholder`, `production_citadel_placeholder`, `vite_citadel_placeholder`) keep their own
directory under `dockerfiles/`, each `FROM` its published base image. See `ls dockerfiles/` for
the current list. The backend image family (`citadel_placeholder-base`,
`circleci_citadel_placeholder-base`, `production_citadel_placeholder-base`) is built but not published to Docker Hub —
see `docs/agents/architecture/infra.md` for the CircleCI `release-image` jobs that publish each
image family (and which ones actually push to Docker Hub).
