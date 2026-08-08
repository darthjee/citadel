import { Column, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Abstract base (not an entity itself — no `@Entity`) declaring the fields shared by the
 * hashed-token entities (`RefreshToken`, `PasswordResetToken`): the primary key, the unique
 * SHA-256 `tokenHash`, the owning `userId` (a logical foreign key into `auth_users`) and the
 * `expiresAt` deadline. Each subclass adds its own created-timestamp and nullable
 * revoked/used-timestamp columns.
 */
export abstract class HashedTokenBase {
  @PrimaryGeneratedColumn()
    id!: number;

  @Index({ unique: true })
  @Column({ name: 'token_hash' })
    tokenHash!: string;

  @Column({ name: 'user_id' })
    userId!: number;

  @Column({ name: 'expires_at' })
    expiresAt!: Date;
}
