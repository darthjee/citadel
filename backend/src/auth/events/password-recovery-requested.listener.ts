import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PasswordRecoveryRequestedEvent } from './password-recovery-requested.event.js';
import { LoggerService } from '../../core/logger.service.js';
import { MailService } from '../../mail/mail.service.js';

/**
 * In-module consumer of the `password-recovery.requested` event: renders the
 * `password-recovery` mail template and sends it to the account's address via
 * `MailService.sendEmailTemplate`. Best-effort — the whole
 * body is wrapped in `try/catch`, a disabled-mail `skipped` result is a
 * normal outcome, and a send failure is logged at `warn` and never
 * propagated back to the already-responded `/auth/recover.json` request.
 * Only `event.userId` (and, on failure, the error message) is ever logged —
 * never the email address, token, reset link, subject, or body.
 */
@Injectable()
export class PasswordRecoveryRequestedListener {
  private readonly logger: LoggerService;
  private readonly mailService: MailService;

  /**
   * @param {MailService} mailService - The Mail module's send pipe (direct DI).
   * @param {LoggerService} logger - The injected Core logger.
   */
  constructor(mailService: MailService, logger: LoggerService) {
    this.mailService = mailService;
    this.logger = logger;
  }

  /**
   * Handles one `password-recovery.requested` event by composing and sending
   * the recovery email. Always resolves; never rethrows.
   * @param {PasswordRecoveryRequestedEvent} event - The recovery request
   *   payload: `userId`, `token`, `resetUrl`, and the recipient `email`.
   * @returns {Promise<void>} Resolves once the send has been attempted
   *   (regardless of its outcome).
   */
  @OnEvent('password-recovery.requested')
  async handlePasswordRecoveryRequested(event: PasswordRecoveryRequestedEvent): Promise<void> {
    try {
      const result = await this.mailService.sendEmailTemplate({
        to: event.email,
        template: 'password-recovery',
        variables: { resetUrl: event.resetUrl },
      });

      if (result.status === 'sent') {
        this.logger.debug('recovery email sent', {
          context: 'PasswordRecoveryRequestedListener',
          userId: event.userId,
          messageId: result.messageId,
        });
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn('recovery email not sent', {
        context: 'PasswordRecoveryRequestedListener',
        userId: event.userId,
        reason,
      });
    }
  }
}
