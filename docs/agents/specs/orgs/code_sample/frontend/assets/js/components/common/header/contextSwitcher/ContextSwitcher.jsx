import { useMemo } from 'react';
import ContextSwitcherHelper from './helpers/ContextSwitcherHelper.jsx';
import ContextSwitcherController from './controllers/ContextSwitcherController.js';
import useOwnerContext from '../../ownerContext/hooks/useOwnerContext.js';
import { switchTargetFor } from '../../../../utils/routing/sectionTarget.js';

/**
 * Read the current hash, SSR-safe.
 *
 * @returns {string} `window.location.hash`, or `''` outside the browser.
 */
function currentHash() {
  return typeof window === 'undefined' ? '' : window.location.hash;
}

/**
 * Header dropdown switching between Personal and the user's organizations. Hidden while logged
 * out or pending approval.
 *
 * @description A switch made from a registered section (e.g. a bank accounts page) lands on that
 * section's list in the picked context; anywhere else it lands on the picked context's landing.
 * The item `href` uses the same target as the click.
 * @param {object} props - Component props.
 * @param {boolean} props.loggedIn - Whether a session is active.
 * @param {boolean} [props.pending] - Whether the session awaits admin approval.
 * @returns {React.ReactElement|null} The switcher, or `null` while logged out or pending.
 */
export default function ContextSwitcher({ loggedIn, pending = false }) {
  const {
    context, userId, orgs, orgsError,
  } = useOwnerContext();
  const controller = useMemo(() => new ContextSwitcherController(), []);

  if (!loggedIn || pending) {
    return null;
  }

  const switchTarget = switchTargetFor(currentHash());
  const onPick = (picked) => controller.pick(picked, userId, switchTarget);

  return ContextSwitcherHelper.render({ context, orgs, orgsError }, { onPick, switchTarget });
}
