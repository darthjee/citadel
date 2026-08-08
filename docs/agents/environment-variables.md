# Environment Variables

Every environment variable Citadel Placeholder's production deployment needs, gathered from what the code
actually reads (not just what's documented elsewhere) — grep the `Source` column if in doubt.
Local dev's equivalent is `.env.dev.sample` (copied to `.env` by `make setup`); nothing here
should drift from that file without a reason noted below. Real `.env.prod` / CircleCI project
variables are never committed (`.gitignore`) — this doc is the map for filling them in.

## 1. Backend application runtime

Set on the backend host (Render service env vars in the real deployment; `.env.prod` when
running `citadel_placeholder_prod_app` locally to sanity-check the production image).

| Variable | Status | Purpose | Source |
|---|---|---|---|
| `CITADEL_PLACEHOLDER_SECRET_KEY` | **Consumed** | The current secret key. Signs every new JWT access token, derives the HMAC cache token (`CacheTokenService` has no callers yet), and is the first secret handed to `cookie-parser` (no cookie is signed today, so this is dormant). Must be a long random value in production — the dev sample ships an intentionally insecure placeholder. See "Rotating `CITADEL_PLACEHOLDER_SECRET_KEY`" below. | `backend/src/core/secret-keys.ts`, `backend/src/app.module.ts`, `backend/src/core/cache-token.service.ts`, `backend/src/main.ts` |
| `CITADEL_PLACEHOLDER_PREVIOUS_SECRET_KEYS` | **Consumed**, optional | Comma-separated list of retired secret keys, still accepted when verifying JWT access tokens (tried after the current key, in order) and passed to `cookie-parser` after the current key. Never used to sign anything. Entries are trimmed; blanks, duplicates and any entry equal to `CITADEL_PLACEHOLDER_SECRET_KEY` are dropped. Defaults to empty. | `backend/src/core/secret-keys.ts`, `backend/src/core/jwt.guard.ts`, `backend/src/main.ts` |
| `CITADEL_PLACEHOLDER_ACCESS_TOKEN_TTL_MS` | **Consumed**, optional | Access-token lifetime, in milliseconds. Drives both the signed JWT's `signOptions.expiresIn` (`app.module.ts`, converted to seconds for `jsonwebtoken`) and the `access_token` cookie's `maxAge` (`auth.controller.ts`, used as-is), so the two always agree. Defaults to `900000` (15 minutes) when unset. | `backend/src/app.module.ts`, `backend/src/auth/auth.controller.ts` |
| `CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_TTL_MS` | **Consumed**, optional | How long a device-authorization request (`POST /auth/authorization-requests.json`) stays pollable before lazily flipping to `expired`, in milliseconds. Defaults to `3600000` (1 hour) when unset. | `backend/src/auth/authorization-request.service.ts` |
| `CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_CREATE_LIMIT` | **Consumed**, optional | Per-IP/per-username request count allowed within the sliding window before `create` is throttled. Defaults to `5`. | `backend/src/auth/authorization-request-abuse-guard.service.ts` |
| `CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_CREATE_WINDOW_MS` | **Consumed**, optional | Sliding window (milliseconds) the `create` rate limit above counts requests over. Defaults to `60000` (1 minute). | `backend/src/auth/authorization-request-abuse-guard.service.ts` |
| `CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_MAX_OPEN_PER_USER` | **Consumed**, optional | Cap on a resolved user's simultaneous `open` authorization requests; the oldest is evicted (flipped to `expired`) to make room for a new one rather than rejecting it. Defaults to `5`. | `backend/src/auth/authorization-request-abuse-guard.service.ts` |
| `CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_AUTHORIZE_MAX_ATTEMPTS` | **Consumed**, optional | Consecutive wrong-password `authorize` attempts, per request row, that trip the cool-off lockout. Defaults to `5`. | `backend/src/auth/authorization-request-abuse-guard.service.ts` |
| `CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_AUTHORIZE_LOCK_MS` | **Consumed**, optional | Cool-off duration (milliseconds) once the max-attempts threshold above is reached. Defaults to `300000` (5 minutes). | `backend/src/auth/authorization-request-abuse-guard.service.ts` |
| `CITADEL_PLACEHOLDER_ACCOUNT_EDIT_MAX_ATTEMPTS` | **Consumed**, optional | Consecutive failed `PATCH /auth/account.json` attempts (wrong current password, duplicate username/email), per user, that trip the cool-off lockout. Defaults to `5`. | `backend/src/auth/account-edit-abuse-guard.service.ts` |
| `CITADEL_PLACEHOLDER_ACCOUNT_EDIT_LOCK_MS` | **Consumed**, optional | Cool-off duration (milliseconds) once the max-attempts threshold above is reached. Defaults to `300000` (5 minutes). | `backend/src/auth/account-edit-abuse-guard.service.ts` |
| `NODE_ENV` | **Consumed**, set to `production` in production | Read only by the CORS resolver: when exactly `production`, a `*` entry in `CITADEL_PLACEHOLDER_ALLOWED_ORIGINS` fails boot. The guard fails open — if it is unset or mistyped (`prod`), a `*` is accepted and reflects any origin with credentials — so production deployments must set `NODE_ENV=production`. Nothing else depends on it — the access-token cookie is always `Secure`/`httpOnly`/`SameSite=Strict` regardless of environment. | `backend/src/core/cors-config.ts` |
| `PORT` | **Consumed**, optional | Port the Nest HTTP server listens on (defaults to `8080`). Render injects its own `PORT` automatically — only set this explicitly for other hosts. | `backend/src/main.ts` |
| `CITADEL_PLACEHOLDER_MYSQL_HOST` | **Consumed** | Production MySQL connection. | `backend/src/database/data-source.ts`, `backend/src/app.module.ts` |
| `CITADEL_PLACEHOLDER_MYSQL_PORT` | **Consumed** | ditto | `backend/src/database/data-source.ts`, `backend/src/app.module.ts` |
| `CITADEL_PLACEHOLDER_MYSQL_USER` | **Consumed** | ditto | `backend/src/database/data-source.ts`, `backend/src/app.module.ts` |
| `CITADEL_PLACEHOLDER_MYSQL_PASSWORD` | **Consumed** | ditto | `backend/src/database/data-source.ts`, `backend/src/app.module.ts` |
| `CITADEL_PLACEHOLDER_MYSQL_NAME` | **Consumed** | ditto | `backend/src/database/data-source.ts`, `backend/src/app.module.ts` |
| `CITADEL_PLACEHOLDER_DEMO_PASSWORD` | **Consumed**, dev/seed-only | Password for the `demo` user seeded by the demo-seed migration. Falls back to a non-working placeholder (`citadel-placeholder-demo-placeholder`) if unset, so the real dev password only exists in `.env`/`.env.dev.sample`, never in source. | `backend/src/database/migrations/20260824120004-auth-seed-demo-user.ts` |
| `CITADEL_PLACEHOLDER_ALLOWED_ORIGINS` | **Consumed**, optional | Credentialed CORS allowlist (`credentials: true`), resolved once at boot. Comma-separated list of bare origins — `scheme://host[:port]`, `http`/`https` only, no path, query, fragment or trailing slash (e.g. `https://app.example.com,http://localhost:3000`); whitespace is trimmed, empty entries are rejected. Takes precedence over `FRONTEND_BASE_URL`. `*` (must be the sole entry) reflects any request origin and is dev-only — boot fails with it when `NODE_ENV=production`. Any malformed entry fails boot with an error naming the variable and the entry. When both this and `FRONTEND_BASE_URL` are unset/blank, CORS stays disabled (same-origin only). The same resolved list also defines the origins `OriginGuard` trusts for cross-site `POST`/`PUT`/`PATCH`/`DELETE` (CSRF) — see `docs/agents/architecture/security.md` — so adding an origin here is a trust change, not just a CORS tweak. | `backend/src/core/cors-config.ts`, `backend/src/core/origin.guard.ts`, `backend/src/main.ts` |
| `FRONTEND_BASE_URL` | **Consumed** | Base URL for password-reset links, and the CORS allowlist fallback: when `CITADEL_PLACEHOLDER_ALLOWED_ORIGINS` is unset/blank, CORS allows only this URL's origin (path dropped), and `OriginGuard` trusts that same origin for CSRF. An unparseable or non-http(s) value fails boot. | `backend/src/auth/password-reset.service.ts`, `backend/src/core/cors-config.ts`, `backend/src/core/origin.guard.ts` |
| `CITADEL_PLACEHOLDER_EMAILS_ENABLED` | **Consumed**, optional | Master toggle; `'true'` enables outbound sending, anything else (default) disables it (log-and-skip). | `backend/src/mail/mail.config.ts`, `backend/src/mail/mail.module.ts` |
| `CITADEL_PLACEHOLDER_EMAIL_HOST` | **Consumed** (required when enabled) | SMTP host. Boot throws if enabled without it. | `backend/src/mail/mail.config.ts` |
| `CITADEL_PLACEHOLDER_EMAIL_PORT` | **Consumed**, optional | SMTP port; defaults to `587`. `465` ⇒ implicit TLS (`secure`); other ports ⇒ STARTTLS when `CITADEL_PLACEHOLDER_EMAIL_USE_TLS`. | `backend/src/mail/mail.config.ts` |
| `CITADEL_PLACEHOLDER_EMAIL_USER` | **Consumed**, optional | SMTP auth username. `auth` is sent only when both user and password are set. | `backend/src/mail/mail.config.ts` |
| `CITADEL_PLACEHOLDER_EMAIL_PASSWORD` | **Consumed**, optional | SMTP auth password. | `backend/src/mail/mail.config.ts` |
| `CITADEL_PLACEHOLDER_EMAIL_USE_TLS` | **Consumed**, optional | Forces a STARTTLS upgrade on non-465 ports. Defaults to `true`. `CITADEL_PLACEHOLDER_EMAIL_USE_TLS=false` is ignored (STARTTLS still required) when SMTP credentials are configured. | `backend/src/mail/mail.config.ts` |
| `CITADEL_PLACEHOLDER_EMAIL_FROM` | **Consumed** (required when enabled) | Default `From:` address. Must be one the SMTP server is authorized to send as (SPF/DKIM). | `backend/src/mail/mail.config.ts` |
| `CITADEL_PLACEHOLDER_EMAIL_TIMEOUT_MS` | **Consumed**, optional | Bounds nodemailer's connection/greeting/socket timeouts. Defaults to `10000`. | `backend/src/mail/mail.config.ts` |
| `CITADEL_PLACEHOLDER_EMAIL_METHOD` | **Consumed**, optional | Selects the `EmailMethod` `MailService#sendEmail` delivers through (currently only `native`, the nodemailer transport). Defaults to `native`. Boot throws if set to an unregistered name. | `backend/src/mail/mail.config.ts` |
| `CITADEL_PLACEHOLDER_LOG_LEVEL` | **Consumed**, optional | Log-level threshold (`debug`/`info`/`warn`/`error`) for the Core logger service; defaults to `info` when unset. | `backend/src/core/logger.service.ts` |

**Device-authorization tuning — undocumented-but-defaulted in dev.** None of the six
`CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_*` variables above (TTL plus the five rate-limit/cap/cool-off keys)
are set in `.env.dev.sample` — local dev runs entirely on their code-level defaults (see each
row above). Set them explicitly only if a deployment needs different tuning.

### Rotating `CITADEL_PLACEHOLDER_SECRET_KEY`

Keys must not contain commas, and must not have leading or trailing whitespace. Entries in
`CITADEL_PLACEHOLDER_PREVIOUS_SECRET_KEYS` are trimmed, so a padded key would no longer match the value
that signed the old tokens.

**Routine rotation (zero downtime).** Use this only when the old key is *not* suspected to be
compromised:

1. Generate a new long random key.
2. Deploy with `CITADEL_PLACEHOLDER_SECRET_KEY=<new>` and `CITADEL_PLACEHOLDER_PREVIOUS_SECRET_KEYS=<old>`. New access
   tokens are signed with `<new>`; tokens already issued with `<old>` keep verifying.
3. Wait at least `CITADEL_PLACEHOLDER_ACCESS_TOKEN_TTL_MS` (default 15 minutes), counted from the moment
   *every* backend instance runs the new config (instances still on the old config keep signing
   with `<old>`), so every access token signed with `<old>` has expired.
4. Deploy again with `<old>` removed from `CITADEL_PLACEHOLDER_PREVIOUS_SECRET_KEYS`.

If Citadel Placeholder runs several backend instances behind a rolling deploy, old instances would reject tokens signed with `<new>` during the rollout. Use three
phases instead: (a) `CITADEL_PLACEHOLDER_SECRET_KEY=<old>`, `CITADEL_PLACEHOLDER_PREVIOUS_SECRET_KEYS=<new>`; (b)
`CITADEL_PLACEHOLDER_SECRET_KEY=<new>`, `CITADEL_PLACEHOLDER_PREVIOUS_SECRET_KEYS=<old>`; (c) remove `<old>`.

**Compromised key.** Do not list the leaked key in `CITADEL_PLACEHOLDER_PREVIOUS_SECRET_KEYS`, because
anyone holding it could keep forging access tokens until it is removed. Deploy the new
`CITADEL_PLACEHOLDER_SECRET_KEY` with the old key dropped entirely. Every outstanding access token is
rejected at once. Clients recover through the refresh flow, because refresh tokens do not
depend on the key.

Side effects (both variants):

- The cache token is always derived from the current key only, so it changes on the first
  deploy. That only causes cache misses.
- Refresh tokens are random values stored as SHA-256 hashes and do not depend on the key, so
  they are unaffected.

## 2. Proxy (production)

The production Tent proxy needs **no environment variables** — its config comes entirely from
`proxy/prod_configuration/locals.php` (real file gitignored; `locals.php.sample` is the
committed template), which is generated directly on the SSH host, not read from `.env.prod`.
`FRONTEND_DEV_MODE` only matters in `proxy/dev_configuration/` (local dev's Vite-vs-static
toggle) — don't look for a production equivalent, there isn't one.

## 3. Cache warmer (Navi)

Used by the `citadel_placeholder_navi` compose service and the CI `warm-up-cache`/`wake-navi` jobs (see
`docs/agents/cache-warmer.md`):

| Variable | Purpose | Source |
|---|---|---|
| `CITADEL_PLACEHOLDER_PRODUCTION_URL` | Base URL Navi warms requests against. | `navi/resources/clients.yml`, `docker-compose.yml` |
| `NAVI_NAMEPACE` | Navi cache namespace. | `navi/resources/clients.yml`, `scripts/warm_navi_cache.sh` |
| `NAVI_PORT` | Port Navi's own web UI listens on locally (`3100` in dev). | `navi/navi_config.yaml`, `docker-compose.yml` |

## 4. CircleCI project variables (deploy pipeline)

Not part of any `.env` file — set directly in CircleCI's project (or org) settings, consumed as
plain shell env vars by `scripts/`/`bin/` during CI jobs. `.circleci/config.yml`'s release chain
(`build-and-release`, `upload_proxy_files`, `copy_proxy_configuration`, `upload_extension`,
`upload_fe_files`, `release`), gated to semver tag pushes, requires every variable below. No real
Render service or SSH deploy host exists for Citadel Placeholder yet, though — provisioning that
infrastructure and filling in these values is a separate, not-yet-done step; until then, a tag
push runs the jobs but they fail against unset/placeholder credentials.

| Variable | Purpose | Used by |
|---|---|---|
| `DOCKER_ID_USER` | Docker Hub namespace for pushed images (frontend/proxy only — the backend image is never published, see `docs/agents/architecture/backend.md`). | `bin/image.sh` |
| `DOCKER_HUB_USERNAME` / `DOCKER_HUB_PASSWORD` | Docker Hub login for pushing images. | `bin/image.sh` |
| `RENDER_API_KEY` | Authenticates Render API calls (trigger/watch deploys). | `scripts/render.sh` |
| `RENDER_SERVICE_NAME` | Which Render service to deploy (defaults to `citadel-placeholder`). | `scripts/render.sh` |
| `SSH_PRIVATE_KEY` | SSH key for the proxy/static-asset deploy host. | `bin/deploy_frontend.sh` |
| `SSH_HOST` / `SSH_PORT` / `SSH_USER` | ditto | `bin/deploy_frontend.sh` |
| `SSH_REMOTE_DIR` | Live path on the deploy host, atomically swapped on release. | `bin/deploy_frontend.sh` |
| `SSH_REMOTE_TEMP_DIR` | Workspace-scoped staging path before the atomic swap. | `bin/deploy_frontend.sh` |
| `NAVI_URL` | Navi server URL for cache warm-up and wake calls. | `scripts/warm_navi_cache.sh`, `scripts/wake_navi.sh` |
| `NAVI_API_TOKEN` | Auth token for Navi's `navi-client`. | `scripts/warm_navi_cache.sh` |
| `CITADEL_PLACEHOLDER_NAMESPACE` | Combined with the CircleCI workspace ID to build a per-build Navi namespace. | Not yet consumed — reserved for a future `warm-up-cache` job (cache warm-up is out of scope for the current release chain; see `docs/agents/cache-warmer.md`). |
| `CODACY_PROJECT_TOKEN` | Coverage upload target, read implicitly by Codacy's own uploader script. | `backend_tests`/`jasmine` CI jobs |
| `CITADEL_SKIP_RELEASE` | **Template-only.** Set to exactly `true` only on the template repo's own CircleCI project, so every release-type job (the release chain above plus the `release-image` matrix) halts green without doing anything. Any other value, or leaving it unset, releases normally. Projects built from the template must not set it. `scripts/init_project.sh` does not rename it. | `skip_release_if_disabled` command in `.circleci/config.yml` |

## Keeping this doc honest

If you add code that reads a new `process.env.*` / `getenv()` value, or wire up a var currently
marked "Reserved, not yet read," update its row here in the same change — this doc is only useful
if it matches what the code actually does.
