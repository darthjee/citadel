import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthService, type ReadinessResult } from './health.service.js';
import { CacheClass } from '../core/cache-class.js';
import { CachePolicy } from '../core/cache-policy.decorator.js';
import { Public } from '../core/public.decorator.js';

/**
 * Liveness and readiness probes. `GET /health.json` is the liveness probe:
 * it proves the process is up and reachable through the proxy without
 * touching any dependency. `GET /ready.json` is the readiness probe: it
 * delegates to {@link HealthService} and answers `503` when a dependency
 * (currently only the database) is down. Both are public — the
 * proxy/orchestrator must be able to hit them without an access token.
 * `@CachePolicy(CacheClass.Never)`: a probe must always reach the backend,
 * never be answered from Tent's cache.
 */
@Controller()
@CachePolicy(CacheClass.Never)
export class HealthController {
  private readonly healthService: HealthService;

  /**
   * @param {HealthService} healthService - Runs the readiness checks.
   */
  constructor(healthService: HealthService) {
    this.healthService = healthService;
  }

  /**
   * Liveness probe.
   * @returns {{ status: string }} Always `{ status: 'ok' }`.
   */
  @Public()
  @Get('health.json')
  @HttpCode(200)
  check(): { status: string } {
    return { status: 'ok' };
  }

  /**
   * Readiness probe. Sets the status on the response instead of throwing so
   * the body keeps the probe contract rather than the global error shape.
   * @param {Response} res - Used to set `503` when not ready.
   * @returns {Promise<ReadinessResult>} The aggregated readiness result.
   */
  @Public()
  @Get('ready.json')
  async ready(@Res({ passthrough: true }) res: Response): Promise<ReadinessResult> {
    const result = await this.healthService.checkReadiness();
    res.status(result.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }
}
