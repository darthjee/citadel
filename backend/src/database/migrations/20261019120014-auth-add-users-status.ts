import type { MigrationInterface, QueryRunner } from 'typeorm';
import { TableColumn } from 'typeorm';

const TABLE_NAME = 'auth_users';

/**
 * Adds the account `status` (`pending`, `approved`, `denied`) to `auth_users`.
 * The column is added nullable, every existing row (including the demo seed
 * users, whose migrations run earlier) is backfilled to `approved` so existing
 * accounts stay usable, then it is made `NOT NULL`.
 *
 * There is deliberately **no column default**: a new account's status is
 * decided by `UserApprovalConfig` at registration, and a default would let a
 * forgotten write silently pick one. Runs in every environment.
 */
export class AuthAddUsersStatus20261019120014 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      TABLE_NAME,
      new TableColumn({ name: 'status', type: 'varchar', length: '16', isNullable: true }),
    );

    await queryRunner.query(`UPDATE ${TABLE_NAME} SET status = 'approved'`);

    await queryRunner.changeColumn(
      TABLE_NAME,
      'status',
      new TableColumn({ name: 'status', type: 'varchar', length: '16', isNullable: false }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn(TABLE_NAME, 'status');
  }
}
