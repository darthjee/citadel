import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table, TableForeignKey, TableIndex } from 'typeorm';
import { createdAtColumn, idColumn, updatedAtColumn } from './helpers.js';

const ORGANIZATIONS = 'auth_organizations';
const MEMBERSHIPS = 'auth_organization_memberships';

/**
 * Creates the Auth module's `auth_organizations` and
 * `auth_organization_memberships` tables (see
 * `docs/agents/modules/auth/organizations.md`). Unlike the module's other
 * user references, `organization_id` and `user_id` are **real** FKs: all three
 * tables are owned by `auth`. The indexes and FKs are declared inside the
 * `CREATE TABLE`, so MySQL backs each FK with the declared index — the unique
 * `(organization_id, user_id)` key (one membership per pair, also the
 * membership-check lookup) and the `user_id` index ("list my organizations") —
 * instead of adding implicit ones.
 */
export class AuthCreateOrganizations20261107120015 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: ORGANIZATIONS,
        columns: [
          idColumn(),
          { name: 'name', type: 'varchar', length: '255' },
          createdAtColumn(),
          updatedAtColumn(),
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: MEMBERSHIPS,
        columns: [
          idColumn(),
          { name: 'organization_id', type: 'int' },
          { name: 'user_id', type: 'int' },
          { name: 'role', type: 'varchar', length: '16' },
          createdAtColumn(),
          updatedAtColumn(),
        ],
        indices: [
          new TableIndex({
            name: 'idx_auth_organization_memberships_organization_id_user_id',
            columnNames: ['organization_id', 'user_id'],
            isUnique: true,
          }),
          new TableIndex({ name: 'idx_auth_organization_memberships_user_id', columnNames: ['user_id'] }),
        ],
        foreignKeys: [
          new TableForeignKey({
            name: 'fk_auth_organization_memberships_organization_id',
            columnNames: ['organization_id'],
            referencedTableName: ORGANIZATIONS,
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          }),
          new TableForeignKey({
            name: 'fk_auth_organization_memberships_user_id',
            columnNames: ['user_id'],
            referencedTableName: 'auth_users',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          }),
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(MEMBERSHIPS, true, true, true);
    await queryRunner.dropTable(ORGANIZATIONS, true);
  }
}
