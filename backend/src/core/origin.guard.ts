import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { buildCorsOptions } from './cors-config.js';

// The only HTTP methods that can change state, hence the only ones checked.
const STATE_CHANGING_METHODS: readonly string[] = ['POST', 'PUT', 'PATCH', 'DELETE'];
// `Sec-Fetch-Site` values meaning the request came from the page's own
// origin (`same-origin`) or from the user directly, e.g. typing the URL or
// a bookmark (`none`) — never a forgery vector.
const SAFE_FETCH_SITES: readonly string[] = ['same-origin', 'none'];

/**
 * The request attributes the CSRF decision depends on. Header values are
 * `undefined` when the header is absent.
 */
export interface OriginCheckRequest {
  method: string;
  secFetchSite?: string;
  origin?: string;
  host?: string;
}

/**
 * Decides whether a request may proceed, applying the CSRF decision table.
 * Pure, so it is unit-testable without Nest. Rows:
 *
 * - Safe methods (`GET`/`HEAD`/`OPTIONS`) always pass: they must not change
 *   state, so forging them gains an attacker nothing.
 * - `Sec-Fetch-Site: same-origin`/`none` pass: the browser vouches that the
 *   request came from our own page or from the user directly.
 * - `Sec-Fetch-Site: same-site`/`cross-site` (or any unknown value) pass only
 *   with a trusted `Origin`: the same allowlist CORS uses, so a legitimate
 *   split-origin frontend still works while any other site is rejected.
 * - No `Sec-Fetch-Site` and no `Origin` pass: that is a non-browser client
 *   (CLI, curl, the cache warmer), which carries no ambient browser cookies
 *   to abuse.
 * - No `Sec-Fetch-Site` but an `Origin` (older browsers) passes only when the
 *   origin is trusted or its host equals the request's `Host` header (i.e. a
 *   same-origin request); any other origin is rejected.
 *
 * An unparseable `Origin` (including the literal `null` sent by sandboxed
 * or privacy-sensitive contexts) is always treated as untrusted.
 * @param {OriginCheckRequest} request - The method and relevant headers.
 * @param {string[] | true} trustedOrigins - The CORS allowlist; `true` means
 *   any (parseable) origin is trusted.
 * @returns {boolean} `true` when the request may proceed, `false` when it
 *   must be rejected as a cross-site forgery.
 */
export function isCrossSiteRequestAllowed(
  request: OriginCheckRequest,
  trustedOrigins: string[] | true,
): boolean {
  if (!STATE_CHANGING_METHODS.includes(request.method.toUpperCase())) {
    return true;
  }

  const { secFetchSite, origin, host } = request;

  if (secFetchSite !== undefined) {
    return SAFE_FETCH_SITES.includes(secFetchSite) || isTrustedOrigin(origin, trustedOrigins);
  }

  if (origin === undefined) {
    return true;
  }

  return isTrustedOrigin(origin, trustedOrigins) || isSameHost(origin, host);
}

/**
 * Global guard enforcing CSRF protection on every state-changing request
 * (`POST`/`PUT`/`PATCH`/`DELETE`), authenticated or not, from the
 * `Sec-Fetch-Site`, `Origin` and `Host` headers. Registered as the first
 * `APP_GUARD` (ahead of `JwtGuard`), so a forged request to an authenticated
 * route is rejected with `403` rather than `401`. Complements — does not
 * replace — the `SameSite=Strict` auth cookies. Trusts exactly the origins
 * CORS trusts (`buildCorsOptions`); the decision itself lives in
 * `isCrossSiteRequestAllowed`.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly trustedOrigins: string[] | true;

  /**
   * @param {ConfigService} configService - Supplies the CORS allowlist env
   *   vars, resolved once, at construction (already validated at boot by
   *   `main.ts`, so this does not throw).
   */
  constructor(configService: ConfigService) {
    this.trustedOrigins = buildCorsOptions(configService)?.origin ?? [];
  }

  /**
   * Rejects cross-site state-changing requests.
   * @param {ExecutionContext} context - The current request's execution context.
   * @returns {boolean} `true` when the request may proceed.
   * @throws {ForbiddenException} When the request is a cross-site forgery.
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const allowed = isCrossSiteRequestAllowed(
      {
        method: request.method,
        secFetchSite: readHeader(request, 'sec-fetch-site'),
        origin: readHeader(request, 'origin'),
        host: readHeader(request, 'host'),
      },
      this.trustedOrigins,
    );

    if (!allowed) {
      throw new ForbiddenException('Cross-site request rejected');
    }

    return true;
  }
}

/**
 * Checks an `Origin` header value against the trusted origins.
 * @param {string | undefined} origin - The `Origin` header value.
 * @param {string[] | true} trustedOrigins - The CORS allowlist, or `true`.
 * @returns {boolean} Whether the origin is present, parseable and trusted.
 */
function isTrustedOrigin(origin: string | undefined, trustedOrigins: string[] | true): boolean {
  if (origin === undefined || parseUrl(origin) === null) {
    return false;
  }

  return trustedOrigins === true || trustedOrigins.includes(origin);
}

/**
 * Checks whether the `Origin`'s host matches the request's `Host` header,
 * i.e. the request is same-origin.
 * @param {string} origin - The `Origin` header value.
 * @param {string | undefined} host - The `Host` header value.
 * @returns {boolean} Whether both are present and the hosts are equal.
 */
function isSameHost(origin: string, host: string | undefined): boolean {
  const url = parseUrl(origin);

  return url !== null && host !== undefined && url.host === host;
}

/**
 * Reads a single request header, taking the first value if repeated.
 * @param {Request} request - The Express request.
 * @param {string} name - The lower-case header name.
 * @returns {string | undefined} The header value, or `undefined` when absent.
 */
function readHeader(request: Request, name: string): string | undefined {
  const value = request.headers[name];

  return Array.isArray(value) ? value[0] : value;
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
