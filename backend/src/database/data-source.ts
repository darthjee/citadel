import 'dotenv/config';
import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';

/**
 * TypeORM data source config, read once from env vars at process start —
 * no hidden env reads elsewhere (see docs/agents/architecture/backend.md).
 * Mirrors the env var names used by the old Sequelize `config/database.js`,
 * so no `.env`/`.env.dev.sample` changes are needed.
 *
 * This file is consumed two ways:
 * - By the TypeORM CLI, standalone (outside Nest's DI container), via:
 *   `yarn migration:run` / `yarn migration:revert`, i.e.
 *   `typeorm-ts-node-esm migration:run -d src/database/data-source.ts`.
 * - Indirectly by `AppModule`'s `TypeOrmModule.forRootAsync`, which builds
 *   its own options through `ConfigService` (DI-friendly, independently
 *   testable) rather than importing this module directly — see
 *   `src/app.module.ts`.
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'mysql',
  host: process.env.CITADEL_PLACEHOLDER_MYSQL_HOST,
  port: Number(process.env.CITADEL_PLACEHOLDER_MYSQL_PORT ?? 3306),
  username: process.env.CITADEL_PLACEHOLDER_MYSQL_USER,
  password: process.env.CITADEL_PLACEHOLDER_MYSQL_PASSWORD,
  database: process.env.CITADEL_PLACEHOLDER_MYSQL_NAME,
  poolSize: 5,
  entities: ['dist/**/*.entity.js'],
  // Only timestamp-prefixed files are migrations; `helpers.ts` (shared, non-migration exports) must not be loaded.
  migrations: ['dist/database/migrations/[0-9]*.js'],
};

const AppDataSource = new DataSource(dataSourceOptions);

export default AppDataSource;
