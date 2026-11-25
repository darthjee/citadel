import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * An organization: a group of users sharing user-or-organization-owned data
 * (see `docs/agents/modules/auth/organizations.md`). Ownership lives only in the
 * membership role — there is no owner column here. Owns table
 * `auth_organizations`. The name is user input: trimmed, at most 255
 * characters, **not unique**, and never logged.
 */
@Entity('auth_organizations')
export class Organization {
  @PrimaryGeneratedColumn()
    id!: number;

  @Column({ type: 'varchar', length: 255 })
    name!: string;

  @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
