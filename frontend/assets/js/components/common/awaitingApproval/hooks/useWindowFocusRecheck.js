import { useEffect } from 'react';

/**
 * Build the window-focus effect: subscribes to the `window` `focus` event and calls `recheck`
 * every time the window regains focus. Returns a cleanup function that unsubscribes. Never
 * schedules a timer — `status.json` is not cached and hits the database, so it is only checked
 * on a real user signal. Extracted as a plain function, separate from the `useEffect` call
 * itself, so it can be exercised directly in tests without a React renderer — mirroring
 * {@link module:components/common/header/hooks/useAuthEffect}'s `buildAuthEffect()`.
 *
 * @param {Function} recheck - Called on every window focus.
 * @returns {Function} Effect callback, returning a cleanup function.
 */
export function buildWindowFocusEffect(recheck) {
  return () => {
    const handleFocus = () => recheck();

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  };
}

/**
 * Re-run `recheck` whenever the window regains focus. See {@link buildWindowFocusEffect}.
 *
 * @param {Function} recheck - Called on every window focus; keep it stable (e.g. `useCallback`)
 *   to avoid re-subscribing on every render.
 * @returns {void} Nothing.
 */
export default function useWindowFocusRecheck(recheck) {
  useEffect(() => buildWindowFocusEffect(recheck)(), [recheck]);
}
