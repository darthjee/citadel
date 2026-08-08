import { ConfigService } from '@nestjs/config';

// Env var holding the explicit, comma-separated CORS allowlist.
const ALLOWED_ORIGINS_VAR = 'CITADEL_PLACEHOLDER_ALLOWED_ORIGINS';
// Env var used as the fallback single-origin allowlist.
const FRONTEND_BASE_URL_VAR = 'FRONTEND_BASE_URL';
// The only URL schemes accepted as CORS origins.
const ALLOWED_PROTOCOLS: readonly string[] = ['http:', 'https:'];
// Wildcard entry, reflected per-request (dev only; never allowed in production).
const WILDCARD = '*';

/**
 * Frozen options handed to Nest's `app.enableCors`: either an explicit list
 * of bare origins, or `true` (reflect the request origin — the non-production
 * wildcard), always with credentials enabled for the auth cookies.
 */
export interface CorsConfig {
  origin: string[] | true;
  credentials: true;
}

/**
 * Resolves the CORS options once at boot. Resolution order:
 * `CITADEL_PLACEHOLDER_ALLOWED_ORIGINS` (comma-separated bare origins, or a sole `*`
 * outside production), then the origin of `FRONTEND_BASE_URL`, otherwise
 * `undefined` (CORS stays disabled; same-origin only). Pure apart from the
 * `ConfigService` reads, so it is unit-testable without booting the app.
 * @param {ConfigService} configService - Supplies `CITADEL_PLACEHOLDER_ALLOWED_ORIGINS`,
 *   `FRONTEND_BASE_URL` and `NODE_ENV`.
 * @returns {CorsConfig | undefined} The frozen CORS options, or `undefined`
 *   when neither variable is set.
 * @throws {Error} When an allowlist entry is empty, not a bare http(s)
 *   origin, or a wildcard used in production or mixed with other entries;
 *   or when `FRONTEND_BASE_URL` is unparseable or not http(s).
 */
export function buildCorsOptions(configService: ConfigService): CorsConfig | undefined {
  const allowed = readTrimmed(configService, ALLOWED_ORIGINS_VAR);

  if (allowed !== '') {
    const isProduction = readTrimmed(configService, 'NODE_ENV') === 'production';

    return Object.freeze({ origin: parseAllowedOrigins(allowed, isProduction), credentials: true });
  }

  const frontendBaseUrl = readTrimmed(configService, FRONTEND_BASE_URL_VAR);

  if (frontendBaseUrl !== '') {
    return Object.freeze({ origin: [originFromFrontendBaseUrl(frontendBaseUrl)], credentials: true });
  }

  return undefined;
}

/**
 * Reads a string env var and trims it.
 * @param {ConfigService} configService - Source of the raw value.
 * @param {string} name - The env var name.
 * @returns {string} The trimmed value, or `''` when unset.
 */
function readTrimmed(configService: ConfigService, name: string): string {
  return (configService.get<string>(name) ?? '').trim();
}

/**
 * Splits and validates the explicit allowlist.
 * @param {string} raw - The trimmed, non-blank `CITADEL_PLACEHOLDER_ALLOWED_ORIGINS` value.
 * @param {boolean} isProduction - Whether `NODE_ENV` is `production`.
 * @returns {string[] | true} The validated origins, or `true` for a sole
 *   non-production wildcard.
 * @throws {Error} On an empty entry, a disallowed wildcard, or a non-bare origin.
 */
function parseAllowedOrigins(raw: string, isProduction: boolean): string[] | true {
  const entries = raw.split(',').map((entry) => entry.trim());

  if (entries.includes(WILDCARD)) {
    return assertWildcardAllowed(entries, isProduction);
  }

  entries.forEach(assertBareOrigin);

  return entries;
}

/**
 * Validates a wildcard allowlist.
 * @param {string[]} entries - The trimmed allowlist entries (containing `*`).
 * @param {boolean} isProduction - Whether `NODE_ENV` is `production`.
 * @returns {true} `true`, meaning "reflect the request origin".
 * @throws {Error} When in production, or when `*` is mixed with other entries.
 */
function assertWildcardAllowed(entries: string[], isProduction: boolean): true {
  if (isProduction) {
    throw new Error(`Invalid ${ALLOWED_ORIGINS_VAR} entry "${WILDCARD}": wildcard is not allowed when NODE_ENV=production`);
  }

  if (entries.length !== 1) {
    throw new Error(`Invalid ${ALLOWED_ORIGINS_VAR} entry "${WILDCARD}": wildcard must be the sole entry`);
  }

  return true;
}

/**
 * Asserts an allowlist entry is a bare http(s) origin (`scheme://host[:port]`)
 * that is already in its normalised form.
 * @param {string} entry - The trimmed allowlist entry.
 * @returns {void} Returns normally when the entry is valid.
 * @throws {Error} Naming the entry, when it is empty, unparseable, not
 *   http(s), or not equal to its own normalised origin.
 */
function assertBareOrigin(entry: string): void {
  if (entry === '') {
    throw new Error(`Invalid ${ALLOWED_ORIGINS_VAR} entry "${entry}": empty entries are not allowed`);
  }

  const url = parseUrl(entry);

  if (!url || !ALLOWED_PROTOCOLS.includes(url.protocol) || url.origin !== entry) {
    throw new Error(`Invalid ${ALLOWED_ORIGINS_VAR} entry "${entry}": must be a bare origin (scheme://host[:port])`);
  }
}

/**
 * Derives the single allowed origin from `FRONTEND_BASE_URL`, dropping any path.
 * @param {string} raw - The trimmed, non-blank `FRONTEND_BASE_URL` value.
 * @returns {string} The URL's origin.
 * @throws {Error} When the value is unparseable or not http(s).
 */
function originFromFrontendBaseUrl(raw: string): string {
  const url = parseUrl(raw);

  if (!url || !ALLOWED_PROTOCOLS.includes(url.protocol)) {
    throw new Error(`Invalid ${FRONTEND_BASE_URL_VAR} "${raw}": must be an http(s) URL`);
  }

  return url.origin;
}

/**
 * Parses a URL without throwing.
 * @param {string} raw - The candidate URL.
 * @returns {URL | null} The parsed URL, or `null` when unparseable.
 */
function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}
