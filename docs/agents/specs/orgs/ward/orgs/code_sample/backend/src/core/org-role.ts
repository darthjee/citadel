import { ForbiddenException } from '@nestjs/common';

/**
 * A member's role in an organization, ordered `user` < `admin` < `owner`.
 * Defined in `core` (which must not import `auth`) and reused by `auth`'s
 * `MembershipRole`. Enforced on owner-scoped routes through `@MinOrgRole`
 * and {@link hasMinRole}; the personal context counts as `owner`.
 */
export const OrgRole = {
  /** A regular member: may read and do everyday writes. */
  USER: 'user',
  /** May also do destructive and structural writes. */
  ADMIN: 'admin',
  /** The organization's owner — its creator. */
  OWNER: 'owner',
} as const;
export type OrgRole = (typeof OrgRole)[keyof typeof OrgRole];

const RANK: Readonly<Record<OrgRole, number>> = {
  user: 0,
  admin: 1,
  owner: 2,
};

/**
 * Tells whether a role is at least the required minimum, in the order
 * `user` < `admin` < `owner`.
 * @param {OrgRole} role - The caller's role.
 * @param {OrgRole} min - The minimum role required.
 * @returns {boolean} `true` when `role` ranks at or above `min`.
 */
export function hasMinRole(role: OrgRole, min: OrgRole): boolean {
  return RANK[role] >= RANK[min];
}

/**
 * Builds the uniform organization-role 403, thrown by the owner-context
 * guard, the payment-generated transaction rule and the organization rename.
 * It names neither the resource nor the required role; the global filter
 * renders it as `{ error: { code: 'FORBIDDEN', message: 'Forbidden' },
 * statusCode: 403, timestamp }`.
 * @returns {ForbiddenException} The uniform forbidden exception.
 */
export function orgRoleForbidden(): ForbiddenException {
  return new ForbiddenException();
}
