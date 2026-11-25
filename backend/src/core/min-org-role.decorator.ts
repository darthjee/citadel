import { SetMetadata } from '@nestjs/common';
import type { OrgRole } from './org-role.js';

export const MIN_ORG_ROLE_KEY = 'minOrgRole';

/**
 * Declares the minimum organization role an owner-scoped route handler needs,
 * in the order `user` < `admin` < `owner`. `OwnerContextGuard` reads it right
 * after it resolves the owner context, so a non-member always gets the uniform
 * 404 before a too-low role gets the uniform 403. The personal context counts
 * as `owner`. Every owner-scoped write route must declare one (enforced by a
 * coverage spec); reads need none.
 * @param {OrgRole} role - The minimum role required.
 * @returns {MethodDecorator & ClassDecorator} The metadata decorator.
 */
export const MinOrgRole = (role: OrgRole): ReturnType<typeof SetMetadata> => SetMetadata(MIN_ORG_ROLE_KEY, role);
