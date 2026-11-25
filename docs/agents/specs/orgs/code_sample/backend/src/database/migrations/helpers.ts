import type { TableColumnOptions } from 'typeorm';

/**
 * Guards a migration's `up()` against running against a production database.
 * Migrations run via the TypeORM CLI, outside the Nest DI lifecycle, so this
 * relies on `process.env.STAGE` directly and logs via raw `console` (no
 * `LoggerService` available) instead of the DI-injected patterns used
 * elsewhere in the app.
 *
 * @param migrationName - the migration class name, used in the warning message.
 * @param action - a short description of the skipped action, used in the warning message.
 * @returns whether the migration should skip its `up()` logic (true when `STAGE=production`).
 */
export function skipInProduction(migrationName: string, action: string): boolean {
  if (process.env.STAGE !== 'production') return false;

  // Raw console: migrations run via the TypeORM CLI, outside the Nest DI lifecycle — no LoggerService available.
  // eslint-disable-next-line no-console
  console.warn(`Skipping ${migrationName}: STAGE=production, refusing to ${action}.`);
  return true;
}

/**
 * Column definition for the auto-incrementing integer primary key shared by every
 * auth table (`id`).
 *
 * @returns {TableColumnOptions} the `id` column options for a `createTable` call.
 */
export function idColumn(): TableColumnOptions {
  return {
    name: 'id',
    type: 'int',
    isPrimary: true,
    isGenerated: true,
    generationStrategy: 'increment',
  };
}

/**
 * Column definition for a creation timestamp defaulting to the current time.
 *
 * @param {string} [name] - the column name; defaults to `created_at` (e.g. `issued_at` for refresh tokens).
 * @returns {TableColumnOptions} the datetime column options for a `createTable` call.
 */
export function createdAtColumn(name = 'created_at'): TableColumnOptions {
  return { name, type: 'datetime', default: 'CURRENT_TIMESTAMP' };
}

/**
 * Column definition for the `updated_at` timestamp, defaulting to and refreshed on update with
 * the current time.
 *
 * @returns {TableColumnOptions} the `updated_at` column options for a `createTable` call.
 */
export function updatedAtColumn(): TableColumnOptions {
  return {
    name: 'updated_at',
    type: 'datetime',
    default: 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  };
}
