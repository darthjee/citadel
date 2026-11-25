import type { Request } from 'express';
import { parseOrgId } from '../core/parse-org-id.js';

const ORGANIZATIONS_LIST_PATH = '/orgs.json';

/**
 * Paths invalidated by `POST /orgs.json`: only the caller-facing organization list.
 * Never `/orgs`, whose recursive clear would wipe every organization's tree.
 * @returns {string[]} `['/orgs.json']`.
 */
export function organizationCreateInvalidation(): string[] {
  return [ORGANIZATIONS_LIST_PATH];
}

/**
 * Paths invalidated by `PATCH /orgs/:orgId.json`: the organization list and the
 * renamed organization's own document. `:orgId` is parsed strictly, as
 * `OwnerContextGuard` does; when parsing fails (a request that can't reach a
 * 2xx anyway) only the list is returned. Never `/orgs`.
 * @param {Request} request - The rename request, carrying the raw `:orgId`.
 * @returns {string[]} `['/orgs.json', '/orgs/<orgId>.json']`, or `['/orgs.json']`.
 */
export function organizationRenameInvalidation(request: Request): string[] {
  try {
    const orgId = parseOrgId(request.params?.orgId);

    return [ORGANIZATIONS_LIST_PATH, `/orgs/${orgId}.json`];
  } catch {
    return [ORGANIZATIONS_LIST_PATH];
  }
}
