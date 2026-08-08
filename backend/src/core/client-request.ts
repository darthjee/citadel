import type { Request } from 'express';

/** The requesting client's IP address and User-Agent string. */
export interface ClientRequestInfo {
  ip: string;
  userAgent: string;
}

// Default number of trusted `X-Forwarded-For` proxy hops, matching today's single-Tent-hop
// deployment, used by callers that don't thread a `CITADEL_PLACEHOLDER_TRUSTED_PROXY_HOPS`-driven value in.
export const DEFAULT_TRUSTED_PROXY_HOPS = 1;

/**
 * Extracts the requesting client's IP address and User-Agent from an Express
 * `Request`, for endpoints (e.g. `AuthorizationRequestController#create`)
 * that need to record who made a request. This is a plain utility outside
 * NestJS DI, so `trustedProxyHops` — normally `CITADEL_PLACEHOLDER_TRUSTED_PROXY_HOPS`,
 * read via `ConfigService` — must be threaded in by the (injectable) caller.
 * @param {Request} req - The incoming Express request.
 * @param {number} trustedProxyHops - How many `x-forwarded-for` hops, counted from the right
 *   (nearest to this server), are trusted. Only that many trailing hops are ever considered;
 *   anything further left — which could be supplied by a client bypassing the trusted proxy
 *   chain entirely — is ignored. Defaults to `DEFAULT_TRUSTED_PROXY_HOPS`.
 * @returns {ClientRequestInfo} The IP (the trusted-boundary token of `x-forwarded-for`, falling
 *   back to `req.socket.remoteAddress` when the header is absent) and the `user-agent` header
 *   (`''` when absent).
 */
export function extractClientRequestInfo(
  req: Request,
  trustedProxyHops: number = DEFAULT_TRUSTED_PROXY_HOPS,
): ClientRequestInfo {
  const forwardedFor = req.headers['x-forwarded-for'];
  const ip = extractIp(forwardedFor, req.socket.remoteAddress, trustedProxyHops);
  const userAgent = req.headers['user-agent'] ?? '';

  return { ip, userAgent };
}

function extractIp(
  forwardedFor: string | string[] | undefined,
  fallback: string | undefined,
  trustedProxyHops: number,
): string {
  const value = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;

  if (!value) {
    return fallback ?? '';
  }

  const hops = value
    .split(',')
    .map((hop) => hop.trim())
    .filter((hop) => hop.length > 0);

  if (hops.length === 0) {
    return fallback ?? '';
  }

  const trustedIndex = Math.max(0, hops.length - trustedProxyHops);

  // `trustedIndex` is always within `[0, hops.length)` here: it is clamped to
  // `>= 0` and `hops` is non-empty.
  return hops.at(trustedIndex)!;
}
