import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Reads a boolean route-metadata flag by `key`, checking the handler before falling back to the
 * controller class — shared by the always-resident `AdminGuard` and `JwtGuard`, so
 * each just names the decorator key it cares about instead of
 * duplicating the `Reflector` lookup and `Boolean()` coercion.
 * @param {Reflector} reflector - Reads the route (or controller) metadata.
 * @param {string} key - The metadata key set by the corresponding decorator (e.g. `IS_PUBLIC_KEY`).
 * @param {ExecutionContext} context - The current request's execution context.
 * @returns {boolean} Whether the flag is set on the handler or its controller class.
 */
export function readBooleanMetadata(
  reflector: Reflector,
  key: string,
  context: ExecutionContext,
): boolean {
  return Boolean(reflector.getAllAndOverride<boolean>(key, [context.getHandler(), context.getClass()]));
}
