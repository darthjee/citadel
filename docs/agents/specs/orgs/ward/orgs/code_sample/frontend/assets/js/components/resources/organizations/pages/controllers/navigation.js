/**
 * Navigate to a hash, SSR-safe.
 *
 * @param {string} hash - The hash to navigate to.
 * @returns {void} Nothing.
 */
export default function navigate(hash) {
  if (typeof window !== 'undefined') {
    window.location.hash = hash;
  }
}
