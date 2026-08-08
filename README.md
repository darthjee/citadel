# citadel

A template for web applications (NestJS backend + React frontend)

[![Build Status](https://circleci.com/gh/darthjee/citadel.svg?style=shield)](https://circleci.com/gh/darthjee/citadel)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/ace1d589a25b47c58ea5e17ebe145941)](https://app.codacy.com/gh/darthjee/citadel/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)
[![Codacy Badge](https://app.codacy.com/project/badge/Coverage/ace1d589a25b47c58ea5e17ebe145941)](https://app.codacy.com/gh/darthjee/citadel/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_coverage)

**Current Version:** [0.0.1](https://github.com/darthjee/citadel/releases/tag/0.0.1)

**Next Release:** [0.0.2](https://github.com/darthjee/citadel/compare/0.0.1...main)

## About

Citadel is a template repository for web applications with a frontend and a backend. It ships a
ready-made account layer (username/password login, JWT cookie + rotating refresh token, and a
device-authorization flow) and a transactional-email module, so each new project only adds its
own domain. See [docs/agents/flow.md](docs/agents/flow.md) for the flow.

The application is structured as a NestJS backend and a React single-page application
frontend, served together through the [Tent](https://github.com/darthjee/tent) reverse proxy.

**Status:** what exists today: a NestJS/TypeORM backend with a real Auth module
(username/password login, JWT cookie + rotating refresh token, and a device-authorization flow),
and a React frontend with a login/register/device-authorization modal, hash-based routing, and a
full HTTP client layer. See `docs/agents/product.md` for what's decided at template level vs. left
to each project.

## Technology Stack

### Backend

- **Node.js / NestJS** — Application framework
- **TypeORM** — ORM + migrations
- **MySQL 8** — Relational database
- **Yarn** — Package manager
- **Jest + `@swc/jest` + `supertest` + `@nestjs/testing`** — Test suite
- **ESLint** — Linting

### Frontend

- **React 19** — UI framework
- **Vite** — Build tool and dev server
- **Jasmine + c8** — Tests and coverage
- **ESLint** — Linting
- **Yarn** — Package manager

### Infrastructure

- **Docker & Docker Compose** — Containerisation and orchestration
- **[darthjee/tent](https://github.com/darthjee/tent)** — Reverse proxy (port 3000)
- **[darthjee/navi](https://github.com/darthjee/navi)** — Cache warmer

## Project Structure

```
citadel/
├── backend/              # NestJS/TypeORM backend — Auth and Mail modules
├── frontend/             # React + Vite frontend — login modal + auth flow
├── proxy/                # PHP proxy (darthjee/tent) configuration and extensions
├── dockerfiles/          # Dockerfiles for each service
├── docker_volumes/       # Bind-mounted volumes (static assets, proxy cache)
├── navi/                 # Navi cache-warmer configuration
├── docs/                 # Project documentation
└── docker-compose.yml    # Full stack service definitions
```

## Starting a New Project from This Template

After creating a repository from this template, replace the placeholder name with your project's
name (on a clean working tree):

```bash
scripts/init_project.sh "My Project"
```

This rewrites every placeholder form in file contents and tracked paths — `My Project`,
`MyProject`, `MY_PROJECT`, `my_project` and `my-project` — and, in this README only, also replaces
the template's own lowercase name with the snake_case one (`my_project`). Changes are left
uncommitted for review. It refuses to run on a dirty working tree or on an already-initialized
project.

## Development Setup

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed

### First Time Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/darthjee/citadel.git
   cd citadel
   ```

2. Create the `.env` file and run database migrations:
   ```bash
   make setup
   ```

3. Review and adjust `.env` values if needed.

### Running the Application

```bash
# Start the full stack (proxy + backend + frontend dev server)
make dev-up
```

The application will be available at:

- **Full stack (proxy):** <http://localhost:3000>
- **Backend API:** <http://localhost:3030>
- **Frontend dev server:** <http://localhost:3010>

### Development Shells

```bash
# Open a backend shell
make dev

# Open a test shell
make tests
```

### Running Tests

Inside the backend shell (`make dev`) or test shell (`make tests`):
```bash
yarn test        # run Jasmine specs
yarn coverage    # generate coverage with c8
yarn lint        # lint source and specs
```

Frontend tests (from `frontend/`, or via `docker-compose run citadel_fe`):
```bash
yarn test        # run Jasmine specs
yarn coverage    # generate coverage with c8
yarn lint        # lint source and specs
```

## Documentation

Agent-facing documentation lives under [`docs/agents/`](docs/agents/) — start at
[`docs/agents/index.md`](docs/agents/index.md). Project instructions for AI agents live in
[`AGENTS.md`](AGENTS.md).
