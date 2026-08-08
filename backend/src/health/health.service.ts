import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LoggerService } from '../core/logger.service.js';

/** State of one readiness dependency check. */
export type CheckState = 'up' | 'down';

/** Per-dependency readiness checks, keyed by dependency name. */
export interface ReadinessChecks {
  database: CheckState;
}

/**
 * Outcome of {@link HealthService.checkReadiness}: `status` is `'ok'` only
 * when every entry of `checks` is `'up'`. Never carries error details —
 * failures are logged instead.
 */
export interface ReadinessResult {
  status: 'ok' | 'error';
  checks: ReadinessChecks;
}

/**
 * Readiness logic behind `GET /ready.json`, kept out of `HealthController`
 * so the controller stays thin. Only the database is checked; SMTP is
 * deliberately not (a readiness probe must not flap on third-party
 * outages).
 */
@Injectable()
export class HealthService {
  private readonly dataSource: DataSource;
  private readonly logger: LoggerService;

  /**
   * @param {DataSource} dataSource - The TypeORM connection to probe.
   * @param {LoggerService} logger - The injected Core logger, used to record
   *   check failures without exposing them to the caller.
   */
  constructor(dataSource: DataSource, logger: LoggerService) {
    this.dataSource = dataSource;
    this.logger = logger;
  }

  /**
   * Runs every readiness check and aggregates the overall status.
   * @returns {Promise<ReadinessResult>} `{ status: 'ok' }` when every check
   *   is up, `{ status: 'error' }` otherwise, alongside the per-check map.
   */
  async checkReadiness(): Promise<ReadinessResult> {
    const checks: ReadinessChecks = {
      database: await this.#checkDatabase(),
    };
    const allUp = Object.values(checks).every((state) => state === 'up');

    return { status: allUp ? 'ok' : 'error', checks };
  }

  async #checkDatabase(): Promise<CheckState> {
    try {
      await this.dataSource.query('SELECT 1');
      return 'up';
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error('readiness check failed', {
        context: 'HealthService',
        check: 'database',
        reason,
      });
      return 'down';
    }
  }
}
