import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshToken, RevokedReason } from './entities/refresh-token.entity.js';
import { User, UserStatus } from './entities/user.entity.js';
import { TokenService } from './token.service.js';

/**
 * The `status.json` answer. `status` is present **only** for a pending user;
 * every other answer carries just `loggedIn`/`isAdmin`.
 */
export interface AuthStatus {
  loggedIn: boolean;
  isAdmin: boolean;
  status?: typeof UserStatus.PENDING;
}

/**
 * Answers `status.json`: whether a refresh token currently identifies an
 * active session, and of which kind. Split out of `AuthService` (which
 * delegates to it) to keep the status rules in one place. Deliberately never
 * runs replay detection nor rotates anything: a passive status check from a
 * second tab must never log every tab out after the first tab's legitimate
 * refresh. The only write is revoking a **denied** user's presented token
 * with `admin_denied`, so a denied user looks exactly like a logged-out one.
 */
@Injectable()
export class SessionStatusService {
  private readonly userRepository: Repository<User>;
  private readonly refreshTokenRepository: Repository<RefreshToken>;
  private readonly tokenService: TokenService;

  /**
   * @param {Repository<User>} userRepository - The Auth module's user repository.
   * @param {Repository<RefreshToken>} refreshTokenRepository - The refresh-token repository.
   * @param {TokenService} tokenService - Hashes the presented token and revokes a denied user's token.
   */
  constructor(
    @InjectRepository(User) userRepository: Repository<User>,
    @InjectRepository(RefreshToken) refreshTokenRepository: Repository<RefreshToken>,
      tokenService: TokenService,
  ) {
    this.userRepository = userRepository;
    this.refreshTokenRepository = refreshTokenRepository;
    this.tokenService = tokenService;
  }

  /**
   * Reports the session state of a refresh token. Unknown, expired or revoked
   * token, missing user, or **denied** user → the anonymous answer
   * `{ loggedIn: false, isAdmin: false }` (byte-for-byte identical; a denied
   * user's token is also revoked with `admin_denied`). Pending user →
   * `{ loggedIn: false, isAdmin: false, status: 'pending' }`, the session is
   * kept so an approval is picked up on the next check. Approved user →
   * `{ loggedIn: true, isAdmin }`.
   * @param {string} refreshToken - The refresh token presented by the client.
   * @returns {Promise<AuthStatus>} The status answer.
   */
  async status(refreshToken: string): Promise<AuthStatus> {
    const tokenRow = await this.#findActiveTokenRow(refreshToken);

    if (!tokenRow) {
      return anonymous();
    }

    const user = await this.userRepository.findOneBy({ id: tokenRow.userId });

    return user ? this.#statusFor(user, tokenRow) : anonymous();
  }

  async #statusFor(user: User, tokenRow: RefreshToken): Promise<AuthStatus> {
    if (user.status === UserStatus.APPROVED) {
      return { loggedIn: true, isAdmin: user.isAdmin };
    }

    if (user.status === UserStatus.PENDING) {
      return { loggedIn: false, isAdmin: false, status: UserStatus.PENDING };
    }

    await this.tokenService.revokeToken(tokenRow.id, RevokedReason.ADMIN_DENIED);

    return anonymous();
  }

  async #findActiveTokenRow(refreshToken: string): Promise<RefreshToken | null> {
    const tokenHash = this.tokenService.hashToken(refreshToken);
    const tokenRow = await this.refreshTokenRepository.findOneBy({ tokenHash });
    const isActive = !!tokenRow && !tokenRow.revokedAt && tokenRow.expiresAt > new Date();

    return isActive ? tokenRow : null;
  }
}

/**
 * @returns {AuthStatus} A fresh anonymous answer — the same keys, in the same
 *   order, for every logged-out case.
 */
function anonymous(): AuthStatus {
  return { loggedIn: false, isAdmin: false };
}
