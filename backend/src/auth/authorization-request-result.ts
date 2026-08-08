import type { AuthorizationRequestStatus } from './entities/authorization-request.entity.js';
import type { AuthResult } from './token.service.js';

/** The result of `AuthorizationRequestService#create()`. */
export interface CreatedAuthorizationRequest {
  uuid: string;
  pollToken: string;
  expiresAt: Date;
}

/**
 * An `open`, non-expired authorization request owned by the caller, as
 * returned by `AuthorizationRequestService#listOpenForUser()`.
 */
export interface OpenAuthorizationRequest {
  uuid: string;
  requestIp: string;
  requestUserAgent: string;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * The result of `AuthorizationRequestService#poll()`: every non-`approved`
 * status carries no credentials; `approved` (the winning poll only) carries
 * the freshly issued session.
 */
export type PollResult =
  | { status: Exclude<AuthorizationRequestStatus, 'approved'> }
  | { status: 'approved'; authResult: AuthResult };
