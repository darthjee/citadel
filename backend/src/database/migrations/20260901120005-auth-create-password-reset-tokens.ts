import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table, TableIndex } from 'typeorm';
import { createdAtColumn, idColumn } from './helpers.js';

const TABLE_NAME = 'auth_password_reset_tokens';

/**
 * Creates the Auth module's `auth_password_reset_tokens` table. `user_id` is
 * a logical foreign key into `auth_users` — no physical FK, per the module's
 * database strategy (see docs/agents/architecture/backend.md).
 */
export class AuthCreatePasswordResetTokens20260901120005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: TABLE_NAME,
        columns: [
          idColumn(),
          { name: 'token_hash', type: 'varchar', isUnique: true },
          { name: 'user_id', type: 'int' },
          createdAtColumn(),
          { name: 'expires_at', type: 'datetime' },
          { name: 'used_at', type: 'datetime', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      TABLE_NAME,
      new TableIndex({ name: 'idx_auth_password_reset_tokens_user_id', columnNames: ['user_id'] }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(TABLE_NAME);
  }
}
