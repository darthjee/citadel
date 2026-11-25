import { MAX_ID, parseId } from './parse-id.js';

export { ownerNotFound } from './parse-id.js';

// Largest value of MySQL's signed `int` primary key.
export const MAX_ORG_ID = MAX_ID;

/**
 * Parses a raw `:orgId` route parameter strictly, through {@link parseId}:
 * only strings matching `^[1-9][0-9]*$` with a value up to
 * {@link MAX_ORG_ID} are accepted; anything else answers the uniform 404.
 * @param {unknown} raw - The raw route parameter.
 * @returns {number} The organization id.
 */
export function parseOrgId(raw: unknown): number {
  return parseId(raw);
}
