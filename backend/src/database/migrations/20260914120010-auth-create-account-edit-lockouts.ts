import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table, TableIndex } from 'typeorm';
import { createdAtColumn, idColumn, updatedAtColumn } from './helpers.js';

const TABLE_NAME = 'auth_account_edit_lockouts';

/**
 * Creates the Auth module's `auth_account_edit_lockouts` table, tracking the brute-force
 * cool-off lockout for `PATCH /auth/account.json` (see `AccountEditAbuseGuardService`).
 * `user_id` is a logical foreign key into `auth_users` — no physical FK, per the module's
 * database strategy (see docs/agents/architecture/backend.md) — and unique, since there is at
 * most one row per user, upserted in place rather than appended.
 */
export class AuthCreateAccountEditLockouts20260914120010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: TABLE_NAME,
        columns: [
          idColumn(),
          { name: 'user_id', type: 'int' },
          { name: 'failed_attempts', type: 'int', default: 0 },
          { name: 'locked_until', type: 'datetime', isNullable: true },
          createdAtColumn(),
          updatedAtColumn(),
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      TABLE_NAME,
      new TableIndex({ name: 'idx_auth_account_edit_lockouts_user_id', columnNames: ['user_id'], isUnique: true }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(TABLE_NAME);
  }
}
