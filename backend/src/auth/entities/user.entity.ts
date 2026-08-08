import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

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

  @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
