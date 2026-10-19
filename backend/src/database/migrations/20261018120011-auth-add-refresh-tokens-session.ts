import type { MigrationInterface, QueryRunner } from 'typeorm';
import { TableColumn, TableIndex } from 'typeorm';

const TABLE_NAME = 'auth_refresh_tokens';
const INDEX_NAME = 'idx_auth_refresh_tokens_session_uuid';

/**
 * Adds the session identity to `auth_refresh_tokens`: `session_uuid` is shared by
 * every token of one chain of rotated refresh tokens (a session), and `started_at`
 * records when that chain's login happened. Both columns are added nullable,
 * backfilled so that each existing row becomes its own session
 * (`session_uuid = UUID()`, `started_at = issued_at`), then made `NOT NULL`.
 * The index is non-unique: a rotated chain leaves several rows per session.
 */
export class AuthAddRefreshTokensSession20261018120011 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns(TABLE_NAME, [
      new TableColumn({ name: 'session_uuid', type: 'varchar', length: '36', isNullable: true }),
      new TableColumn({ name: 'started_at', type: 'datetime', isNullable: true }),
    ]);

    await queryRunner.query(
      `UPDATE ${TABLE_NAME} SET session_uuid = UUID(), started_at = issued_at`,
    );

    await queryRunner.changeColumn(
      TABLE_NAME,
      'session_uuid',
      new TableColumn({ name: 'session_uuid', type: 'varchar', length: '36', isNullable: false }),
    );
    await queryRunner.changeColumn(
      TABLE_NAME,
      'started_at',
      new TableColumn({ name: 'started_at', type: 'datetime', isNullable: false }),
    );

    await queryRunner.createIndex(
      TABLE_NAME,
      new TableIndex({ name: INDEX_NAME, columnNames: ['session_uuid'] }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(TABLE_NAME, INDEX_NAME);
    await queryRunner.dropColumn(TABLE_NAME, 'started_at');
    await queryRunner.dropColumn(TABLE_NAME, 'session_uuid');
  }
}
