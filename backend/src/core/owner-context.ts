import { FindOperator, IsNull } from 'typeorm';
import { OrgRole } from './org-role.js';

/**
 * The owner of some data: a user (personal data) or an organization. It
 * identifies only the data owner — no caller, no role — so code that derives
 * an owner from a record (rather than from the request) uses it. The
 * scoping helpers ({@link ownerWhere}, {@link ownerSqlWhere}) take it.
 */
export type OwnerScope =
  | { kind: 'user'; userId: number }
  | { kind: 'organization'; organizationId: number };

/**
 * The owner of a user-or-organization-owned request, resolved per request by
 * `OwnerContextGuard`: the JWT user on personal routes, or the organization
 * from `:orgId` (after the membership check) on organization routes, with the
 * caller's role taken from the DB membership only. The personal variant
 * counts as `owner`. It is structurally assignable to {@link OwnerScope}.
 */
export type OwnerContext =
  | { kind: 'user'; userId: number }
  | { kind: 'organization'; organizationId: number; role: OrgRole };

/**
 * The caller's effective role in an {@link OwnerContext}.
 * @param {OwnerContext} ctx - The resolved owner context.
 * @returns {OrgRole} `owner` for the personal context, or the membership role
 *   for an organization context.
 */
export function ownerRole(ctx: OwnerContext): OrgRole {
  return ctx.kind === 'user' ? OrgRole.OWNER : ctx.role;
}

/**
 * TypeORM `where` fragment selecting the records owned by an {@link OwnerScope}.
 */
export type OwnerWhere =
  | { userId: number; organizationId: FindOperator<unknown> }
  | { userId: FindOperator<unknown>; organizationId: number };

/**
 * Builds the owner filter every user-or-organization-owned query goes through.
 * Both columns are always constrained, so a personal query can never return
 * organization records and vice versa.
 * @param {OwnerScope} ctx - The data owner scope.
 * @returns {OwnerWhere} `{ userId, organizationId: IsNull() }` for a user owner, or
 *   `{ userId: IsNull(), organizationId }` for an organization owner.
 */
export function ownerWhere(ctx: OwnerScope): OwnerWhere {
  if (ctx.kind === 'user') {
    return { userId: ctx.userId, organizationId: IsNull() };
  }

  return { userId: IsNull(), organizationId: ctx.organizationId };
}

/**
 * A parameterised raw-SQL `WHERE` fragment and its bound values.
 */
export interface OwnerSqlWhere {
  sql: string;
  params: number[];
}

const SQL_ALIAS = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Raw-SQL counterpart of {@link ownerWhere}, for queries that cannot go through
 * TypeORM's `where` (e.g. hand-written `query()` SQL). Both owner columns are
 * always constrained and the owner id is bound as a parameter, never inlined.
 * @param {OwnerScope} ctx - The data owner scope.
 * @param {string} alias - The table alias owning the `user_id`/`organization_id`
 *   columns; must be a plain SQL identifier.
 * @returns {OwnerSqlWhere} `<alias>.user_id = ? AND <alias>.organization_id IS NULL`
 *   for a user owner, or the reverse for an organization owner, with its params.
 * @throws {Error} When `alias` is not a plain SQL identifier.
 */
export function ownerSqlWhere(ctx: OwnerScope, alias: string): OwnerSqlWhere {
  if (!SQL_ALIAS.test(alias)) {
    throw new Error(`Invalid SQL alias: ${JSON.stringify(alias)}`);
  }

  if (ctx.kind === 'user') {
    return { sql: `${alias}.user_id = ? AND ${alias}.organization_id IS NULL`, params: [ctx.userId] };
  }

  return { sql: `${alias}.user_id IS NULL AND ${alias}.organization_id = ?`, params: [ctx.organizationId] };
}
