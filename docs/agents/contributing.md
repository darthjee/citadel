# Contributing

## Commit Guidelines

- **Atomic and Unitary:** Each commit must represent a single logical change.
  *Example:*
  - Good: `Add widget model to backend`
  - Bad: `Add widget model and refactor router`
- **No Unrelated Changes:** Do not mix unrelated changes in the same commit.
- **Separate Refactoring:** Whenever possible, separate refactoring commits from new feature or
  bugfix commits.

## Pull Requests

- **Descriptive Summary:** Every PR must include a clear and descriptive summary of its purpose
  and changes.
- **Environment Variables & Settings:** Every PR that introduces or changes an environment
  variable or backend/proxy setting must call it out explicitly in its own PR section, naming
  the variable and what deploying it requires. This is not satisfied by the variable merely
  appearing in a code diff.
- **PR Description Files:** If a description cannot be provided directly in the PR, generate a
  file with the PR description (e.g., `docs/agents/issues/<pr_number>_description.md`), but do
  not commit this file.
- **`AGENTS.md` Last updated date:** Every PR that changes `AGENTS.md` must also bump its
  `_Last updated: YYYY-MM-DD_` line to the date of the change. A stale date misleads agents about
  how current the instructions are.

## Definition of Done for PRs

A PR is considered complete when:

- The stated objective has been achieved.
- All tests are passing.
- Linting passes without errors.
- Code coverage is as high as reasonably possible.
- Any new or changed environment variable/setting is documented in the PR's "Environment
  Variables & Settings" section.
- Code is not overly complex:
  - Classes/modules and methods should have clear, focused responsibilities.
  - If a class or function is taking on too many responsibilities, refactor to simplify.
  - Functions and methods should be small and do exactly one thing.
  - This requirement applies primarily to source code. For specs/tests, refactor only if there
    is excessive duplication.

### CI Checks

Before a PR is considered complete, all CI checks relevant to the modified parts of the project
must pass locally. CI is defined in `.circleci/config.yml`; the table below maps each top-level
folder to its CircleCI job(s) and the equivalent local commands.

| Modified folder | CI job(s) | Local commands |
|------------------|-----------|-----------------|
| `backend/` | `backend_tests`, `backend_checks` | `docker-compose run citadel_placeholder_tests yarn coverage` and `docker-compose run citadel_placeholder_tests yarn lint` |
| `frontend/` | `jasmine`, `frontend-checks` | `docker-compose run citadel_placeholder_fe yarn coverage` and `docker-compose run citadel_placeholder_fe yarn lint` |
| `proxy/` | `proxy_extension_tests` | `docker-compose run proxy_tests` and `docker-compose run --rm proxy_lint` (PSR-12 check, local only — no CI job) |
| `.circleci/`, `scripts/`, `bin/`, `dockerfiles/`, `docker-compose.yml`, `proxy/prod_configuration/` | `upload_proxy_files`, `upload_fe_files`, `build-and-release`, `release`, `warm-up-cache` | The jobs themselves run only in CI / on tagged releases. For `.circleci/config.yml`, validate the config locally with `docker-compose run --rm circleci config validate` (use `... circleci config process .circleci/config.yml` to inspect the expanded jobs); for the rest, verify by reading the job definitions in `.circleci/config.yml`. |

If a new top-level folder is added in the future, its corresponding test and check jobs must be
added to `.circleci/config.yml` and to this table before merging changes to that folder.

This same process must be followed when **planning how to resolve an issue**: include a final
step in the plan that identifies the affected folders and lists the CI commands to run before
opening a PR.

## Code Organization

### Backend (`backend/`)

- **Controllers are thin:** business logic belongs in the module's service
  (`<name>.service.ts`), never the controller (`<name>.controller.ts`).
- **One module per concern:** new backend features are their own module under `src/<name>/`,
  following the standard module structure (`<name>.module.ts`, `.controller.ts`, `.service.ts`,
  `dto/`, `entities/`, `events/`, `tests/`) — see
  [Architecture — Modular Pattern](architecture/modular-pattern.md).
- **Method order:** within a class, public methods should be declared before private
  (`#`-prefixed) methods (enforced by `eslint-plugin-sort-class-members`).
- **File naming:** `kebab-case.ts` matching the exported class's purpose (e.g.
  `auth.service.ts`, `refresh-token.entity.ts`); specs are `<name>.spec.ts`/`<name>.e2e-spec.ts`
  under the module's `tests/` folder, never colocated next to the source file — see
  [Architecture — Backend](architecture/backend.md) for the full stack/layout.
- **Every route ends in `.json`:** Tent only forwards `.json`-suffixed requests to the backend
  (`proxy/dev_configuration/rules/backend.php`) — verify a new route through a live
  `citadel_placeholder_proxy` container, not just by hitting the backend directly, before considering it
  done.
- **Dependency injection only:** classes never read env vars or import global state themselves
  — the DB connection/pool, JWT secret, etc. are constructed once (via `ConfigService`) and
  injected. `src/database/data-source.ts` is the one documented exception (consumed standalone
  by the TypeORM CLI, outside Nest's DI container).

### Frontend (`frontend/`)

- **Components are PascalCase:** one component per file, file name matches the component (e.g.
  `App.jsx` for `function App()`).
- **Specs mirror source:** `frontend/specs/` mirrors the structure of `frontend/assets/js/`,
  with a matching spec file name (e.g. `AppSpec.js`).
- See `architecture/frontend.md` for the full component architecture and conventions once one
  exists beyond the placeholder shell.

## Dependency Injection

Classes and functions must receive their dependencies (data, configuration, collaborators) as
constructor/function arguments rather than reaching out on their own to read environment
variables or import global state.

This makes code independently testable: tests instantiate the class or call the function with
the data they need, without monkeypatching globals. This principle applies to backend
routes/handlers and frontend components/hooks alike.

## Refactoring Guidelines

When refactoring, aim to:

- **Reduce Code Duplication:** move repeated setup code in tests to a factory
  function/fixture rather than repeating the same construction inline across test files.
- **Extract Shared Logic:** when the same logic appears in multiple handlers or components,
  extract it into a shared helper or class rather than duplicating it.
- **Keep Tests Readable:** prefer clear, explicit test setup over clever abstractions that
  obscure what is being tested.
