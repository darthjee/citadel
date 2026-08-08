# Architecture — Infra

CircleCI (`.circleci/config.yml`) is Citadel Placeholder's only CI/CD pipeline: it runs tests/lint on every
push and, on semver tag pushes only, builds/publishes images and triggers the production
release. This page documents that pipeline's job graph — the "infra" counterpart to
`architecture/proxy.md`/`frontend.md`/`backend.md`. Citadel Placeholder deploys to Render and doesn't warm
the Navi cache from CI yet (see `docs/agents/cache-warmer.md`).

## Workflow

All test/lint jobs run on every push. The release chain (`build-and-release`, the `upload_*`
jobs, and `release`) is gated to **semver tag pushes only**, via the shared `tags_only` filter
(`tags: { only: /\d+\.\d+\.\d+/ }`, `branches: { ignore: /.*/ }`). The `release-image` jobs
(the 4 base-image publishes) have no branch filter at all — CircleCI schedules them on every
push, but `bin/image.sh`'s `skip_if_not_tag` guard makes them a fast no-op unless the push is a
tag, and `skip_if_unchanged` makes even tag builds a no-op when neither `dockerfiles/base/` nor
`bin/image.sh` has changed since the last release (see "Shared base Dockerfile" below).

**Template-only skip.** Every release-type job (`release-image`, `build-and-release`, the
`upload_*` jobs, `copy_proxy_configuration` and `release`) starts with the
`skip_release_if_disabled` command. When the CircleCI project sets `CITADEL_SKIP_RELEASE=true`,
that step runs `circleci-agent step halt` before `checkout`, so the job ends green without doing
anything and the jobs that depend on it still run. Only the template repo sets this flag.
Projects built from it leave it unset and release normally (see
`docs/agents/environment-variables.md` §4). One consequence for the template: its image releases
are skipped too, so `backend_tests`/`backend_checks` depend on the
`circleci_citadel_placeholder-base` tag pinned in `.circleci/config.yml` already being on Docker
Hub. To bump that image version in the template, unset the flag for that release.
`FORCE_IMAGE_BUILD` does not override it.

```
release-circleci_citadel_placeholder-base(-arm64) ─┬─ backend_tests ──┐
                                        └─ backend_checks ─┤
                                          jasmine ─────────┼─ build-and-release ─────────────────┐
                                    frontend-checks ───────┤                                      │
                              proxy_extension_tests ───────┤                                      │
                                                            │                                      │
        release-production_citadel_placeholder-base(-arm64) ───────────┘                                      │
                                                            ├─ upload_proxy_files ─┬─ upload_extension ──────┐
                                                            │                      └─ copy_proxy_configuration┤
                                                            └─ upload_fe_files ─────────────────────────────┼─ release
                              release-vite_citadel_placeholder-base(-arm64) ───────────────────────────────────────────┘

backend_tests ─┬─ coverage-final   (side branch off the same jobs, not part of the release chain)
jasmine ───────┘

release-citadel_placeholder-base(-arm64)  — published for local/dev use; nothing in this workflow requires it
```

The five boxes feeding `build-and-release`/`upload_proxy_files`/`upload_fe_files`
(`backend_tests`, `backend_checks`, `jasmine`, `frontend-checks`, `proxy_extension_tests`) are
each required directly by all three of those jobs — the diagram only draws the edges once to
stay readable. `coverage-final` requires only `backend_tests` and `jasmine` (the two jobs that
upload partial Codacy coverage) and isn't required by anything else — it doesn't gate the release
chain, it just finalizes the aggregated Codacy report once both partial uploads have completed.

All three Codacy upload steps (the partial uploads in `backend_tests`/`jasmine`, and the
finalize step in `coverage-final`) are best-effort/non-blocking (`|| true` on the upload
command): `CODACY_PROJECT_TOKEN` isn't provisioned in CircleCI's project settings yet, so as
things stand today the uploader always fails with "Invalid configuration: Either a project or
account API token must be provided". Making the step non-blocking keeps that missing credential
from failing `backend_tests`/`jasmine` themselves — which would otherwise incorrectly gate
`build-and-release` on an unrelated external-service token — while still actually attempting the
upload every run, so real Codacy reporting resumes automatically, with no further config change,
once the token is provisioned. The test/lint commands earlier in each job remain the real
pass/fail gate.

### `.codacy.yml` — suppressing confirmed static-analysis false positives

Separate from the CircleCI coverage upload above, Codacy's GitHub App also runs its own static
analysis directly against every PR (the "Codacy Static Code Analysis" check-run), gating on zero
new issues of at least minor severity. `.codacy.yml` (repo root) is Codacy's own supported,
version-controlled configuration file for narrowly excluding specific tool/path combinations from
that analysis — introduced to resolve a real block: PMD's ecmascript module
misparses this codebase's private class methods/fields (`static async #method() {}`) as a
redundant "Unnecessary block", flagging the method body itself. Confirmed as a PMD parser
limitation with this JS syntax, not a real code smell, this is scoped to only the three files that
use private methods heavily (`ApiClient.js`, `AccountsClient.js`, `HeaderController.js`) via
`engines.pmd.exclude_paths`, rather than disabling PMD (or any rule) repository-wide. Other
confirmed false positives (Codacy's `xss/no-mixed-html` firing on
`renderToStaticMarkup`-based Jasmine spec assertions, and `security/detect-object-injection`
firing on bracket-notation access with a compile-time-fixed key) were resolved with narrower,
per-line `// eslint-disable-next-line <rule>` comments instead, since Codacy's ESLint-based tool
respects native ESLint inline-disable syntax — `.codacy.yml` was reserved for PMD, which has no
such per-line mechanism available here. Future Codacy findings should default to the same
per-line-inline-disable approach when the underlying tool supports it, falling back to a
narrowly-scoped `.codacy.yml` `exclude_paths` entry (documented inline, same as above) only when
it doesn't.

### Why `build-and-release` requires the production-base release-image jobs

`build-and-release` requires `release-production_citadel_placeholder-base` and
`release-production_citadel_placeholder-base-arm64` even though its own steps
(`scripts/deploy.sh update_deploy_branch` / `deploy`) never reference the image directly. The
dependency exists purely to sequence the Docker Hub push ahead of the Render deploy trigger:
`dockerfiles/production_citadel_placeholder/Dockerfile` is `FROM darthjee/production_citadel_placeholder-base:latest`,
so Render's build must never fire before the freshly built `production_citadel_placeholder-base:latest` has
finished pushing — otherwise it could pull a stale image left over from a previous release. Same
pattern already existed for `upload_fe_files`, which requires `release-vite_citadel_placeholder-base(-arm64)`
for the equivalent reason on the frontend side.

`release` (the final atomic-swap job) does not need its own direct dependency on the
production-base jobs — it already requires `build-and-release`, and CircleCI only starts a job
once everything in its `requires` list has finished successfully, so the ordering guarantee
holds transitively.

`release-citadel_placeholder-base(-arm64)` and `release-circleci_citadel_placeholder-base(-arm64)` don't need a direct
`build-and-release`/`release` dependency either: `release-circleci_citadel_placeholder-base(-arm64)` is
already required by `backend_tests`/`backend_checks`, both of which run before
`build-and-release`/`release` in the graph, so they're safely ordered transitively too.
`release-citadel_placeholder-base(-arm64)` (the dev-only base image) isn't required by anything in this
workflow at all — nothing downstream depends on it being fresh.

## CI jobs

| Job | Image/Executor | Filter | Purpose |
|-----|-----------------|--------|---------|
| `backend_tests` | `darthjee/circleci_citadel_placeholder-base:0.1.0` | every push | `yarn_project` instance (`dir: backend`, `script: coverage`, `upload_coverage: true`): backend test suite + coverage; uploads a partial Codacy coverage report afterward (best-effort, non-blocking) |
| `backend_checks` | `darthjee/circleci_citadel_placeholder-base:0.1.0` | every push | `yarn_project` instance (`dir: backend`, `script: lint`): backend ESLint |
| `jasmine` | `darthjee/circleci_node:0.2.1` | every push | `yarn_project` instance (`dir: frontend`, `script: coverage`, `upload_coverage: true`): frontend test suite + coverage; uploads a partial Codacy coverage report afterward (best-effort, non-blocking) |
| `frontend-checks` | `darthjee/circleci_node:0.2.1` | every push | `yarn_project` instance (`dir: frontend`, `script: lint`): frontend ESLint |
| `proxy_extension_tests` | `darthjee/tent-test:0.10.4` | every push | PHPUnit tests for `proxy/extension/` |
| `coverage-final` | `darthjee/circleci_citadel_placeholder-base:0.1.0` | every push | Finalizes the aggregated Codacy coverage report once `backend_tests`/`jasmine`'s partial uploads land (best-effort, non-blocking) |
| `release-image` | machine (multi-arch: amd64 + arm64) | every push (no-op unless tag) | Publishes one of the 4 base images to Docker Hub via `bin/image.sh`; instantiated through a single workflow `matrix` (4 images × 2 archs = 8 jobs) — see below |
| `build-and-release` | machine | tag only | Triggers the Render deploy of the backend (`scripts/deploy.sh`), blocks until it reports "live" |
| `upload_proxy_files` | `darthjee/tent:0.10.4` | tag only | Uploads Tent proxy runtime to the SSH deploy host's staging dir |
| `upload_fe_files` | `darthjee/vite_citadel_placeholder-base:0.1.0` | tag only | Builds the Vite frontend, uploads the static output to the staging dir |
| `upload_extension` | `darthjee/tent:0.10.4` | tag only | Uploads the proxy PHP extension (test files stripped) |
| `copy_proxy_configuration` | `darthjee/tent:0.10.4` | tag only | Uploads prod proxy config + restores host-only state (`locals.php`, `.htaccess`) |
| `release` | `darthjee/vite_citadel_placeholder-base:0.1.0` | tag only | Atomic swap: only runs once every upload/build job above has succeeded |

### `release-image` instances

`release-image` is a parameterized job (`image`, `suffix`), instantiated by one `matrix` entry in
the `test` workflow (`image` × `suffix`, with `suffix` either `""` for amd64 or `"-arm64"`). The
entry's `name:` is the template `release-<< matrix.image >><< matrix.suffix >>`, which yields the
eight job names below (the names are referenced by `requires:` and must stay stable). The release
step strips the leading `-` from `suffix` before calling `bin/image.sh push <image> [arch]`, so
`bin/image.sh` still receives an empty arch (amd64) or `arm64`:

| Instance name | `image` param | Publishes |
|---------------|----------------|-----------|
| `release-citadel_placeholder-base(-arm64)` | `citadel_placeholder-base` | Dev backend base image |
| `release-circleci_citadel_placeholder-base(-arm64)` | `circleci_citadel_placeholder-base` | CI backend base image (used by `backend_tests`/`backend_checks`) |
| `release-production_citadel_placeholder-base(-arm64)` | `production_citadel_placeholder-base` | Production backend base image (`production_citadel_placeholder` is `FROM` this, by `:latest`) |
| `release-vite_citadel_placeholder-base(-arm64)` | `vite_citadel_placeholder-base` | Frontend/proxy build base image |

The backend image family (`citadel_placeholder-base`, `circleci_citadel_placeholder-base`, `production_citadel_placeholder-base`)
is built in CI but **not actually published to Docker Hub** — only the frontend/proxy
(`vite_citadel_placeholder*`) images are. `bin/image.sh` still runs the `release-image` job for all of them
so the ordering/`requires` machinery stays uniform; see `docs/agents/environment-variables.md`
for which Docker Hub credentials are actually wired up.

### Shared base Dockerfile

All four `*-base` images are built by `bin/image.sh` from the single
`dockerfiles/base/Dockerfile`, selecting the image with `docker build --target <image>`. The
per-image differences (base image, user, home/app/source directories, yarn cache path, rsync pin,
and the user running `yarn_builder.sh`) are build args set per image in the `build_args` function
of `bin/image.sh`; the only per-image content left in the Dockerfile is each target's exec-form
`CMD`. Consequences:

- Since the arg sets live in `bin/image.sh`, `skip_if_unchanged` diffs both `dockerfiles/base/` and
  `bin/image.sh`: a change to either rebuilds all four images on the next tag (`FORCE_IMAGE_BUILD`
  still bypasses the guard).
- The version pins live in one place, as `ARG` defaults at the top of `dockerfiles/base/Dockerfile`:
  `SCRIPTS_IMAGE` (`darthjee/scripts`) and `NODE_IMAGE_VERSION` (used for both `darthjee/node` and
  `darthjee/circleci_node`), so a bump is a one-line edit. The `darthjee/scripts` pin in the leaf
  Dockerfiles is separate and not covered by this.
- `BUILDER_USER` is `root` for `citadel_placeholder-base` and `vite_citadel_placeholder-base`: `yarn_builder.sh` has to be
  able to write to the root-owned global yarn cache in the node images, otherwise it finds no new
  packages and the pre-warmed cache ends up empty. `production_citadel_placeholder-base` and
  `circleci_citadel_placeholder-base` keep running it as their own user.

## CI setup pattern (backend/frontend jobs)

`backend_tests`, `backend_checks`, `jasmine` and `frontend-checks` are four workflow entries of one
`yarn_project` job (parameters: `dir` — `backend` | `frontend`, `image`, `script`, `step_name`,
`upload_coverage`), each setting `name:` to the job name shown above. The job runs `checkout`,
the shared `setup_project` command, `npm run <script>`, and — when `upload_coverage` is true — the
best-effort Codacy upload.

`setup_project` (a top-level CircleCI `commands:` entry, also used by `upload_fe_files` with
`dir: frontend`) copies the chosen subdirectory to the workspace root and drops the other one, since
the CI base images expect files there, then runs `yarn install`:

```yaml
# dir: backend
rm frontend -rf; cp backend/* ./ -r; rm backend -rf

# dir: frontend
rm backend -rf; cp frontend/* ./ -r; rm frontend -rf
```

## Validating the CircleCI config locally

The `circleci` compose service (pinned `circleci/circleci-cli` image, `.circleci/` mounted
read-only) runs the CircleCI CLI without installing anything on the host:

```bash
docker-compose run --rm circleci config validate
docker-compose run --rm circleci config process .circleci/config.yml   # expanded jobs/workflows
```

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/deploy.sh` | Trigger and monitor a Render.com deployment (`update_deploy_branch`, `deploy`) |
| `scripts/render.sh` | Render.com API helpers (sourced by `deploy.sh`) |
| `scripts/bump_version.sh` | Bump the version string across the repo |
| `scripts/wake_navi.sh` / `scripts/warm_navi_cache.sh` | Navi cache-warmer scripts — not yet wired into CircleCI, see `docs/agents/cache-warmer.md` |
| `bin/image.sh` | Builds/pushes a `release-image` instance; `skip_if_not_tag`/`skip_if_unchanged` guards, `qemu`/`push` subcommands |
| `bin/deploy_frontend.sh` | SSH-based upload/release helpers used by `upload_proxy_files`, `upload_fe_files`, `upload_extension`, `copy_proxy_configuration`, `release` |

## Migrations on production boot

`dockerfiles/production_citadel_placeholder/Dockerfile` sets `dockerfiles/production_citadel_placeholder/entrypoint.sh`
as its `ENTRYPOINT`. On container start, the entrypoint runs `yarn migration:run` first and,
because it's a `set -e` `/bin/sh` script, any migration failure aborts immediately with a
non-zero exit — `node dist/main.js` (invoked via `exec`, so it replaces the shell as PID 1) never
runs against a broken/partial schema. This applies only to the production image; the dev/test
containers (`citadel_placeholder_app`, `citadel_placeholder_tests`) and `make setup` are unchanged and still run
migrations manually.

This issue does not add automated migration-revert tooling. If a deploy that included a new
migration is rolled back, the newer migration's schema changes remain in the database — reverting
them requires manually running `yarn migration:revert` (e.g. via a one-off shell against the
running container, or a local connection using the deploy's `CITADEL_PLACEHOLDER_MYSQL_*` values).

## No Navi warm-up job yet

Citadel Placeholder's `.circleci/config.yml` has no job that
pings or warms the Navi cache server after a release — see `docs/agents/cache-warmer.md` for the
current state and `docs/agents/issues/` for tracked work wiring it in.
