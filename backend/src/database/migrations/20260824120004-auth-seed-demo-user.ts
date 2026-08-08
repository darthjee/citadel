import bcrypt from 'bcryptjs';
import type { MigrationInterface, QueryRunner } from 'typeorm';
import { skipInProduction } from './helpers.js';

// Dev/manual-testing convenience only — ported from the old Sequelize
// seeder (backend/seeders/20260808060903-demo-user.js). This migration
// runs as part of `yarn migration:run` (wired into `make setup`), so the
// demo login stays available out of the box: username "demo" / password
// taken from `CITADEL_PLACEHOLDER_DEMO_PASSWORD` (see `.env.dev.sample`). The fallback
// below is intentionally not a working credential — it only exists so this
// file never hardcodes the real dev password in source.
const USERNAME = 'demo';
const EMAIL = 'demo@citadel-placeholder.test';
const PASSWORD = process.env.CITADEL_PLACEHOLDER_DEMO_PASSWORD ?? 'citadel-placeholder-demo-placeholder';

/**
 * Seeds a demo user for local/manual testing. No CI/deploy step runs
 * migrations against production today, but that's an operational
 * assumption, not an enforced guarantee — `up()` is also explicitly gated
 * on `STAGE` (the same env var `docker-compose.yml` sets to `production`
 * for `citadel_placeholder_prod_app`) so this hardcoded credential can never be
 * created even if `yarn migration:run` is ever pointed at a production
 * database.
 */
export class AuthSeedDemoUser20260824120004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (skipInProduction(AuthSeedDemoUser20260824120004.name, 'seed the demo user')) return;

    const passwordDigest = await bcrypt.hash(PASSWORD, 10);

    await queryRunner.query(
      'INSERT INTO auth_users (username, email, password_digest) VALUES (?, ?, ?)',
      [USERNAME, EMAIL, passwordDigest],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM auth_users WHERE username = ?', [USERNAME]);
  }
}
