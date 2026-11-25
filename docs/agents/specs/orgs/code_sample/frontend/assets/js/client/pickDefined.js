/**
 * Returns a new object containing only the entries of `object` whose value is not `undefined`.
 * Unlike a truthiness filter, `null`, `''`, `0` and `false` are kept — only `undefined` means
 * "not provided".
 *
 * @description Used by the HTTP clients to build request bodies where each optional field is
 *   only sent when the caller actually supplied it.
 * @param {object} object - The source object whose entries should be filtered.
 * @returns {object} A new object with every `undefined`-valued key removed.
 */
export default function pickDefined(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined),
  );
}
