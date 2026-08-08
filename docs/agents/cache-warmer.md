# Cache Warmer

Citadel Placeholder uses [Navi](https://github.com/darthjee/navi) to warm the Tent proxy cache after each
production release. See
[`external/HOW_TO_USE_NAVI.md`](external/HOW_TO_USE_NAVI.md) for the full Navi config-format
reference (fields, pagination, splitting config via `include:`/`namespace:`) — those mechanics
aren't repeated here.

## Citadel Placeholder is mostly not cacheable through Navi

Navi only warms **public, identical-for-everyone**
responses. Citadel Placeholder is multi-tenant — most application endpoints are expected to return data scoped to
the requesting user, not a shared public response. Default
assumption for any new endpoint: **it does not belong in Navi's warm-up config.** Only add one
if it's genuinely public and unauthenticated (e.g. a possible future public status page), i.e.
a GET route declared `@CachePolicy(CacheClass.Public)`. `user-scoped` and `never` routes are
never warmed. See [API Caching](architecture/caching.md) for the cache classes.

## Per-user cache (upcoming)

Today, the rule for any user-scoped endpoint (see
[Flow](flow.md#per-user-cache-upcoming)) is: declare it `@CachePolicy(CacheClass.UserScoped)`, which sets the `X-Skip-Cache` header so
it bypasses Tent's shared HTTP cache entirely (see [API Caching](architecture/caching.md) and
`.claude/agents/cache.md`'s cache-class review). That's a
correctness requirement, not a performance story — user-scoped responses currently get no
caching at all.

A **per-user cache** capability is in active development on Tent itself, meant to let
user-scoped responses be cached safely (keyed per user, not shared across users the way Navi's
warm-up is). It is not available yet. Once it lands:

- Update this section with the actual mechanism (cache key shape, invalidation, how a route
  opts in) once it's implemented.
- Update `.claude/agents/cache.md` and `.claude/agents/proxy.md` to describe when a route should
  use it instead of `X-Skip-Cache`.
- Update `docs/agents/flow.md`'s repo-selection step accordingly.

## Configuration

The Navi configuration entry file lives at [`navi/navi_config.yaml`](../../navi/navi_config.yaml).
It holds the `web`, `workers`, and `failure` sections, and pulls in the `resources`/`clients`
sections via a top-level `include:` list. Currently only one file is included:

- `clients.yml` — the `clients.default` block (base URL, timeout) used to make every request in
  any future resource file.

There is no `issues.yml` or similar resource file yet — the issues API doesn't exist. When one
is eventually warranted (for the narrow slice of Citadel Placeholder's surface that's genuinely public), add
it to `include:` here and declare `namespace: $NAVI_NAMEPACE` at its top, matching `clients.yml`'s
convention.

## Maintaining this configuration

`navi/navi_config.yaml`, the files under `navi/resources/`, and this document are owned by the
[`cache`](../../.claude/agents/cache.md) agent. When (if) a new public, non-user-scoped API
endpoint is added, follow these rules:

- Include regular (unparameterized or already-reachable) endpoints, paginated resources
  (`paginated_actions`), and nested resources reached via `actions` — but only if genuinely
  public.
- Never include mutation endpoints (anything other than `GET`).
- Never include user-scoped or restricted endpoints — when in doubt, exclude it.

## CI (CircleCI)

`warm-up-cache` runs automatically after `release`, gated to version tags (`\d+\.\d+\.\d+`). It
uses `darthjee/navi-hey-client:latest` directly as the executor and runs `infra`'s
`scripts/warm_navi_cache.sh` in two steps: `config` (pushes every file listed in that script's
`RESOURCE_FILES` array — currently just `clients.yml` — via one `navi-client -a config --file
...` call per file) and `engine-start` (triggers the warm-up for the build's namespace). See
[`external/HOW_TO_USE_NAVI-CLIENT.md`](external/HOW_TO_USE_NAVI-CLIENT.md) for the `navi-client`
CLI/library reference.

`wake-navi` runs `infra`'s `scripts/wake_navi.sh` early in the workflow (no `requires:`, so it
doesn't gate or get gated by anything) to ping `$NAVI_URL` awake before `warm-up-cache` needs
it, retrying while the server responds `502`.

Namespace resolution: every included resource file declares `namespace: $NAVI_NAMEPACE`. In CI,
`infra`'s `warm-up-cache` job computes
`NAVI_NAMEPACE="${CITADEL_PLACEHOLDER_NAMESPACE}-${CIRCLE_WORKFLOW_WORKSPACE_ID}"` before invoking
`navi-client`, so each build gets its own namespace slice. `$CITADEL_PLACEHOLDER_NAMESPACE`, `$NAVI_URL`,
and `$NAVI_API_TOKEN` must be set in the CircleCI project settings (Project Settings →
Environment Variables), the same convention used for `$CITADEL_PLACEHOLDER_PRODUCTION_URL`.

## Local testing (Docker Compose)

```bash
docker-compose up citadel_placeholder_navi
```

The Navi web UI will be available at <http://localhost:3100> while the container is running.
`CITADEL_PLACEHOLDER_PRODUCTION_URL` defaults to `http://localhost:3000` in `.env.dev.sample`.
`NAVI_NAMEPACE` doesn't need to be set manually for local dev — it defaults to `default`,
matching Navi's own "absent `namespace:` falls back to `default`" convention.
