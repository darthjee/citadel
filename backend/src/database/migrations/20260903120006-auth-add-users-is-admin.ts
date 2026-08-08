import type { MigrationInterface, QueryRunner } from 'typeorm';
import { TableColumn } from 'typeorm';

const TABLE_NAME = 'auth_users';

/**
 * Adds the `is_admin` flag to `auth_users`, backing the admin role concept
 * (JWT claim + `@AdminOnly()` guard, see docs/agents/architecture/backend.md).
 * Defaults to `false` so every existing/new account starts as a non-admin.
 */
export class AuthAddUsersIsAdmin20260903120006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      TABLE_NAME,
      new TableColumn({ name: 'is_admin', type: 'boolean', default: false, isNullable: false }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn(TABLE_NAME, 'is_admin');
  }
}
