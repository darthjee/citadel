// DI tokens for the outbound-email providers wired in `mail.module.ts`.
// Kept in their own file (rather than in `mail.module.ts`) so `mail.service.ts`
// can `@Inject(...)` them without importing the module — which would form an
// import cycle (module -> service -> module).

/**
 * Injection token for the frozen `MailConfig` resolved at boot.
 */
export const MAIL_CONFIG = 'MAIL_CONFIG';

/**
 * Injection token for the nodemailer `Transporter` (or `null` when email
 * is disabled).
 */
export const MAIL_TRANSPORT = 'MAIL_TRANSPORT';

/**
 * Injection token for the `EmailMethod` registry — a plain object keyed by
 * method name (see `mail.module.ts`'s `MAIL_METHODS` provider).
 */
export const MAIL_METHODS = 'MAIL_METHODS';

/**
 * Injection token for the frozen raw template registry built at boot by
 * `template-registry.ts` (see `mail.module.ts`'s `MAIL_TEMPLATES` provider).
 */
export const MAIL_TEMPLATES = 'MAIL_TEMPLATES';

/**
 * The known `EmailMethod` names, shared between the registry built in
 * `mail.module.ts` and the `CITADEL_PLACEHOLDER_EMAIL_METHOD` validation in
 * `mail.config.ts`, so the two lists never drift apart.
 */
export const MAIL_METHOD_NAMES = ['native'] as const;

/**
 * Union of the values in {@link MAIL_METHOD_NAMES}.
 */
export type MailMethodName = (typeof MAIL_METHOD_NAMES)[number];
