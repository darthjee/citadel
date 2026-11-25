import { SECTIONS_CONTEXT } from './routes.js';
import { contextHash, landingFor, stripContextPrefix } from '../context/ownerContext.js';

/**
 * Check whether a path sits under a prefix, on a segment boundary.
 *
 * @param {string} path - The context-relative path.
 * @param {string} prefix - The section prefix.
 * @returns {boolean} True when `path` equals `prefix` or continues it with a `/`.
 */
function underPrefix(path, prefix) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * Find the section list path a hash belongs to.
 *
 * @description The `#`, the query string and any valid `/orgs/<id>` prefix are stripped, then
 * the remaining path is matched by prefix, on a segment boundary, against the registry.
 * @param {string} hash - The raw hash value.
 * @param {Array<Array<string>>} [sections] - The `[prefix, list path]` registry.
 * @returns {string|null} The section's list path, or `null` when no section matches.
 */
export function sectionListPathFor(hash, sections = SECTIONS_CONTEXT) {
  const path = stripContextPrefix(hash).replace(/(.)\/$/, '$1');
  const match = sections.find(([prefix]) => underPrefix(path, prefix));

  return match ? match[1] : null;
}

/**
 * Build the switch-target function for the current hash.
 *
 * @description Used by the context switcher both for the click and for the item `href`: a hash
 * inside a registered section lands on that section's list in the picked context; anything else
 * lands on the picked context's landing page. The query string is always dropped.
 * @param {string} hash - The current raw hash value.
 * @param {Array<Array<string>>} [sections] - The `[prefix, list path]` registry.
 * @returns {Function} `(context) => hash` building the target hash for a picked context.
 */
export function switchTargetFor(hash, sections = SECTIONS_CONTEXT) {
  const listPath = sectionListPathFor(hash, sections);

  return (context) => (listPath ? contextHash(context, listPath) : landingFor(context));
}
