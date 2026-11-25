import 'express';
import type { AccessTokenPayload } from '../core/access-token-payload.js';
import type { OwnerContext } from '../core/owner-context.js';

declare module 'express' {
  interface Request {
    user?: AccessTokenPayload;
    ownerContext?: OwnerContext;
  }
}
