import 'express';
import type { AccessTokenPayload } from '../core/access-token-payload.js';

declare module 'express' {
  interface Request {
    user?: AccessTokenPayload;
  }
}
