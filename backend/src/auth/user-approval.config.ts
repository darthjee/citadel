import { ConfigService } from '@nestjs/config';
import { UserStatus } from './entities/user.entity.js';

// Env var deciding whether a new self-registration starts `pending` (exactly `'true'`) or `approved`.
const APPROVAL_REQUIRED_VAR = 'CITADEL_PLACEHOLDER_USER_APPROVAL_REQUIRED';

/**
 * Immutable user-approval configuration, resolved once at boot from
 * `CITADEL_PLACEHOLDER_USER_APPROVAL_REQUIRED` (exactly `'true'` → on; anything else,
 * including unset, `'TRUE'` or `'1'`, → off). The only reader of that env var,
 * provided to the Auth module by a factory. The flag decides **only** the status
 * of a new self-registration: existing users keep theirs, and the gate requires
 * `approved` whatever the flag.
 */
export class UserApprovalConfig {
  readonly #required: boolean;

  /**
   * @param {boolean} required - Whether new self-registrations need an admin approval.
   */
  constructor(required: boolean) {
    this.#required = required;
    Object.freeze(this);
  }

  /**
   * Builds the config from `ConfigService`. Called once, by the Auth module's factory provider.
   * @param {ConfigService} configService - Supplies `CITADEL_PLACEHOLDER_USER_APPROVAL_REQUIRED`.
   * @returns {UserApprovalConfig} The frozen config.
   */
  static fromConfigService(configService: ConfigService): UserApprovalConfig {
    return new UserApprovalConfig(configService.get<string>(APPROVAL_REQUIRED_VAR) === 'true');
  }

  /**
   * @returns {boolean} Whether new self-registrations need an admin approval.
   */
  get required(): boolean {
    return this.#required;
  }

  /**
   * @returns {UserStatus} The status a new self-registration is stored with:
   *   `pending` when approval is required, `approved` otherwise.
   */
  registrationStatus(): UserStatus {
    return this.#required ? UserStatus.PENDING : UserStatus.APPROVED;
  }
}
