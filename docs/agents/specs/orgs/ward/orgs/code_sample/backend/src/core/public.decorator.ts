import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route (or an entire controller) as exempt from the global
 * `JwtGuard` — used by routes that must stay reachable without an access
 * token, e.g. `/health.json`, `/ready.json`, `/auth/login.json`, `/auth/register.json`.
 * @returns {MethodDecorator & ClassDecorator} The metadata decorator.
 */
export const Public = (): ReturnType<typeof SetMetadata> => SetMetadata(IS_PUBLIC_KEY, true);
