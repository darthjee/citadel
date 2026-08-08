# Module — Mail

Citadel Placeholder's general-purpose transactional-email sender. **Always-on** — imported directly into
`AppModule` (see `docs/agents/architecture/modular-pattern.md`'s classification), not
lazy-loaded. It has **no HTTP surface** (no controller, routes, DTOs, entities, or migrations);
other modules and event listeners consume it through the exported `MailService`, injected via
direct DI. First consumer: the password-recovery email, an
`@OnEvent('password-recovery.requested')` listener in the **Auth** module
(`backend/src/auth/events/password-recovery-requested.listener.ts`) that calls
`MailService.sendEmailTemplate` with the `password-recovery` template.

## Configuration

All configuration comes from the `CITADEL_PLACEHOLDER_EMAIL_*` env vars (see
[`environment-variables.md`](../environment-variables.md)), read **once at boot** by
`mail.config.ts`'s `buildMailConfig` — no class reads `process.env`. `mail.module.ts` is the only
file that imports `nodemailer`; it turns the resolved config into a `nodemailer.Transporter`
(or `null`) and, from that, builds the `EmailMethod` registry (see **Send methods** below)
injected into `MailService` alongside the frozen `MailConfig`.

Three boot states:

- **Disabled** — `CITADEL_PLACEHOLDER_EMAILS_ENABLED` is anything other than `'true'` (the default). No
  transporter is created; `MailService.sendEmail` logs and skips. `CITADEL_PLACEHOLDER_EMAIL_METHOD` is still
  resolved and validated on this path (see **Send methods**).
- **Enabled** — `CITADEL_PLACEHOLDER_EMAILS_ENABLED='true'` with a valid `CITADEL_PLACEHOLDER_EMAIL_HOST` and
  `CITADEL_PLACEHOLDER_EMAIL_FROM`. The transporter is built: `465` ⇒ implicit TLS (`secure`), other ports ⇒
  STARTTLS forced when `CITADEL_PLACEHOLDER_EMAIL_USE_TLS` (default `true`); `auth` is sent only when both
  `CITADEL_PLACEHOLDER_EMAIL_USER` and `CITADEL_PLACEHOLDER_EMAIL_PASSWORD` are set; connection/greeting/socket timeouts
  are bounded by `CITADEL_PLACEHOLDER_EMAIL_TIMEOUT_MS` (default `10000`). When SMTP credentials are
  configured, `CITADEL_PLACEHOLDER_EMAIL_USE_TLS=false` is ignored on non-465 ports — STARTTLS stays
  required so the credentials are never offered over a plaintext fallback.
- **Enabled but misconfigured** — enabled with a missing/invalid required var, or an unknown
  `CITADEL_PLACEHOLDER_EMAIL_METHOD`. `buildMailConfig` throws at boot, naming every offending var.

## API

`MailService.sendEmail(params: SendEmailParams): Promise<SendEmailResult>`

- `SendEmailParams` — `{ to, subject, body, html?, from?, method? }`. `from` defaults to
  `CITADEL_PLACEHOLDER_EMAIL_FROM`; `method` defaults to `CITADEL_PLACEHOLDER_EMAIL_METHOD` (see **Send methods**).
- `SendEmailResult` — `{ status: 'sent', method, messageId }` or `{ status: 'skipped', method }`.
  `method` always names whichever `EmailMethod` was resolved, on both outcomes.
- When email is **disabled**, `sendEmail` never throws for that reason — it returns
  `{ status: 'skipped', method }` without touching a method/transport. An unknown `method` still
  throws even when disabled (see **Send methods**).
- When email is **enabled**, a send that the resolved method rejects (or that throws) **rejects**
  the promise. Best-effort swallowing is the caller's decision, not the module's.
- Guards: an empty `to` rejects with `mail: 'to' is required`; a `\r`/`\n` in `to`, `subject`, or
  the effective `from` rejects with `mail: header field contains a newline` (header-injection
  protection).

`MailService.sendEmailTemplate(params: SendEmailTemplateParams): Promise<SendEmailResult>`

- `SendEmailTemplateParams` — `{ to, template, variables, from?, method? }`. `from` / `method`
  behave exactly as in `SendEmailParams`; `template` names a directory under
  `backend/src/mail/templates/` and `variables` are interpolated into its `{{placeholder}}`
  slots (see **Templates** below).
- Shares `sendEmail`'s send path: same method resolution, the same header guards (applied to the
  **rendered** subject), the same failure logging, and the same `SendEmailResult`.
- When email is **disabled** it returns `{ status: 'skipped', method }` **without rendering the
  template** — so an unknown template or a missing variable only rejects when mail is
  **enabled**. An unknown `method` still throws disabled or not.

## Send methods

Delivery is abstracted behind the `EmailMethod` interface (`mail.method.ts`): one async
`deliver({ from, to, subject, text, html })` resolving to `{ messageId? }` or rejecting.
`mail.module.ts` builds a registry — a plain object keyed by method name — from the boot-time
transporter, and injects it into `MailService` as `MAIL_METHODS`.

- **`native`** (`NativeEmailMethod`) — the only registered method today. Delivers through the
  injected nodemailer `Transporter`; a `sendMail` result with an empty `accepted` and a non-empty
  `rejected` throws `mail: recipient rejected: <addrs>`.
- **`CITADEL_PLACEHOLDER_EMAIL_METHOD`** selects the default method (`native` when unset/blank); `mail.config.ts`
  validates it against the same known-method-names list the registry is built from
  (`MAIL_METHOD_NAMES` in `mail.tokens.ts`), so the two can't drift. An unknown configured value
  throws at boot, alongside any other missing/invalid var.
- `SendEmailParams.method` overrides the configured default for one call. `MailService.sendEmail`
  resolves `method = params.method ?? config.method` and validates it against the registry
  **before** the disabled short-circuit and before any transport work — an unknown method always
  throws `mail: unknown method: <name>`, disabled or not.
- No other method is registered yet — no real provider beyond `native`.

## Templates

- **Location** — `backend/src/mail/templates/<name>/`: `subject.txt` (required), `body.txt`
  (required), `body.html` (optional).
- **Discovery** — a boot-time directory scan (`template-registry.ts`'s `buildTemplateRegistry`)
  reads each `<name>/` into a frozen raw (pre-interpolation) record, provided as `MAIL_TEMPLATES`
  from `mail.module.ts`. The module resolves the templates directory relative to its own compiled
  location (`import.meta.url`), and `nest-cli.json`'s `compilerOptions.assets` copies
  `mail/templates/**` into `dist/` so the scan works under `node dist/main.js` too.
- **Boot behaviour** — a template directory missing `subject.txt` or `body.txt` **fails boot**,
  naming the missing file. An empty or absent `templates/` directory is **not** an error (empty
  registry). `password-recovery` is the first shipped template (see **Shipped templates**
  below). The subject's single trailing newline is stripped so it never trips the
  header-injection guard.
- **Shipped templates**
  - `password-recovery` — subject `Reset your Citadel Placeholder password`; the only variable is
    `{{resetUrl}}` (on its own line so mail clients linkify it); no `body.html`. Consumed by
    `auth/events/password-recovery-requested.listener.ts` (best-effort, on
    `password-recovery.requested`) and `Auth`'s `AdminService.sendRecoveryEmail` (synchronous),
    both via `sendEmailTemplate`.
- **Rendering** — `renderTemplate(registry, name, variables)` (pure, `render-template.ts`) →
  `{ subject, text, html? }`. `{{variable}}` placeholders (whitespace inside the braces
  tolerated) are interpolated; a placeholder with no matching key **throws**, naming the template
  and key; extra keys are ignored. Substituted values are HTML-escaped (`& < > " '`) in
  `body.html` **only**, and inserted verbatim in `subject.txt` / `body.txt`. `html` is present in
  the result only when the template defines a `body.html`. The template owns the subject.

## Logging

- Boot: one `log` line stating `enabled` (with the host) or `disabled` — never the whole config
  object, which holds the SMTP password.
- Per call, when disabled: one `debug` line with the recipient, resolved `method`, and either the
  `subject` (`sendEmail`) or the `template` name (`sendEmailTemplate`, which skips before
  rendering).
- On send failure: one `error` line with the recipient, subject, and resolved `method`. Message
  `body`/`html` and credentials are never logged.

## Testing

- `mail/tests/mail.config.spec.ts` — unit specs for `buildMailConfig`: disabled/enabled
  resolution, required-var validation (including `CITADEL_PLACEHOLDER_EMAIL_METHOD`), and the
  port/TLS/auth/timeout mapping, with a fake `ConfigService`.
- `mail/tests/mail.method.spec.ts` — unit specs for `NativeEmailMethod.deliver`: the `sendMail`
  call shape, the resolved `messageId`, and the recipient-rejection throw.
- `mail/tests/mail.service.spec.ts` — unit specs that `new MailService(config, fakeMethods,
  fakeTemplates, logger)`: successful `sendEmail` (default and per-call `method`), `from`
  fallback/override, the disabled skip path, delivery-failure logging (asserting the bodies are
  not leaked), recipient rejection, the `to`/header-injection guards, and the unknown-method
  throw (both enabled and disabled). Also the `sendEmailTemplate` cases: render + delegate,
  `from`/`method` passthrough, disabled-skips-before-rendering, unknown template, missing
  variable, unknown method, the header-injection guard on the rendered subject, and non-leaking
  failure logs.
- `mail/tests/render-template.spec.ts` — unit specs for `renderTemplate` against a synthetic
  in-memory registry: verbatim vs. HTML-escaped substitution, spaced placeholders, missing
  variable / unknown template throws, ignored extra keys, and the absent-`html` branch.
- `mail/tests/password-recovery.template.spec.ts` — unit specs that render the real on-disk
  `password-recovery` template (via `buildTemplateRegistry` + `renderTemplate`) from
  `{ resetUrl }`: registry key present, static subject, the URL on its own line, the two
  reassurance sentences present, no `html`, and the missing-`resetUrl` throw.
- `mail/tests/template-registry.spec.ts` — unit specs for `buildTemplateRegistry` over a
  `tests/fixtures/` template tree: keying, trailing-newline strip, verbatim bodies, the
  optional-`html` branch, frozen output, the missing-`body.txt` throw, and the
  empty/absent-directory branches.
