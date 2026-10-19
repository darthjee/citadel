import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table, TableIndex } from 'typeorm';
import { createdAtColumn, idColumn } from './helpers.js';

const TABLE_NAME = 'auth_sessions';

/**
 * Drops the Auth module's `auth_sessions` table. Every token issuance inserted a
 * row there and nothing ever read it; a session is now the chain of refresh
 * tokens sharing a `session_uuid` (see `auth_refresh_tokens`). `down` recreates
 * the table **empty**, with its original shape.
 */
export class AuthDropSessions20261018120013 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(TABLE_NAME, true);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: TABLE_NAME,
        columns: [
          idColumn(),
          { name: 'user_id', type: 'int' },
          createdAtColumn(),
          { name: 'last_seen_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      TABLE_NAME,
      new TableIndex({ name: 'idx_auth_sessions_user_id', columnNames: ['user_id'] }),
    );
  }
}
