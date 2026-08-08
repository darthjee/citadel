import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** The status machine driving the device-authorization poll flow. */
export type AuthorizationRequestStatus = 'open' | 'approved' | 'denied' | 'logged' | 'expired';

/**
 * A login-by-authorization request: a not-yet-logged-in device asks another,
 * already-logged-in device to vouch for a username, then polls this row
 * until it is approved (or denied / expired). Owns table
 * `auth_authorization_requests`. `userId` is a logical foreign key (no
 * physical FK, no cross-module JOIN) into `auth_users`, mirroring
 * `PasswordResetToken` — `NULL` means `username` did not resolve to a real
 * user, and such a row can never be approved.
 *
 * Only the SHA-256 hash of the poll token is persisted — the plaintext value
 * is returned once, in the `create` response, and never stored.
 */
@Entity('auth_authorization_requests')
export class AuthorizationRequest {
  @PrimaryGeneratedColumn()
    id!: number;

  @Index({ unique: true })
  @Column()
    uuid!: string;

  @Column()
    username!: string;

  @Column({ name: 'user_id', type: 'int', nullable: true })
    userId!: number | null;

  @Column({ type: 'enum', enum: ['open', 'approved', 'denied', 'logged', 'expired'], default: 'open' })
    status!: AuthorizationRequestStatus;

  @Index({ unique: true })
  @Column({ name: 'poll_token_hash' })
    pollTokenHash!: string;

  @Column({ name: 'request_ip', type: 'varchar', length: 45 })
    requestIp!: string;

  @Column({ name: 'request_user_agent', type: 'varchar', length: 512 })
    requestUserAgent!: string;

  @Column({ name: 'approved_by_user_id', type: 'int', nullable: true })
    approvedByUserId!: number | null;

  @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

  @Column({ name: 'expires_at', type: 'datetime' })
    expiresAt!: Date;

  @Column({ name: 'resolved_at', type: 'datetime', nullable: true })
    resolvedAt!: Date | null;

  @Column({ name: 'logged_at', type: 'datetime', nullable: true })
    loggedAt!: Date | null;

  @Column({ name: 'authorize_failed_attempts', type: 'int', default: 0 })
    authorizeFailedAttempts!: number;

  @Column({ name: 'authorize_locked_until', type: 'datetime', nullable: true })
    authorizeLockedUntil!: Date | null;
}
