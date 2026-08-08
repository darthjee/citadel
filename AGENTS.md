# Project Instructions

_Last updated: 2026-09-29_

Citadel Placeholder is a template for web applications: a NestJS backend and a React/Vite frontend, served
together through the Tent reverse proxy. It ships a ready-made lightweight account layer
(username/password, a JWT `access_token` cookie, and a rotating refresh token; users log in
directly or by approving the login from an already-logged-in device via the
device-authorization flow), plus a transactional-email module. Each project built from this template adds its own domain
on top. See [Flow](docs/agents/flow.md) for the request/data flow and
[Product Definitions](docs/agents/product.md) for what's decided vs. left to each project.

## Stack

### Backend

- Node.js, ECMAScript (ES) Modules, TypeScript (strict), NestJS
- TypeORM (Object-Relational Mapping — ORM — library, with CLI migrations)
- MySQL 8
- Yarn (package manager)
- Jest + `@swc/jest` + `supertest` + `@nestjs/testing` (tests and coverage)
- ESLint (linting, flat config, `typescript-eslint`)

Only the Auth and Mail modules exist so far — the domain data model is left to each project
built from this template (see [Product Definitions](docs/agents/product.md)). See
[Backend Architecture](docs/agents/architecture/backend.md) for the module classification
(Core/Always-on/Lazy) and inter-module communication guidelines. A new module must follow them
unless its issue or plan explicitly documents why it deviates.

### Frontend

- React 19
- Vite (build tool)
- Jasmine + c8 (tests and coverage)
- ESLint (linting)
- Yarn (package manager)

Real auth UI exists (a route-independent login/register/device-authorization modal, hash-based
routing, and a `client/` HTTP layer — see
[Frontend Architecture](docs/agents/architecture/frontend.md)); application-specific views are
added per project.

### Infrastructure

- Docker + Docker Compose
- Reverse proxy via `darthjee/tent`
- Cache warmer via `darthjee/navi-hey`

## Development

```bash
# Start the full stack (proxy + backend + frontend)
make dev-up

# Open a backend shell
make dev

# Open a test shell
make tests

# Run TypeORM migrations
make setup
```

Backend runs on port `3030`, frontend dev server on `3010`, full stack proxy on `3000`.

**Always run project commands through `docker-compose`.** Never install packages or invoke
tooling (`yarn`, `npm`, `php`, etc.) directly on the host machine. The only exception is when the
user explicitly allows running a specific command on the host — either in their message in the
current conversation, or through a standing user instruction (for example a user memory entry or
a `CLAUDE.md` override). The host may not even have the required runtime installed, and
dependencies must stay reproducible inside the project's containers. Examples:

```bash
docker-compose run --rm citadel_placeholder_fe yarn lint
docker-compose run --rm citadel_placeholder_tests yarn test
```

## Conventions

- All documentation and code comments must be written in **English**, with no exceptions — even
  when the user writes in another language.
- Backend code lives in `backend/`, frontend in `frontend/`.
- Backend source lives under `backend/src/`, one folder per module (e.g. `backend/src/auth/`),
  following the standard module structure (`<name>.module.ts`, `.controller.ts`, `.service.ts`,
  `dto/`, `entities/`, `events/`, `tests/`) — see
  [Backend Architecture](docs/agents/architecture/backend.md).
  TypeORM migrations live under `backend/src/database/migrations/`.
- Frontend JS/JSX lives under `frontend/assets/js/`, specs under `frontend/specs/`.
- Max 300 lines per file, max complexity 10 (both backend and frontend, ESLint-enforced).
- Keep backend controllers thin — business logic belongs in each module's service, not the
  controller, unless a change explicitly documents why an exception is warranted.
- The backend image family (`citadel_placeholder`, `circleci_citadel_placeholder-base`, `production_citadel_placeholder-base`) is
  **not published to Docker Hub** — built locally / in CI only. Only the frontend/proxy
  (`vite_citadel_placeholder*`) images are published.
- Citadel Placeholder has a lightweight per-user account/login — see [Flow](docs/agents/flow.md).

## Documentation

All project documentation lives under [`docs/agents/`](docs/agents/):

| File | Contents |
|------|----------|
| [Index](docs/agents/index.md) | Link-only table of contents for `docs/agents/` — fetch this first to navigate the doc set. |
| [Summary](docs/agents/summary.md) | 2-4 line abstract of each doc under `docs/agents/`, to decide whether to open the full file. |
| [Folder Structure](docs/agents/folder-structure.md) | Top-level directory layout and the role of each folder. |
| [Flow](docs/agents/flow.md) | Stub: the generic login flow; each derived project adds its own request/data flow. |
| [Architecture](docs/agents/architecture.md) | Hub page linking to per-area architecture pages (`proxy`, `frontend`, `infra`, `backend`) plus the cross-cutting modular-pattern page. |
| [Contributing](docs/agents/contributing.md) | Commit guidelines, PR standards, code organization, and refactoring rules. |
| [Product Definitions](docs/agents/product.md) | Stub — template-level decisions plus sections each derived project fills in. Consult before planning any issue that introduces new entities. |
| [External Tooling](docs/agents/external.md) | Hub linking full usage guides for external, project-agnostic tools (Tent, Navi, navi-hey-client). |
| [Cache Warmer](docs/agents/cache-warmer.md) | Navi setup for warming the proxy cache after release (CI and local); used by the `cache` agent. |
| [Plans](docs/agents/plans/) | Implementation plans for ongoing or upcoming features. |
| [Issues](docs/agents/issues/) | Detailed specs for open issues. |
| [Issue Enhancement](docs/agents/issue-enhancement.md) | Checklist of concerns used by `/enhance-issue` to flesh out vague issue ideas. |

### Issues (`docs/agents/issues/`)

Each file documents an issue in detail. Naming convention:

```
docs/agents/issues/<issue_id>_<issue_name>.md
```

### Plans (`docs/agents/plans/`)

Each plan is a directory named after the issue ID and topic, containing one or more related
files:

```
docs/agents/plans/<issue_id>_<topic>/<related_files>.md
```

## Specialist agents

See `.claude/agents/` for the full roster (`architect`, `backend`, `infra`, `frontend`, `proxy`,
`cache`, `security`, `data-access`, `product-owner`).
