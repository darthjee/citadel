/**
 * Parse the query part of a raw hash.
 *
 * @param {string} hash - The raw hash value, e.g. `#/bank/accounts/12?page=3`.
 * @returns {URLSearchParams} The params after the first `?` (empty when there is none).
 */
export function hashQuery(hash) {
  const raw = String(hash ?? '');
  const index = raw.indexOf('?');

  return new URLSearchParams(index === -1 ? '' : raw.slice(index + 1));
}

/**
 * Build a path with a query string, omitting empty values.
 *
 * @param {string} path - The path (or hash) without query.
 * @param {object} params - Plain `{ name: value }` map; `null`, `undefined` and `''` are omitted.
 * @returns {string} `path` alone when no value remains, otherwise `path?query`.
 */
export function withHashQuery(path, params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([name, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      query.set(name, String(value));
    }
  });

  const text = query.toString();

  return text ? `${path}?${text}` : path;
}
