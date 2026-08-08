import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Tracks a logged-in user's active session, independent of the JWT access
 * token itself, so `DELETE /auth/logoff.json` has a server-side record to
 * invalidate. Owns table `auth_sessions`. `userId` is a logical foreign key
 * (no physical FK, no cross-module JOIN) into `auth_users`.
 */
@Entity('auth_sessions')
export class Session {
  @PrimaryGeneratedColumn()
    id!: number;

  @Column({ name: 'user_id' })
    userId!: number;

  @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

  @Column({ name: 'last_seen_at' })
    lastSeenAt!: Date;
}
