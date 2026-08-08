import type { MigrationInterface, QueryRunner, TableColumnOptions } from 'typeorm';
import { Table, TableIndex } from 'typeorm';
import { createdAtColumn, idColumn } from './helpers.js';

const TABLE_NAME = 'auth_authorization_requests';
const STATUS_ENUM = ['open', 'approved', 'denied', 'logged', 'expired'];

const COLUMNS: TableColumnOptions[] = [
  idColumn(),
  { name: 'uuid', type: 'varchar', length: '36', isUnique: true },
  { name: 'username', type: 'varchar' },
  { name: 'user_id', type: 'int', isNullable: true },
  { name: 'status', type: 'enum', enum: STATUS_ENUM, default: "'open'" },
  { name: 'poll_token_hash', type: 'varchar', isUnique: true },
  { name: 'request_ip', type: 'varchar', length: '45' },
  { name: 'request_user_agent', type: 'varchar', length: '512' },
  { name: 'approved_by_user_id', type: 'int', isNullable: true },
  createdAtColumn(),
  { name: 'expires_at', type: 'datetime' },
  { name: 'resolved_at', type: 'datetime', isNullable: true },
  { name: 'logged_at', type: 'datetime', isNullable: true },
];

/**
 * Creates the four indexes used by the `auth_authorization_requests` table
 * (uuid lookup, poll-token lookup, user/status lookup and expiry sweeps).
 *
 * @param {QueryRunner} queryRunner - the TypeORM query runner executing the migration.
 * @returns {Promise<void>} resolves once all indexes have been created.
 */
async function createIndexes(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.createIndex(
    TABLE_NAME,
    new TableIndex({ name: 'idx_auth_authorization_requests_uuid', columnNames: ['uuid'], isUnique: true }),
  );
  await queryRunner.createIndex(
    TABLE_NAME,
    new TableIndex({
      name: 'idx_auth_authorization_requests_poll_token_hash',
      columnNames: ['poll_token_hash'],
      isUnique: true,
    }),
  );
  await queryRunner.createIndex(
    TABLE_NAME,
    new TableIndex({
      name: 'idx_auth_authorization_requests_user_id_status',
      columnNames: ['user_id', 'status'],
    }),
  );
  await queryRunner.createIndex(
    TABLE_NAME,
    new TableIndex({ name: 'idx_auth_authorization_requests_expires_at', columnNames: ['expires_at'] }),
  );
}

/**
 * Creates the Auth module's `auth_authorization_requests` table. `user_id`
 * is a logical foreign key into `auth_users` — no physical FK, per the
 * module's database strategy (see docs/agents/architecture/backend.md).
 */
export class AuthCreateAuthorizationRequests20260903120008 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({ name: TABLE_NAME, columns: COLUMNS }), true);

    await createIndexes(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(TABLE_NAME);
  }
}
