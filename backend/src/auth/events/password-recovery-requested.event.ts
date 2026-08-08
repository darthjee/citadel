/**
 * Fired (via `EventEmitter2`, event name `password-recovery.requested`) when
 * a `POST /auth/recover.json` request matches an existing account and a
 * `PasswordResetToken` has been created for it. Consumed in-module by
 * `password-recovery-requested.listener.ts`, which renders the
 * `password-recovery` mail template and sends it to `email`
 * through `MailService` — best-effort, a send failure is logged and never
 * propagated back to the request. The plaintext `token` exists only in-flight
 * (in this payload and the reset link); only its hash is ever persisted.
 */
export class PasswordRecoveryRequestedEvent {
  constructor(
    /** The account the recovery token was issued for. */
    readonly userId: number,
    /**
     * The plaintext, one-time recovery token value — only its hash is
     * persisted, this is the only place the plaintext exists outside the
     * request that created it.
     */
    readonly token: string,
    /**
     * The full recovery link
     * (`${FRONTEND_BASE_URL}/#/recover-password?token=<token>`) to embed in
     * the recovery email.
     */
    readonly resetUrl: string,
    /**
     * The account's email address; the recovery email's recipient. Carried
     * in the payload so the listener needs no DB lookup.
     */
    readonly email: string,
  ) {}
}
