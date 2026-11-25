import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountEditAbuseGuardService } from './account-edit-abuse-guard.service.js';
import { AccountService } from './account.service.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthorizationRequestAbuseGuardService } from './authorization-request-abuse-guard.service.js';
import { AuthorizationRequestController } from './authorization-request.controller.js';
import { AuthorizationRequestService } from './authorization-request.service.js';
import { MailModule } from '../mail/mail.module.js';
import { AccountEditLockout } from './entities/account-edit-lockout.entity.js';
import { AuthorizationRequest } from './entities/authorization-request.entity.js';
import { OrganizationMembership } from './entities/organization-membership.entity.js';
import { Organization } from './entities/organization.entity.js';
import { PasswordResetToken } from './entities/password-reset-token.entity.js';
import { RefreshToken } from './entities/refresh-token.entity.js';
import { User } from './entities/user.entity.js';
import { PasswordRecoveryRequestedListener } from './events/password-recovery-requested.listener.js';
import { OrganizationController } from './organization.controller.js';
import { OrganizationService } from './organization.service.js';
import { PasswordResetService } from './password-reset.service.js';
import { SessionStatusService } from './session-status.service.js';
import { SessionService } from './session.service.js';
import { TokenService } from './token.service.js';
import { UserApprovalConfig } from './user-approval.config.js';
import { UserUpdateService } from './user-update.service.js';
import { ORGANIZATION_MEMBERSHIP_LOOKUP } from '../core/organization-membership-lookup.js';
import { SESSION_LOOKUP } from '../core/session-lookup.js';

/**
 * The Auth module — always-on (imported directly into `AppModule`, not
 * lazy-loaded), per the issue's module classification. Exports `AuthService`
 * for other modules' direct-DI reads, per the hybrid inter-module
 * communication pattern (a module never writes to another module's tables;
 * reads happen only through the exported service). Also provides Core's
 * `SESSION_LOOKUP` port (implemented by `SessionService`, which itself stays
 * unexported) so the global `JwtGuard` can check every access token's
 * session without `core/` importing `auth/`.
 *
 * Owns organizations: exports `OrganizationService` (the only way other
 * modules read memberships) and provides Core's
 * `ORGANIZATION_MEMBERSHIP_LOOKUP` port with it, so the global
 * `OwnerContextGuard` resolves the member's role without `core/` importing `auth/`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      RefreshToken,
      PasswordResetToken,
      AuthorizationRequest,
      AccountEditLockout,
      Organization,
      OrganizationMembership,
    ]),
    MailModule,
  ],
  controllers: [AuthController, AdminController, AuthorizationRequestController, OrganizationController],
  providers: [
    AuthService,
    AccountService,
    AccountEditAbuseGuardService,
    AdminService,
    PasswordResetService,
    TokenService,
    UserUpdateService,
    AuthorizationRequestService,
    AuthorizationRequestAbuseGuardService,
    PasswordRecoveryRequestedListener,
    SessionService,
    SessionStatusService,
    { provide: SESSION_LOOKUP, useExisting: SessionService },
    OrganizationService,
    { provide: ORGANIZATION_MEMBERSHIP_LOOKUP, useExisting: OrganizationService },
    {
      provide: UserApprovalConfig,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): UserApprovalConfig =>
        UserApprovalConfig.fromConfigService(configService),
    },
  ],
  exports: [AuthService, SESSION_LOOKUP, OrganizationService, ORGANIZATION_MEMBERSHIP_LOOKUP],
})
// NestJS module classes are intentionally empty; all behavior lives in @Module().
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AuthModule {}
