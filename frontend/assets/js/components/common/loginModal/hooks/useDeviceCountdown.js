import { useEffect } from 'react';

/**
 * Build the device-countdown effect: while the modal is showing the `device:waiting` panel,
 * run a 1-second `setInterval` that bumps the `now` timestamp so the `mm:ss` countdown
 * re-renders; any other result panel (or none) leaves no interval running. Extracted as a
 * plain function, separate from the `useEffect` call itself, so it can be exercised directly in
 * tests without a React renderer — mirroring
 * {@link module:components/common/loginModal/hooks/useLoginModal}'s `buildLoginModalEffect`.
 *
 * @param {(string|null)} resultPanel - The modal's current result panel value.
 * @param {Function} setNow - React state setter for the countdown's reference timestamp.
 * @returns {Function} Effect callback, returning a cleanup function, or `undefined` when the
 *   waiting panel is not shown.
 */
export function buildDeviceCountdownEffect(resultPanel, setNow) {
  return () => {
    if (resultPanel !== 'device:waiting') {
      return undefined;
    }

    const intervalId = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(intervalId);
  };
}

/**
 * Keep the `device:waiting` panel's `mm:ss` countdown live by bumping a `now` timestamp once a
 * second while that panel is shown. See {@link buildDeviceCountdownEffect} for the effect's
 * behavior.
 *
 * @param {(string|null)} resultPanel - The modal's current result panel value.
 * @param {Function} setNow - React state setter for the countdown's reference timestamp.
 * @returns {void} Nothing.
 */
export default function useDeviceCountdown(resultPanel, setNow) {
  useEffect(
    () => buildDeviceCountdownEffect(resultPanel, setNow)(),
    [resultPanel, setNow],
  );
}
