import { SetMetadata } from '@nestjs/common';

export const IS_ADMIN_ONLY_KEY = 'isAdminOnly';

/**
 * Marks a route (or an entire controller) as requiring an admin account —
 * enforced by the global `AdminGuard`, which runs after `JwtGuard` and
 * reads `request.user.isAdmin`. Combining this with `@Public()` is
 * contradictory: `@Public()` skips `JwtGuard`, so `request.user` stays
 * unset and `AdminGuard` treats that as forbidden.
 * @returns {MethodDecorator & ClassDecorator} The metadata decorator.
 */
export const AdminOnly = (): ReturnType<typeof SetMetadata> => SetMetadata(IS_ADMIN_ONLY_KEY, true);
