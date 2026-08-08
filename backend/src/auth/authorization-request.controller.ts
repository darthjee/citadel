import { Body, Controller, Param, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { respondWithSession } from './auth-response.js';
import { AuthorizationRequestService } from './authorization-request.service.js';
import { AuthorizeAuthorizationRequestDto } from './dto/authorize-authorization-request.dto.js';
import { CreateAuthorizationRequestDto } from './dto/create-authorization-request.dto.js';
import { PollAuthorizationRequestDto } from './dto/poll-authorization-request.dto.js';
import type { AccessTokenPayload } from '../core/access-token-payload.js';
import { CacheClass } from '../core/cache-class.js';
import { CachePolicy } from '../core/cache-policy.decorator.js';
import { DEFAULT_TRUSTED_PROXY_HOPS, extractClientRequestInfo } from '../core/client-request.js';
import { CurrentUser } from '../core/current-user.decorator.js';
import { Public } from '../core/public.decorator.js';

/**
 * Both halves of the login-by-authorization flow — thin, delegating all
 * business logic to `AuthorizationRequestService`. `create`/`poll` are
 * `@Public()`: they exist precisely for a not-yet-logged-in device to
 * establish credentials, so they must stay reachable without an
 * already-valid access token. `mine`/`authorize`/`deny` are the
 * approver-device routes — the first authenticated, non-admin routes in the
 * codebase — protected only by the default (non-`@Public()`) `JwtGuard`,
 * with no `@AdminOnly()`; the approver's id comes from the `@CurrentUser()`
 * accessor. `@CachePolicy(CacheClass.Never)` is applied once at the controller level so
 * Tent's proxy never caches — and cross-serves — a per-device/per-caller response.
 */
@Controller('auth')
@CachePolicy(CacheClass.Never)
export class AuthorizationRequestController {
  private readonly authorizationRequestService: AuthorizationRequestService;
  private readonly configService: ConfigService;

  /**
   * @param {AuthorizationRequestService} authorizationRequestService - The device-authorization
   *   flow's business logic.
   * @param {ConfigService} configService - Supplies the access-token TTL used for the winning
   *   poll's cookie `maxAge`, and the trusted-proxy-hop count used to resolve the requesting IP.
   */
  constructor(authorizationRequestService: AuthorizationRequestService, configService: ConfigService) {
    this.authorizationRequestService = authorizationRequestService;
    this.configService = configService;
  }

  /**
   * `POST /auth/authorization-requests.json`. Creates a new device-authorization
   * request for `dto.username`. Responds identically whether or not the
   * username matches a real user, per the enumeration-safety contract.
   * @param {CreateAuthorizationRequestDto} dto - Carries the username to request authorization for.
   * @param {Request} req - Used to capture the requesting IP and User-Agent.
   * @returns {Promise<object>} `{ uuid, pollToken, expiresAt }`.
   */
  @Public()
  @Post('authorization-requests.json')
  async create(@Body() dto: CreateAuthorizationRequestDto, @Req() req: Request): Promise<object> {
    const { ip, userAgent } = extractClientRequestInfo(req, this.#trustedProxyHops());

    return this.authorizationRequestService.create(dto.username, ip, userAgent);
  }

  /**
   * `POST /auth/authorization-requests/:uuid/poll.json`. Reports the current
   * status of a device-authorization request. On the winning `approved`
   * poll, mints a login session identical to a password login (same
   * `access_token` cookie + `{ user, refreshToken }` shape, via
   * `auth-response.ts`); every later or losing poll gets `{ status: 'logged' }`
   * with no credentials.
   * @param {string} uuid - The authorization request's UUID.
   * @param {PollAuthorizationRequestDto} dto - Carries the poll token.
   * @param {Response} res - Used to set the access-token cookie on the
   *   winning poll.
   * @returns {Promise<object>} `{ status }`, plus `user`/`refreshToken` on the winning `approved` poll.
   */
  @Public()
  @Post('authorization-requests/:uuid/poll.json')
  async poll(
    @Param('uuid') uuid: string,
    @Body() dto: PollAuthorizationRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<object> {
    const result = await this.authorizationRequestService.poll(uuid, dto.pollToken);

    if (result.status === 'approved') {
      return { status: 'approved', ...respondWithSession(result.authResult, res, this.configService) };
    }

    return { status: result.status };
  }

  /**
   * `POST /auth/authorization-requests/mine.json`. Authenticated (default
   * `JwtGuard`, no `@Public()`). Lists the caller's own `open`, non-expired
   * authorization requests, newest first.
   * @param {AccessTokenPayload} user - The caller's own authenticated user, supplying the user ID.
   * @returns {Promise<object>} `{ requests: [{ uuid, requestIp, requestUserAgent, createdAt, expiresAt }] }`.
   */
  @Post('authorization-requests/mine.json')
  async mine(@CurrentUser() user: AccessTokenPayload): Promise<object> {
    const requests = await this.authorizationRequestService.listOpenForUser(user.sub);

    return { requests };
  }

  /**
   * `POST /auth/authorization-requests/:uuid/authorize.json`. Authenticated
   * (default `JwtGuard`, no `@Public()`). Re-verifies the caller's own
   * current password before authorizing a request raised against their own
   * username. Every business rejection (missing row, wrong owner, wrong
   * status, expired, wrong password) surfaces as the same `400 Bad Request`
   * — never `401`/`403` — so `ApiClient`'s refresh-and-retry logic isn't
   * triggered by a business rejection.
   * @param {string} uuid - The authorization request's UUID.
   * @param {AuthorizeAuthorizationRequestDto} dto - Carries the approver's current password.
   * @param {AccessTokenPayload} user - The caller's own authenticated user, supplying the user ID.
   * @returns {Promise<object>} `{ authorized: true }`.
   */
  @Post('authorization-requests/:uuid/authorize.json')
  async authorize(
    @Param('uuid') uuid: string,
    @Body() dto: AuthorizeAuthorizationRequestDto,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<object> {
    await this.authorizationRequestService.authorize(uuid, user.sub, dto.password);

    return { authorized: true };
  }

  /**
   * `POST /auth/authorization-requests/:uuid/deny.json`. Authenticated
   * (default `JwtGuard`, no `@Public()`). Same ownership + `open` assertion
   * as `authorize`, but no password is required. Every business rejection
   * surfaces as the same `400 Bad Request` as `authorize`'s.
   * @param {string} uuid - The authorization request's UUID.
   * @param {AccessTokenPayload} user - The caller's own authenticated user, supplying the user ID.
   * @returns {Promise<object>} `{ denied: true }`.
   */
  @Post('authorization-requests/:uuid/deny.json')
  async deny(@Param('uuid') uuid: string, @CurrentUser() user: AccessTokenPayload): Promise<object> {
    await this.authorizationRequestService.deny(uuid, user.sub);

    return { denied: true };
  }

  #trustedProxyHops(): number {
    return Number(this.configService.get('CITADEL_PLACEHOLDER_TRUSTED_PROXY_HOPS') ?? DEFAULT_TRUSTED_PROXY_HOPS);
  }
}
