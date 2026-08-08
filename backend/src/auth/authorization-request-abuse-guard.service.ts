import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { computeLockoutState } from '../core/lockout-state.js';
import { getNumberConfig } from '../core/numeric-config.js';
import { AuthorizationRequest } from './entities/authorization-request.entity.js';

// Default per-IP/per-username `create` rate limit (request count) used when
// `CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_CREATE_LIMIT` is unset.
const DEFAULT_AUTHORIZATION_REQUEST_CREATE_LIMIT = 5;

// Default `create` rate-limit sliding window (1 minute, in milliseconds) used when
// `CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_CREATE_WINDOW_MS` is unset.
const DEFAULT_AUTHORIZATION_REQUEST_CREATE_WINDOW_MS = 60000;

// Default cap on a resolved user's simultaneous `open` requests used when
// `CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_MAX_OPEN_PER_USER` is unset.
const DEFAULT_AUTHORIZATION_REQUEST_MAX_OPEN_PER_USER = 5;

// Default consecutive-wrong-password threshold, per request row, that trips the `authorize`
// cool-off, used when `CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_AUTHORIZE_MAX_ATTEMPTS` is unset.
const DEFAULT_AUTHORIZATION_REQUEST_AUTHORIZE_MAX_ATTEMPTS = 5;

// Default `authorize` cool-off duration (5 minutes, in milliseconds) used when
// `CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_AUTHORIZE_LOCK_MS` is unset.
const DEFAULT_AUTHORIZATION_REQUEST_AUTHORIZE_LOCK_MS = 300000;

/**
 * Rate-limiting and abuse-hardening logic for the device-authorization flow — per-IP/per-username
 * `create` throttling, a concurrent-`open`-requests-per-user cap, and the `authorize` cool-off
 * lockout — split out of `AuthorizationRequestService` to keep that service focused on the core
 * state machine (per this file's 300-line budget, see `docs/agents/contributing.md`). Not exported
 * from `AuthModule` — an internal collaborator only, like `TokenService`. Depends only on injected
 * repositories/services — never reads env vars or global state directly (per
 * `docs/agents/contributing.md`'s DI rule).
 */
@Injectable()
export class AuthorizationRequestAbuseGuardService {
  private readonly authorizationRequestRepository: Repository<AuthorizationRequest>;
  private readonly configService: ConfigService;

  /**
   * @param {Repository<AuthorizationRequest>} authorizationRequestRepository - The
   *   authorization-request repository.
   * @param {ConfigService} configService - Supplies every rate-limit/cap/cool-off config key.
   */
  constructor(
    @InjectRepository(AuthorizationRequest) authorizationRequestRepository: Repository<AuthorizationRequest>,
      configService: ConfigService,
  ) {
    this.authorizationRequestRepository = authorizationRequestRepository;
    this.configService = configService;
  }

  /**
   * Counts recent `create` rows matching the requesting IP and, separately, the target username
   * within the sliding window, always computing both counts (never short-circuiting) so an
   * attacker cannot fix one variable and binary-search the other to learn which limit tripped.
   * @param {string} ip - The requesting device's IP address.
   * @param {string} username - The target username.
   * @returns {Promise<boolean>} Whether either count is at/over the configured limit.
   */
  async isOverCreateLimit(ip: string, username: string): Promise<boolean> {
    const windowStart = new Date(Date.now() - this.#createWindowMs());
    const limit = this.#createLimit();
    const [ipCount, usernameCount] = await Promise.all([
      this.authorizationRequestRepository.count({ where: { requestIp: ip, createdAt: MoreThan(windowStart) } }),
      this.authorizationRequestRepository.count({ where: { username, createdAt: MoreThan(windowStart) } }),
    ]);

    return ipCount >= limit || usernameCount >= limit;
  }

  /**
   * Evicts the resolved user's oldest `open` request (flips it to `expired`) when they are
   * already at/over the configured concurrent-open cap, making room for the row `create` is about
   * to insert. Never rejects — a legitimate retry always succeeds.
   * @param {number} userId - The resolved target user's ID.
   * @returns {Promise<void>} Resolves once any needed eviction is applied.
   */
  async enforceOpenCapFor(userId: number): Promise<void> {
    const openCount = await this.authorizationRequestRepository.count({ where: { userId, status: 'open' } });

    if (openCount < this.#maxOpenPerUser()) {
      return;
    }

    const oldest = await this.authorizationRequestRepository.findOne({
      where: { userId, status: 'open' },
      order: { createdAt: 'ASC' },
    });

    if (oldest) {
      await this.authorizationRequestRepository.update(oldest.id, { status: 'expired', resolvedAt: new Date() });
    }
  }

  /**
   * Reports whether `request` is currently within its `authorize` cool-off lockout window.
   * @param {AuthorizationRequest} request - The authorization request row being attempted against.
   * @returns {boolean} Whether `authorizeLockedUntil` is set and still in the future.
   */
  isLockedOut(request: AuthorizationRequest): boolean {
    return request.authorizeLockedUntil !== null && request.authorizeLockedUntil > new Date();
  }

  /**
   * Records one more consecutive wrong-password `authorize` attempt against `request`, locking it
   * (setting `authorizeLockedUntil`) once the configured max-attempts threshold is reached.
   * @param {AuthorizationRequest} request - The authorization request row being attempted against.
   * @returns {Promise<void>} Resolves once the row's attempt counter (and lock, if tripped) is persisted.
   */
  async registerAuthorizeFailure(request: AuthorizationRequest): Promise<void> {
    const { attempts, lockedUntil } = computeLockoutState(
      request.authorizeFailedAttempts,
      this.#authorizeMaxAttempts(),
      this.#authorizeLockMs(),
    );

    await this.authorizationRequestRepository.update(request.id, {
      authorizeFailedAttempts: attempts,
      authorizeLockedUntil: lockedUntil,
    });
  }

  #createLimit(): number {
    return getNumberConfig(
      this.configService,
      'CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_CREATE_LIMIT',
      DEFAULT_AUTHORIZATION_REQUEST_CREATE_LIMIT,
    );
  }

  #createWindowMs(): number {
    return getNumberConfig(
      this.configService,
      'CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_CREATE_WINDOW_MS',
      DEFAULT_AUTHORIZATION_REQUEST_CREATE_WINDOW_MS,
    );
  }

  #maxOpenPerUser(): number {
    return getNumberConfig(
      this.configService,
      'CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_MAX_OPEN_PER_USER',
      DEFAULT_AUTHORIZATION_REQUEST_MAX_OPEN_PER_USER,
    );
  }

  #authorizeMaxAttempts(): number {
    return getNumberConfig(
      this.configService,
      'CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_AUTHORIZE_MAX_ATTEMPTS',
      DEFAULT_AUTHORIZATION_REQUEST_AUTHORIZE_MAX_ATTEMPTS,
    );
  }

  #authorizeLockMs(): number {
    return getNumberConfig(
      this.configService,
      'CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_AUTHORIZE_LOCK_MS',
      DEFAULT_AUTHORIZATION_REQUEST_AUTHORIZE_LOCK_MS,
    );
  }
}
