import { Column, CreateDateColumn, Entity, Index } from 'typeorm';
import { HashedTokenBase } from './hashed-token.base.js';

/**
 * Why a refresh token was revoked, written together with `revokedAt` on every
 * revocation. Only `ROTATED` triggers replay detection when the token is presented
 * again; any other reason answers a plain `401`.
 */
export const RevokedReason = {
  /** Written by `AuthService#refresh` on the presented token when it is rotated. */
  ROTATED: 'rotated',
  /** Written by `AuthService#logout` on every active token of the presented token's session. */
  LOGOUT: 'logout',
  /** Written by `AuthService#resetPassword` on every active token of the user. */
  PASSWORD_RESET: 'password_reset',
  /** Written by replay detection in `AuthService#refresh` on every active token of the user. */
  REPLAY_DETECTED: 'replay_detected',
} as const;
export type RevokedReason = typeof RevokedReason[keyof typeof RevokedReason];

/**
 * A rotating refresh token issued on login/register/refresh/device poll. Owns
 * table `auth_refresh_tokens`. `userId` is a logical foreign key (no physical
 * FK, no cross-module JOIN) into `auth_users`, per the module's database
 * strategy.
 *
 * Only the SHA-256 hash of the token is persisted — the plaintext value is
 * returned to the client once, in the response body, and never stored.
 *
 * A **session** is one chain of rotated refresh tokens: every token of the
 * chain shares the same `sessionUuid` and `startedAt` (when the chain's login
 * happened). Login, register and a winning device poll start a new session;
 * refresh copies the session onto the replacement token. Rotation is atomic,
 * so a session has at most one active (unrevoked, unexpired) row at a time.
 *
 * `revokedAt` and `revokedReason` are set together on every revocation. Only a
 * `rotated` token presented again triggers replay detection, so a
 * stolen/replayed token revokes the user's active tokens instead of being
 * silently accepted.
 */
@Entity('auth_refresh_tokens')
export class RefreshToken extends HashedTokenBase {
  @CreateDateColumn({ name: 'issued_at' })
    issuedAt!: Date;

  @Column({ name: 'revoked_at', type: 'datetime', nullable: true })
    revokedAt!: Date | null;

  @Column({ name: 'revoked_reason', type: 'varchar', length: 32, nullable: true })
    revokedReason!: RevokedReason | null;

  @Index('idx_auth_refresh_tokens_session_uuid')
  @Column({ name: 'session_uuid', length: 36 })
    sessionUuid!: string;

  @Column({ name: 'started_at', type: 'datetime' })
    startedAt!: Date;
}
