import type { MigrationInterface, QueryRunner } from 'typeorm';
import { TableColumn } from 'typeorm';

const TABLE_NAME = 'auth_authorization_requests';

/**
 * Adds the `authorize` cool-off columns to `auth_authorization_requests`:
 * `authorize_failed_attempts` counts consecutive wrong-password `authorize`
 * attempts against a given row, and `authorize_locked_until` — set once the
 * configured max-attempts threshold is reached — makes that row reject
 * `authorize` outright until it elapses, mitigating brute-force guessing of
 * the approver's password (see `AuthorizationRequestService#authorize`).
 */
export class AuthAddAuthorizeLockoutColumns20260909120009 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      TABLE_NAME,
      new TableColumn({ name: 'authorize_failed_attempts', type: 'int', default: 0, isNullable: false }),
    );
    await queryRunner.addColumn(
      TABLE_NAME,
      new TableColumn({ name: 'authorize_locked_until', type: 'datetime', isNullable: true }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn(TABLE_NAME, 'authorize_locked_until');
    await queryRunner.dropColumn(TABLE_NAME, 'authorize_failed_attempts');
  }
}
