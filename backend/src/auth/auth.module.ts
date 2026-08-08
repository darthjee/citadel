import { Module } from '@nestjs/common';
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
import { PasswordResetToken } from './entities/password-reset-token.entity.js';
import { RefreshToken } from './entities/refresh-token.entity.js';
import { Session } from './entities/session.entity.js';
import { User } from './entities/user.entity.js';
import { PasswordRecoveryRequestedListener } from './events/password-recovery-requested.listener.js';
import { PasswordResetService } from './password-reset.service.js';
import { TokenService } from './token.service.js';
import { UserUpdateService } from './user-update.service.js';

/**
 * The Auth module — always-on (imported directly into `AppModule`, not
 * lazy-loaded), per the issue's module classification. Exports `AuthService`
 * for other modules' direct-DI reads, per the hybrid inter-module
 * communication pattern (a module never writes to another module's tables;
 * reads happen only through the exported service).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      RefreshToken,
      Session,
      PasswordResetToken,
      AuthorizationRequest,
      AccountEditLockout,
    ]),
    MailModule,
  ],
  controllers: [AuthController, AdminController, AuthorizationRequestController],
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
  ],
  exports: [AuthService],
})
// NestJS module classes are intentionally empty; all behavior lives in @Module().
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AuthModule {}
