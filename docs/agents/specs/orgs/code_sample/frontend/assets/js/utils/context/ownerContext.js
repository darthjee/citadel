/** Largest organization id accepted; mirrors the backend's rule (Postgres `integer`). */
export const MAX_ORG_ID = 2147483647;

const ORG_ID_PATTERN = /^[1-9][0-9]*$/;

const ORG_PREFIX_PATTERN = /^\/orgs\/([^/]+)(\/.*)?$/;

/** The Personal owner context. */
export const PERSONAL = Object.freeze({ kind: 'personal' });

/**
 * Build an organization owner context.
 *
 * @param {number} orgId - The (already validated) organization id.
 * @returns {{kind: string, orgId: number}} The organization context.
 */
export function organizationContext(orgId) {
  return { kind: 'organization', orgId };
}

/**
 * Parse an organization id taken from a URL segment or storage.
 *
 * @description Valid only when the segment matches `^[1-9][0-9]*$` and is at most
 * {@link MAX_ORG_ID} — the backend's rule — so `007`, `1e3`, `-1`, `1.5` or an overflow are all
 * rejected.
 * @param {string} segment - The raw segment.
 * @returns {number|null} The org id, or `null` when malformed.
 */
export function parseOrgId(segment) {
  if (typeof segment !== 'string' || !ORG_ID_PATTERN.test(segment)) {
    return null;
  }

  const orgId = Number(segment);

  return orgId <= MAX_ORG_ID ? orgId : null;
}

/**
 * Check whether a context is an organization context.
 *
 * @param {object} context - The owner context.
 * @returns {boolean} True for an organization context.
 */
function isOrganization(context) {
  return context?.kind === 'organization';
}

/**
 * Prefix a path with the context's `/orgs/<id>` segment.
 *
 * @param {object} context - The owner context.
 * @param {string} path - A path starting with `/`.
 * @returns {string} The path, prefixed for an organization context.
 */
function prefixed(context, path) {
  return isOrganization(context) ? `/orgs/${context.orgId}${path}` : path;
}

/**
 * Build the API path for a context-aware resource.
 *
 * @param {object} context - The owner context.
 * @param {string} apiPath - The Personal API path, e.g. `/bank/accounts.json`.
 * @returns {string} `apiPath` for Personal, `/orgs/<id><apiPath>` for an organization.
 */
export function contextPath(context, apiPath) {
  return prefixed(context, apiPath);
}

/**
 * Build the UI hash for a context-aware page.
 *
 * @description `uiPath` `'/'` in an organization context yields `#/orgs/<id>` (no trailing slash).
 * @param {object} context - The owner context.
 * @param {string} uiPath - The Personal UI path, e.g. `/bank/accounts`.
 * @returns {string} `#<uiPath>` for Personal, `#/orgs/<id><uiPath>` for an organization.
 */
export function contextHash(context, uiPath) {
  if (isOrganization(context) && uiPath === '/') {
    return `#/orgs/${context.orgId}`;
  }

  return `#${prefixed(context, uiPath)}`;
}

/**
 * Build the landing hash of a context.
 *
 * @param {object} context - The owner context.
 * @returns {string} `#/` for Personal, `#/orgs/<id>` for an organization.
 */
export function landingFor(context) {
  return contextHash(context, '/');
}

/**
 * Compare two owner contexts.
 *
 * @param {object} a - The first context.
 * @param {object} b - The second context.
 * @returns {boolean} True when both are Personal, or both are the same organization.
 */
export function isSameContext(a, b) {
  if (a?.kind !== b?.kind) {
    return false;
  }

  return !isOrganization(a) || a.orgId === b.orgId;
}

/**
 * Normalize a raw hash into a path: drops the leading `#` and any query string.
 *
 * @param {string} hash - The raw hash value.
 * @returns {string} The path (empty for an empty hash).
 */
export function hashPath(hash) {
  return String(hash ?? '').split('?')[0].replace(/^#/, '');
}

/**
 * Split an `/orgs/<seg>` prefix off a path.
 *
 * @description `orgId` is `null` when the segment is malformed (see {@link parseOrgId}); `rest`
 * is the remaining path, `'/'` when empty.
 * @param {string} path - The path (no `#`, no query string).
 * @returns {{orgId: (number|null), rest: string}|null} The split, or `null` when the path has
 *   no `/orgs/<seg>` prefix.
 */
export function splitOrgPrefix(path) {
  const match = ORG_PREFIX_PATTERN.exec(path);

  if (!match) {
    return null;
  }

  return { orgId: parseOrgId(match[1]), rest: match[2] || '/' };
}

/**
 * Strip the `/orgs/<id>` prefix of a valid organization hash.
 *
 * @param {string} hash - The raw hash value.
 * @returns {string} The path without the prefix (`'/'` for the organization root); the plain
 *   path when there is no valid organization prefix.
 */
export function stripContextPrefix(hash) {
  const path = hashPath(hash);
  const split = splitOrgPrefix(path);

  return split?.orgId ? split.rest : path;
}
