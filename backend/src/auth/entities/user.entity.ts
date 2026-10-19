import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * An account's approval status. Only `APPROVED` users are authenticated (the
 * session-lookup gate requires it on every request); `PENDING` users await an
 * admin decision and `DENIED` users look like unknown ones everywhere except a
 * login with the correct password.
 */
export const UserStatus = {
  /** Self-registered while approval is required; blocked by the gate until approved. */
  PENDING: 'pending',
  /** The only status the gate lets through. */
  APPROVED: 'approved',
  /** Refused by an admin; treated as unknown except on a correct-password login. */
  DENIED: 'denied',
} as const;
export type UserStatus = typeof UserStatus[keyof typeof UserStatus];

/**
 * A Citadel Placeholder account. Login identity is a username/password pair (see
 * docs/agents/product.md).
 * Owns table `auth_users` (per the Auth module's table prefix — see
 * docs/agents/architecture/backend.md).
 */
@Entity('auth_users')
export class User {
  @PrimaryGeneratedColumn()
    id!: number;

  @Column({ unique: true })
    username!: string;

  @Column({ unique: true })
    email!: string;

  @Column({ name: 'password_digest' })
    passwordDigest!: string;

  @Column({ name: 'is_admin', default: false })
    isAdmin!: boolean;

  // No default: every write path must set the status explicitly (see the migration).
  @Column({ type: 'varchar', length: 16 })
    status!: UserStatus;

  @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
