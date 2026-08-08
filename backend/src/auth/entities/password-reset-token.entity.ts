import { Column, CreateDateColumn, Entity } from 'typeorm';
import { HashedTokenBase } from './hashed-token.base.js';

/**
 * A single-use, time-limited password recovery token, minted by
 * `POST /auth/recover.json` and consumed by `POST /auth/reset-password.json`.
 * Owns table `auth_password_reset_tokens`. `userId` is a logical foreign key
 * (no physical FK, no cross-module JOIN) into `auth_users`, per the module's
 * database strategy — mirroring `RefreshToken`.
 *
 * Only the SHA-256 hash of the token is persisted — the plaintext value is
 * embedded once in the recovery-email link (via
 * `PasswordRecoveryRequestedEvent`) and never stored. `usedAt` is set the
 * moment the token is consumed by a successful reset, so it can never be
 * replayed.
 */
@Entity('auth_password_reset_tokens')
export class PasswordResetToken extends HashedTokenBase {
  @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

  @Column({ name: 'used_at', type: 'datetime', nullable: true })
    usedAt!: Date | null;
}
