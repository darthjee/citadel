/** Organization role values, as returned by the backend. */
export const ROLES = Object.freeze({
  USER: 'user',
  ADMIN: 'admin',
  OWNER: 'owner',
});

/** Actions gated by the caller's organization role. */
export const ACTIONS = Object.freeze({
  WRITE: 'write',
  UNDO_PAYMENT: 'undo_payment',
  EDIT_PAYMENT_TRANSACTION: 'edit_payment_transaction',
  MANAGE_ACCOUNTS: 'manage_accounts',
  RENAME_ORGANIZATION: 'rename_organization',
  DELETE: 'delete',
});

const ROLE_RANK = new Map([
  [ROLES.USER, 1],
  [ROLES.ADMIN, 2],
  [ROLES.OWNER, 3],
]);

const MIN_ROLE = new Map([
  [ACTIONS.WRITE, ROLES.USER],
  [ACTIONS.UNDO_PAYMENT, ROLES.ADMIN],
  [ACTIONS.EDIT_PAYMENT_TRANSACTION, ROLES.ADMIN],
  [ACTIONS.MANAGE_ACCOUNTS, ROLES.ADMIN],
  [ACTIONS.RENAME_ORGANIZATION, ROLES.ADMIN],
  [ACTIONS.DELETE, ROLES.ADMIN],
]);

/**
 * Tells whether a role may perform an action.
 *
 * @description Mirrors the backend `@MinOrgRole` matrix: `WRITE` needs `user`, every other
 * action needs `admin`. An unknown or `null` role (not yet loaded) and an unknown action both
 * return `false`.
 * @param {string|null|undefined} role - The caller's organization role.
 * @param {string} action - One of {@link ACTIONS}.
 * @returns {boolean} `true` when the role ranks at or above the action's minimum role.
 */
export function can(role, action) {
  const rank = ROLE_RANK.get(role);
  const minRole = MIN_ROLE.get(action);

  if (rank === undefined || minRole === undefined) {
    return false;
  }

  return rank >= ROLE_RANK.get(minRole);
}
