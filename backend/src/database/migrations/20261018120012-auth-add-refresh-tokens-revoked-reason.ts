import type { MigrationInterface, QueryRunner } from 'typeorm';
import { TableColumn } from 'typeorm';

const TABLE_NAME = 'auth_refresh_tokens';

/**
 * Adds `revoked_reason` to `auth_refresh_tokens`, written together with
 * `revoked_at` on every revocation so that replay detection can fire only for
 * `rotated` tokens. Existing revoked rows are backfilled with `rotated`: old
 * rows cannot tell rotation from logout, so they keep the replay detection
 * they had. Unrevoked rows stay `NULL`.
 */
export class AuthAddRefreshTokensRevokedReason20261018120012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      TABLE_NAME,
      new TableColumn({ name: 'revoked_reason', type: 'varchar', length: '32', isNullable: true }),
    );

    await queryRunner.query(
      `UPDATE ${TABLE_NAME} SET revoked_reason = 'rotated' WHERE revoked_at IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn(TABLE_NAME, 'revoked_reason');
  }
}
