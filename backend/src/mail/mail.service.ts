import { Inject, Injectable } from '@nestjs/common';
import type { MailConfig } from './mail.config.js';
import type { EmailMethod } from './mail.method.js';
import { MAIL_CONFIG, MAIL_METHODS, MAIL_TEMPLATES } from './mail.tokens.js';
import { renderTemplate } from './render-template.js';
import type { TemplateRegistry } from './template-registry.js';
import { LoggerService } from '../core/logger.service.js';

/**
 * Arguments accepted by {@link MailService.sendEmail}. `method`, when
 * given, overrides the configured default `EmailMethod` for this one call.
 */
export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  html?: string;
  from?: string;
  method?: string;
}

/**
 * Arguments accepted by {@link MailService.sendEmailTemplate}. The named
 * template supplies the subject and body; `variables` are interpolated into
 * `{{placeholder}}` slots. `from` / `method` behave exactly as in
 * {@link SendEmailParams}.
 */
export interface SendEmailTemplateParams {
  to: string;
  template: string;
  variables: Record<string, string>;
  from?: string;
  method?: string;
}

/**
 * Outcome of {@link MailService.sendEmail}: `'skipped'` when email is
 * disabled (no method touched), `'sent'` with the delivering method's
 * `messageId` otherwise. `method` names whichever `EmailMethod` was
 * resolved, on both outcomes.
 */
export interface SendEmailResult {
  status: 'sent' | 'skipped';
  method: string;
  messageId?: string;
}

/** Outcome of the shared send prologue: proceed with `method`, or the already-skipped result. */
type SendPlan = { method: string } | { skipped: SendEmailResult };

/**
 * Always-on outbound-email facade. Holds no env access of its own — the
 * frozen {@link MailConfig}, the `EmailMethod` registry (keyed by method
 * name), and the raw template registry are supplied by `MailModule`'s
 * providers. Delivery itself is delegated to the resolved `EmailMethod`;
 * this class owns only method resolution, disabled short-circuiting,
 * template rendering, and the send-time guards.
 */
@Injectable()
export class MailService {
  private readonly logger: LoggerService;
  private readonly config: MailConfig;
  private readonly methods: Map<string, EmailMethod>;
  private readonly templates: TemplateRegistry;

  /**
   * @param {MailConfig} config - The frozen outbound-email config.
   * @param {Record<string, EmailMethod>} methods - The `EmailMethod`
   *   registry keyed by method name, built by `MailModule`.
   * @param {TemplateRegistry} templates - The frozen raw template registry
   *   built at boot by `MailModule`.
   * @param {LoggerService} logger - The injected Core logger.
   */
  constructor(
    @Inject(MAIL_CONFIG) config: MailConfig,
    @Inject(MAIL_METHODS) methods: Record<string, EmailMethod>,
    @Inject(MAIL_TEMPLATES) templates: TemplateRegistry,
      logger: LoggerService,
  ) {
    this.config = config;
    this.methods = new Map(Object.entries(methods));
    this.templates = templates;
    this.logger = logger;
  }

  /**
   * Sends one message through the resolved `EmailMethod`. `method` resolves
   * to `params.method ?? config.method` and is validated against the
   * registry before anything else — an unknown method always throws, even
   * when email is disabled. When email is disabled the call is otherwise a
   * no-op that resolves to `{ status: 'skipped', method }`. A configured
   * send that the method rejects (or that throws) rejects this promise —
   * best-effort swallowing is the caller's responsibility.
   * @param {SendEmailParams} params - Recipient, subject, body, optional
   *   `html`/`from`/`method`.
   * @returns {Promise<SendEmailResult>} `{ status: 'skipped', method }`
   *   when disabled, otherwise `{ status: 'sent', method, messageId }`.
   * @throws {Error} When `method` is not a registered `EmailMethod`, `to`
   *   is missing, a header field contains a newline, the recipient is
   *   rejected, or the method throws.
   */
  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    const plan = this.#resolveSendPlan(params.method, { to: params.to, subject: params.subject });

    if ('skipped' in plan) {
      return plan.skipped;
    }

    return this.#send(params, plan.method);
  }

  /**
   * Renders the named template against `variables` and sends the result
   * through the resolved `EmailMethod`. Method resolution and the
   * disabled short-circuit behave exactly as in {@link sendEmail} — an
   * unknown method throws before rendering, and a disabled send resolves to
   * `{ status: 'skipped', method }` with the template left unrendered.
   * Rendering happens only when email is enabled, so a bad template or a
   * missing variable rejects the promise only in that case. The
   * header-injection guard applies to the rendered subject.
   * @param {SendEmailTemplateParams} params - Recipient, template name,
   *   `variables`, optional `from`/`method`.
   * @returns {Promise<SendEmailResult>} `{ status: 'skipped', method }`
   *   when disabled, otherwise `{ status: 'sent', method, messageId }`.
   * @throws {Error} When `method` is not a registered `EmailMethod`, the
   *   template is unknown, a referenced variable is missing, `to` is
   *   missing, a header field contains a newline, the recipient is
   *   rejected, or the method throws.
   */
  async sendEmailTemplate(params: SendEmailTemplateParams): Promise<SendEmailResult> {
    const plan = this.#resolveSendPlan(params.method, { to: params.to, template: params.template });

    if ('skipped' in plan) {
      return plan.skipped;
    }

    const { subject, text, html } = renderTemplate(
      this.templates,
      params.template,
      params.variables,
    );

    return this.#send(
      { to: params.to, subject, body: text, html, from: params.from, method: params.method },
      plan.method,
    );
  }

  // Shared prologue: resolve + validate the method, then short-circuit when disabled.
  #resolveSendPlan(method: string | undefined, logAttrs: Record<string, string>): SendPlan {
    const resolved = method ?? this.config.method;

    this.#assertKnownMethod(resolved);

    if (!this.config.enabled) {
      return { skipped: this.#skip(resolved, logAttrs) };
    }

    return { method: resolved };
  }

  #skip(method: string, logAttrs: Record<string, string>): SendEmailResult {
    this.logger.debug('email disabled; skipping send', {
      context: 'MailService',
      method,
      ...logAttrs,
    });
    return { status: 'skipped', method };
  }

  async #send(params: SendEmailParams, method: string): Promise<SendEmailResult> {
    const from = params.from ?? this.config.from;

    this.logger.debug('email enabled; sending', {
      context: 'MailService',
      to: params.to,
      subject: params.subject,
      method,
    });

    this.#assertSendable(params, from);

    try {
      return await this.#deliver(params, from, method);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error('mail send failed', {
        context: 'MailService',
        to: params.to,
        subject: params.subject,
        method,
        reason,
      });
      throw err;
    }
  }

  async #deliver(params: SendEmailParams, from: string, method: string): Promise<SendEmailResult> {
    const resolved = this.#assertKnownMethod(method);

    const { messageId } = await resolved.deliver({
      from,
      to: params.to,
      subject: params.subject,
      text: params.body,
      html: params.html,
    });

    return { status: 'sent', method, messageId };
  }

  // Resolves `method` against the registry, throwing when it is unknown.
  #assertKnownMethod(method: string): EmailMethod {
    const resolved = this.methods.get(method);

    if (!resolved) {
      throw new Error(`mail: unknown method: ${method}`);
    }

    return resolved;
  }

  #assertSendable(params: SendEmailParams, from: string): void {
    if (!params.to.trim()) {
      throw new Error("mail: 'to' is required");
    }

    if (this.#hasNewline(params.to) || this.#hasNewline(params.subject) || this.#hasNewline(from)) {
      throw new Error('mail: header field contains a newline');
    }
  }

  #hasNewline(value: string): boolean {
    return /[\r\n]/.test(value);
  }
}
