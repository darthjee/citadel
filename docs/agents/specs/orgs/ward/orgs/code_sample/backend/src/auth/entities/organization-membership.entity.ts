import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { OrgRole } from '../../core/org-role.js';

/**
 * A member's role in an organization — an alias of `core`'s {@link OrgRole}.
 * Roles are enforced (see `@MinOrgRole` and `hasMinRole`) in the order
 * `user` < `admin` < `owner`, and are distinct from Ward's global `User.isAdmin`.
 * The organization's creator is its `owner`.
 */
export const MembershipRole = OrgRole;
export type MembershipRole = OrgRole;

/**
 * A user's membership of an organization, with their role in it. Owns table
 * `auth_organization_memberships`; `organization_id` and `user_id` are real FKs
 * (to `auth_organizations` and `auth_users`, both owned by `auth`), declared in
 * the migration. At most one membership per `(organization, user)`.
 */
@Entity('auth_organization_memberships')
@Index('idx_auth_organization_memberships_organization_id_user_id', ['organizationId', 'userId'], { unique: true })
export class OrganizationMembership {
  @PrimaryGeneratedColumn()
    id!: number;

  @Column({ name: 'organization_id', type: 'int' })
    organizationId!: number;

  @Index('idx_auth_organization_memberships_user_id')
  @Column({ name: 'user_id', type: 'int' })
    userId!: number;

  @Column({ type: 'varchar', length: 16 })
    role!: MembershipRole;

  @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
