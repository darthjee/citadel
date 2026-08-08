import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * The brute-force cool-off lockout state for `PATCH /auth/account.json`, one row per user (see
 * `AccountEditAbuseGuardService`). Owns table `auth_account_edit_lockouts`. `userId` is a
 * logical foreign key (no physical FK, no cross-module JOIN) into `auth_users`, mirroring
 * `PasswordResetToken`/`AuthorizationRequest`, and unique — the row is upserted in place rather
 * than appended.
 */
@Entity('auth_account_edit_lockouts')
export class AccountEditLockout {
  @PrimaryGeneratedColumn()
    id!: number;

  @Index({ unique: true })
  @Column({ name: 'user_id', type: 'int' })
    userId!: number;

  @Column({ name: 'failed_attempts', type: 'int', default: 0 })
    failedAttempts!: number;

  @Column({ name: 'locked_until', type: 'datetime', nullable: true })
    lockedUntil!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
