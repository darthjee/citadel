import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table } from 'typeorm';
import { createdAtColumn, idColumn, updatedAtColumn } from './helpers.js';

const TABLE_NAME = 'auth_users';

/**
 * Creates the Auth module's `auth_users` table — the TypeORM equivalent of
 * the old Sequelize `users` table (see `backend/models/User.js`), moved
 * under the module's `auth_` table prefix.
 */
export class AuthCreateUsers20260824120001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: TABLE_NAME,
        columns: [
          idColumn(),
          { name: 'username', type: 'varchar', isUnique: true },
          { name: 'email', type: 'varchar', isUnique: true },
          { name: 'password_digest', type: 'varchar' },
          createdAtColumn(),
          updatedAtColumn(),
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(TABLE_NAME);
  }
}
