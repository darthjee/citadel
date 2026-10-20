import type { DataSource } from 'typeorm';

/** A column as reported by `INFORMATION_SCHEMA.COLUMNS`. */
export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
}

/**
 * Lists the tables currently in the test database.
 *
 * @param ds - an initialized test data source.
 * @returns the table names, sorted.
 */
export async function tableNames(ds: DataSource): Promise<string[]> {
  const rows: Array<{ name: string }> = await ds.query(
    'SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME',
  );
  return rows.map(({ name }) => name);
}

/**
 * Reads one column's definition straight from MySQL (not from the migration code).
 *
 * @param ds - an initialized test data source.
 * @param table - the table name.
 * @param column - the column name.
 * @returns the column info, or `undefined` when the column doesn't exist.
 */
export async function columnInfo(ds: DataSource, table: string, column: string): Promise<ColumnInfo | undefined> {
  const rows: Array<{ type: string; nullable: string; dflt: string | null }> = await ds.query(
    `SELECT COLUMN_TYPE AS type, IS_NULLABLE AS nullable, COLUMN_DEFAULT AS dflt
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  if (rows.length === 0) return undefined;

  const [{ type, nullable, dflt }] = rows;
  return { name: column, type, nullable: nullable === 'YES', default: dflt };
}

/**
 * Lists the index names on a table (including `PRIMARY`).
 *
 * @param ds - an initialized test data source.
 * @param table - the table name.
 * @returns the distinct index names, sorted.
 */
export async function indexNames(ds: DataSource, table: string): Promise<string[]> {
  const rows: Array<{ name: string }> = await ds.query(
    `SELECT DISTINCT INDEX_NAME AS name FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY INDEX_NAME`,
    [table],
  );
  return rows.map(({ name }) => name);
}

/**
 * Inserts a bare user row (columns that exist from the first migration on) and returns its id.
 *
 * @param ds - an initialized test data source.
 * @param username - unique username; the email is derived from it.
 * @returns the inserted user's id.
 */
export async function insertUser(ds: DataSource, username: string): Promise<number> {
  const result: { insertId: number } = await ds.query(
    'INSERT INTO auth_users (username, email, password_digest) VALUES (?, ?, ?)',
    [username, `${username}@example.test`, 'digest'],
  );
  return result.insertId;
}
