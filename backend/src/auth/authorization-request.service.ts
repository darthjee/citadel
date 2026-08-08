import { randomBytes, randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { AuthorizationRequestAbuseGuardService } from './authorization-request-abuse-guard.service.js';
import type {
  CreatedAuthorizationRequest,
  OpenAuthorizationRequest,
  PollResult,
} from './authorization-request-result.js';
import { compareOrDummy } from './dummy-digest.js';
import { AuthorizationRequest } from './entities/authorization-request.entity.js';
import { User } from './entities/user.entity.js';
import { AuthorizationRequestApprovedEvent } from './events/authorization-request-approved.event.js';
import { AuthorizationRequestCreatedEvent } from './events/authorization-request-created.event.js';
import { AuthorizationRequestDeniedEvent } from './events/authorization-request-denied.event.js';
import { AuthorizationRequestLoggedEvent } from './events/authorization-request-logged.event.js';
import { TokenService } from './token.service.js';
import { hashToken } from '../core/token-hash.js';

// Default authorization-request lifetime (1 hour, ms), used when `CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_TTL_MS` is unset.
const DEFAULT_AUTHORIZATION_REQUEST_TTL_MS = 3600000;

// Uniform failure message shared by every `authorize`/`deny` rejection branch, so a business
// rejection never leaks which specific check failed.
const AUTHORIZE_FAILURE_MESSAGE = 'Unable to authorize this request';
const DENY_FAILURE_MESSAGE = 'Unable to deny this request';

/**
 * The login-by-authorization flow's business logic, both device sides: the requesting device's
 * `create`/`poll`, and the approver device's `listOpenForUser`/`authorize`/`deny`. Not exported
 * from `AuthModule` — an internal collaborator only, like `PasswordResetService`. Rate-limiting and
 * abuse-hardening (per-IP/per-username `create` throttling, the concurrent-open cap, the
 * `authorize` cool-off lockout) is delegated to `AuthorizationRequestAbuseGuardService`. Depends
 * only on injected repositories/services — never reads env vars or global state directly.
 */
@Injectable()
export class AuthorizationRequestService {
  private readonly authorizationRequestRepository: Repository<AuthorizationRequest>;
  private readonly userRepository: Repository<User>;
  private readonly tokenService: TokenService;
  private readonly eventEmitter: EventEmitter2;
  private readonly configService: ConfigService;
  private readonly abuseGuard: AuthorizationRequestAbuseGuardService;

  /**
   * @param {Repository<AuthorizationRequest>} authorizationRequestRepository - The authorization-request repository.
   * @param {Repository<User>} userRepository - The Auth module's user repository.
   * @param {TokenService} tokenService - Mints the session on a successful poll claim.
   * @param {EventEmitter2} eventEmitter - Fires the `authorization-request.created`/`.logged` events.
   * @param {ConfigService} configService - Supplies the authorization-request TTL.
   * @param {AuthorizationRequestAbuseGuardService} abuseGuard - Rate-limit/cap/cool-off checks for `create`/`authorize`.
   */
  constructor(
    @InjectRepository(AuthorizationRequest) authorizationRequestRepository: Repository<AuthorizationRequest>,
    @InjectRepository(User) userRepository: Repository<User>,
      tokenService: TokenService,
      eventEmitter: EventEmitter2,
      configService: ConfigService,
      abuseGuard: AuthorizationRequestAbuseGuardService,
  ) {
    this.authorizationRequestRepository = authorizationRequestRepository;
    this.userRepository = userRepository;
    this.tokenService = tokenService;
    this.eventEmitter = eventEmitter;
    this.configService = configService;
    this.abuseGuard = abuseGuard;
  }

  /**
   * Creates an `open` authorization request for `username`. Never branches its return shape (or
   * timing) on whether `username` resolves to a real user — a non-matching username stores
   * `userId: null` and such a row can never be approved. When over the `create` rate limit, a
   * throwaway response with the same shape is returned — no row is persisted, no event fires. When
   * `username` resolves to a user already at/over the concurrent-`open` cap, the oldest one is
   * transparently evicted (set to `expired`) first — `create` never rejects because of the cap.
   * @param {string} username - The username the requesting device asks another device to vouch for.
   * @param {string} ip - The requesting device's IP address.
   * @param {string} userAgent - The requesting device's User-Agent string.
   * @returns {Promise<CreatedAuthorizationRequest>} The new request's UUID, plaintext poll token
   *   (only its hash is persisted), and expiry.
   */
  async create(username: string, ip: string, userAgent: string): Promise<CreatedAuthorizationRequest> {
    const user = await this.userRepository.findOneBy({ username });
    const overLimit = await this.abuseGuard.isOverCreateLimit(ip, username);
    const pollToken = randomBytes(48).toString('hex');
    const uuid = randomUUID();
    const expiresAt = new Date(Date.now() + this.#ttlMs());

    if (overLimit) {
      return { uuid, pollToken, expiresAt };
    }

    if (user) {
      await this.abuseGuard.enforceOpenCapFor(user.id);
    }

    await this.authorizationRequestRepository.save(
      this.authorizationRequestRepository.create({
        uuid,
        username,
        userId: user?.id ?? null,
        status: 'open',
        pollTokenHash: hashToken(pollToken),
        requestIp: ip,
        requestUserAgent: userAgent,
        approvedByUserId: null,
        expiresAt,
        resolvedAt: null,
        loggedAt: null,
        authorizeFailedAttempts: 0,
        authorizeLockedUntil: null,
      }),
    );

    this.eventEmitter.emit('authorization-request.created', new AuthorizationRequestCreatedEvent(uuid, username, user?.id ?? null));

    return { uuid, pollToken, expiresAt };
  }

  /**
   * Polls an authorization request's status. Unknown `uuid` and wrong `pollToken` are
   * indistinguishable — both throw `NotFoundException`. An `open` request past its `expiresAt` is
   * lazily flipped to `expired`. An `approved` request is claimed atomically: only the first poll
   * to win the guarded `UPDATE` mints a session; every other poll gets `{ status: 'logged' }`.
   * @param {string} uuid - The authorization request's UUID.
   * @param {string} pollToken - The plaintext poll token issued by `create()`.
   * @returns {Promise<PollResult>} The current status, with a freshly issued
   *   session attached only for the winning `approved` poll.
   * @throws {NotFoundException} When `uuid` is unknown or `pollToken` is wrong.
   */
  async poll(uuid: string, pollToken: string): Promise<PollResult> {
    const request = await this.authorizationRequestRepository.findOneBy({
      uuid,
      pollTokenHash: hashToken(pollToken),
    });

    if (!request) {
      throw new NotFoundException('Authorization request not found');
    }

    if (request.status === 'open' && request.expiresAt < new Date()) {
      return this.#expire(request);
    }

    if (request.status === 'approved') {
      return this.#claim(request);
    }

    return { status: request.status };
  }

  /**
   * Lists the caller's own `open`, non-expired authorization requests, newest first. Rows with
   * `userId: null` or belonging to a different user are excluded by the `WHERE` clause itself.
   * @param {number} userId - The approver's own user ID (`request.user.sub`).
   * @returns {Promise<OpenAuthorizationRequest[]>} The caller's open, non-expired requests.
   */
  async listOpenForUser(userId: number): Promise<OpenAuthorizationRequest[]> {
    const requests = await this.authorizationRequestRepository.find({
      where: { userId, status: 'open', expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    });

    return requests.map((request) => ({
      uuid: request.uuid,
      requestIp: request.requestIp,
      requestUserAgent: request.requestUserAgent,
      createdAt: request.createdAt,
      expiresAt: request.expiresAt,
    }));
  }

  /**
   * Authorizes an open request raised against the caller's own username, re-verifying the
   * approver's current password. Every failure branch — missing row, wrong owner, wrong status,
   * expired, wrong password, or locked-out — throws the same `BadRequestException`. A per-row
   * cool-off tracks consecutive wrong-password attempts, locking the row for a configured
   * duration once the threshold is reached. A locked-out attempt still runs the password compare
   * (against `compareOrDummy`'s dummy digest if needed), so it is not measurably faster than a
   * normal attempt.
   * @param {string} uuid - The authorization request's UUID.
   * @param {number} approverUserId - The approver's own user ID (`request.user.sub`).
   * @param {string} password - The approver's current plaintext password.
   * @returns {Promise<void>} Resolves once the request is marked `approved`.
   * @throws {BadRequestException} On any ownership, status, expiry, password, or lock-out failure.
   */
  async authorize(uuid: string, approverUserId: number, password: string): Promise<void> {
    const request = await this.#loadOwnedOpenRequest(uuid, approverUserId, AUTHORIZE_FAILURE_MESSAGE);

    if (request.expiresAt < new Date()) {
      throw new BadRequestException(AUTHORIZE_FAILURE_MESSAGE);
    }

    const lockedOut = this.abuseGuard.isLockedOut(request);
    const passwordValid = await this.#approverPasswordValid(approverUserId, password);

    if (lockedOut || !passwordValid) {
      if (!lockedOut) {
        await this.abuseGuard.registerAuthorizeFailure(request);
      }

      throw new BadRequestException(AUTHORIZE_FAILURE_MESSAGE);
    }

    await this.authorizationRequestRepository.update(request.id, {
      status: 'approved',
      approvedByUserId: approverUserId,
      resolvedAt: new Date(),
      authorizeFailedAttempts: 0,
      authorizeLockedUntil: null,
    });

    this.eventEmitter.emit('authorization-request.approved', new AuthorizationRequestApprovedEvent(uuid, approverUserId));
  }

  /**
   * Denies an open authorization request raised against the caller's own username. No password
   * is required (lower-stakes than `authorize`). Every failure branch — missing row, wrong owner,
   * wrong status — throws the same `BadRequestException`. No expiry check is performed (unlike
   * `authorize`).
   * @param {string} uuid - The authorization request's UUID.
   * @param {number} approverUserId - The approver's own user ID (`request.user.sub`).
   * @returns {Promise<void>} Resolves once the request is marked `denied`.
   * @throws {BadRequestException} On any ownership or status failure.
   */
  async deny(uuid: string, approverUserId: number): Promise<void> {
    const request = await this.#loadOwnedOpenRequest(uuid, approverUserId, DENY_FAILURE_MESSAGE);

    await this.authorizationRequestRepository.update(request.id, { status: 'denied', resolvedAt: new Date() });

    this.eventEmitter.emit('authorization-request.denied', new AuthorizationRequestDeniedEvent(uuid, approverUserId));
  }

  async #expire(request: AuthorizationRequest): Promise<PollResult> {
    await this.authorizationRequestRepository.update(request.id, { status: 'expired', resolvedAt: new Date() });

    return { status: 'expired' };
  }

  async #claim(request: AuthorizationRequest): Promise<PollResult> {
    const result = await this.authorizationRequestRepository
      .createQueryBuilder()
      .update()
      .set({ status: 'logged', loggedAt: () => 'CURRENT_TIMESTAMP' })
      .where('uuid = :uuid AND status = :status', { uuid: request.uuid, status: 'approved' })
      .execute();

    if (result.affected !== 1) {
      return { status: 'logged' };
    }

    return this.#issueSessionFor(request);
  }

  async #issueSessionFor(request: AuthorizationRequest): Promise<PollResult> {
    const user = request.userId === null ? null : await this.userRepository.findOneBy({ id: request.userId });

    if (!user) {
      return { status: 'logged' };
    }

    const authResult = await this.tokenService.issueTokens(user);

    this.eventEmitter.emit('authorization-request.logged', new AuthorizationRequestLoggedEvent(request.uuid, user.id));

    return { status: 'approved', authResult };
  }

  #ttlMs(): number {
    return Number(
      this.configService.get('CITADEL_PLACEHOLDER_AUTHORIZATION_REQUEST_TTL_MS') ?? DEFAULT_AUTHORIZATION_REQUEST_TTL_MS,
    );
  }

  async #loadOwnedOpenRequest(uuid: string, approverUserId: number, failureMessage: string): Promise<AuthorizationRequest> {
    const request = await this.authorizationRequestRepository.findOneBy({ uuid });

    if (!request || request.userId !== approverUserId || request.status !== 'open') {
      throw new BadRequestException(failureMessage);
    }

    return request;
  }

  async #approverPasswordValid(approverUserId: number, password: string): Promise<boolean> {
    const approver = await this.userRepository.findOneBy({ id: approverUserId });

    return compareOrDummy(password, approver?.passwordDigest);
  }
}
