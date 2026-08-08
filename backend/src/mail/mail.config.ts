import { ConfigService } from '@nestjs/config';
import { MAIL_METHOD_NAMES } from './mail.tokens.js';

// Default SMTP submission port, used when `CITADEL_PLACEHOLDER_EMAIL_PORT` is unset/blank.
const DEFAULT_EMAIL_PORT = 587;
// Default per-phase SMTP timeout (ms), used when `CITADEL_PLACEHOLDER_EMAIL_TIMEOUT_MS` is unset/blank.
const DEFAULT_EMAIL_TIMEOUT_MS = 10000;
// Default `EmailMethod` name, used when `CITADEL_PLACEHOLDER_EMAIL_METHOD` is unset/blank.
const DEFAULT_EMAIL_METHOD: string = MAIL_METHOD_NAMES[0];

/**
 * The object handed to `nodemailer.createTransport` — a local structural
 * subset of `SMTPTransport.Options` holding only the keys this module sets,
 * declared here so `mail.config.ts` need not deep-import nodemailer's own
 * type (awkward under NodeNext) and stays free of any nodemailer import.
 */
export interface TransportOptions {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  auth?: { user: string; pass: string };
  connectionTimeout: number;
  greetingTimeout: number;
  socketTimeout: number;
}

/**
 * Frozen, plain-data outbound-email configuration resolved once at boot
 * from the `CITADEL_PLACEHOLDER_EMAIL_*` env vars. When disabled, `transport` is
 * `null` and `from` is `''`; `method` is always resolved+validated,
 * regardless of `enabled`.
 */
export interface MailConfig {
  enabled: boolean;
  from: string;
  transport: TransportOptions | null;
  method: string;
}

/**
 * Validated primitive inputs to `buildTransportOptions`.
 */
export interface TransportOptionsInput {
  host: string;
  port: number;
  user: string;
  pass: string;
  useTls: boolean;
  timeoutMs: number;
}

/**
 * Builds the frozen {@link MailConfig} from `CITADEL_PLACEHOLDER_EMAIL_*`. Called once
 * by `mail.module.ts`'s `useFactory` so there are no hidden env reads
 * inside `MailService`. Pure apart from the `ConfigService` reads, so it is
 * unit-testable without booting the app.
 * @param {ConfigService} configService - Supplies the `CITADEL_PLACEHOLDER_EMAIL_*` values.
 * @returns {MailConfig} The frozen config: a disabled placeholder when
 *   `CITADEL_PLACEHOLDER_EMAILS_ENABLED` is not exactly `'true'`, otherwise an enabled
 *   config carrying resolved transport options. `method` is resolved and
 *   validated on both paths.
 * @throws {Error} When `CITADEL_PLACEHOLDER_EMAIL_METHOD` is set to a value outside
 *   {@link MAIL_METHOD_NAMES}, or — when email is enabled — any other
 *   required var is missing or set to an invalid value.
 */
export function buildMailConfig(configService: ConfigService): MailConfig {
  const enabled = configService.get<string>('CITADEL_PLACEHOLDER_EMAILS_ENABLED') === 'true';
  const method = resolveMethod(configService);

  if (!enabled) {
    throwIfInvalid(false, collectMethodInvalid(method));
    return Object.freeze({ enabled: false, from: '', transport: null, method });
  }

  const host = readTrimmed(configService, 'CITADEL_PLACEHOLDER_EMAIL_HOST');
  const from = readTrimmed(configService, 'CITADEL_PLACEHOLDER_EMAIL_FROM');
  const portRaw = readTrimmed(configService, 'CITADEL_PLACEHOLDER_EMAIL_PORT');
  const timeoutRaw = readTrimmed(configService, 'CITADEL_PLACEHOLDER_EMAIL_TIMEOUT_MS');
  const port = parseOptionalNumber(portRaw, DEFAULT_EMAIL_PORT);
  const timeoutMs = parseOptionalNumber(timeoutRaw, DEFAULT_EMAIL_TIMEOUT_MS);

  const invalid = collectInvalid({ host, from, portRaw, port, timeoutRaw, timeoutMs, method });

  throwIfInvalid(true, invalid);

  const user = readTrimmed(configService, 'CITADEL_PLACEHOLDER_EMAIL_USER');
  const pass = readTrimmed(configService, 'CITADEL_PLACEHOLDER_EMAIL_PASSWORD');
  const useTls = (configService.get<string>('CITADEL_PLACEHOLDER_EMAIL_USE_TLS') ?? 'true') !== 'false';

  return Object.freeze({
    enabled: true,
    from,
    transport: buildTransportOptions({ host, port, user, pass, useTls, timeoutMs }),
    method,
  });
}

/**
 * Maps validated primitives to the nodemailer transport-options shape.
 * @param {TransportOptionsInput} input - The validated host/port/credentials/timeout.
 * @returns {TransportOptions} Options for `nodemailer.createTransport`;
 *   `auth` is present only when both `user` and `pass` are non-empty. When
 *   `auth` is present, `requireTLS` is forced on for non-465 ports even if
 *   `useTls` is `false`, so credentials are never offered over a plaintext
 *   fallback.
 */
export function buildTransportOptions(input: TransportOptionsInput): TransportOptions {
  const { host, port, user, pass, useTls, timeoutMs } = input;
  const hasAuth = Boolean(user && pass);

  const options: TransportOptions = {
    host,
    port,
    secure: port === 465,
    requireTLS: (useTls || hasAuth) && port !== 465,
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
  };

  if (hasAuth) {
    options.auth = { user, pass };
  }

  return options;
}

/**
 * Reads a string env var and trims it.
 * @param {ConfigService} configService - Source of the raw value.
 * @param {string} name - The env var name.
 * @returns {string} The trimmed value, or `''` when unset.
 */
function readTrimmed(configService: ConfigService, name: string): string {
  return (configService.get<string>(name) ?? '').trim();
}

/**
 * Resolves `CITADEL_PLACEHOLDER_EMAIL_METHOD`, defaulting to {@link DEFAULT_EMAIL_METHOD}
 * when unset/blank. Read on both the enabled and disabled paths.
 * @param {ConfigService} configService - Source of the raw value.
 * @returns {string} The trimmed method name, or the default when unset.
 */
function resolveMethod(configService: ConfigService): string {
  const raw = readTrimmed(configService, 'CITADEL_PLACEHOLDER_EMAIL_METHOD');

  return raw === '' ? DEFAULT_EMAIL_METHOD : raw;
}

/**
 * @param {string} method - The resolved method name.
 * @returns {boolean} `true` when `method` is one of {@link MAIL_METHOD_NAMES}.
 */
function isKnownMethod(method: string): boolean {
  return (MAIL_METHOD_NAMES as readonly string[]).includes(method);
}

/**
 * @param {string} method - The resolved method name.
 * @returns {string[]} `['CITADEL_PLACEHOLDER_EMAIL_METHOD']` when `method` is unknown,
 *   empty otherwise.
 */
function collectMethodInvalid(method: string): string[] {
  return isKnownMethod(method) ? [] : ['CITADEL_PLACEHOLDER_EMAIL_METHOD'];
}

/**
 * Throws the shared "missing/invalid" error when `invalid` is non-empty.
 * Reuses the same message shape on both the enabled and disabled paths,
 * varying only the phrase naming why validation ran.
 * @param {boolean} enabled - Whether `CITADEL_PLACEHOLDER_EMAILS_ENABLED` resolved to `true`.
 * @param {string[]} invalid - The offending env var names, if any.
 * @returns {void} Returns normally when `invalid` is empty.
 * @throws {Error} Naming every entry in `invalid`, when non-empty.
 */
function throwIfInvalid(enabled: boolean, invalid: string[]): void {
  if (invalid.length === 0) {
    return;
  }

  const prefix = enabled
    ? 'mail: CITADEL_PLACEHOLDER_EMAILS_ENABLED is true but the following are missing/invalid: '
    : 'mail: the following are missing/invalid: ';

  throw new Error(`${prefix}${invalid.join(', ')}`);
}

/**
 * Parses an optional numeric env var.
 * @param {string} raw - The already-trimmed raw value (`''` when unset).
 * @param {number} fallback - Returned when `raw` is `''`.
 * @returns {number} The fallback when unset, `Number(raw)` otherwise (may
 *   be `NaN`, which the caller flags as invalid).
 */
function parseOptionalNumber(raw: string, fallback: number): number {
  if (raw === '') {
    return fallback;
  }

  return Number(raw);
}

/**
 * Collects the names of every required var that is missing and every
 * optional numeric var that was set but did not parse to a positive
 * finite number.
 * @param {object} input - The resolved candidate values.
 * @param {string} input.host - Resolved `CITADEL_PLACEHOLDER_EMAIL_HOST`.
 * @param {string} input.from - Resolved `CITADEL_PLACEHOLDER_EMAIL_FROM`.
 * @param {string} input.portRaw - Raw trimmed `CITADEL_PLACEHOLDER_EMAIL_PORT`.
 * @param {number} input.port - Parsed port.
 * @param {string} input.timeoutRaw - Raw trimmed `CITADEL_PLACEHOLDER_EMAIL_TIMEOUT_MS`.
 * @param {number} input.timeoutMs - Parsed timeout.
 * @param {string} input.method - Resolved `CITADEL_PLACEHOLDER_EMAIL_METHOD`.
 * @returns {string[]} The offending env var names, empty when all valid.
 */
function collectInvalid(input: {
  host: string;
  from: string;
  portRaw: string;
  port: number;
  timeoutRaw: string;
  timeoutMs: number;
  method: string;
}): string[] {
  const invalid: string[] = [];

  if (!input.host) {
    invalid.push('CITADEL_PLACEHOLDER_EMAIL_HOST');
  }

  if (!input.from) {
    invalid.push('CITADEL_PLACEHOLDER_EMAIL_FROM');
  }

  if (input.portRaw !== '' && !isPositiveFinite(input.port)) {
    invalid.push('CITADEL_PLACEHOLDER_EMAIL_PORT');
  }

  if (input.timeoutRaw !== '' && !isPositiveFinite(input.timeoutMs)) {
    invalid.push('CITADEL_PLACEHOLDER_EMAIL_TIMEOUT_MS');
  }

  invalid.push(...collectMethodInvalid(input.method));

  return invalid;
}

/**
 * @param {number} value - The number to test.
 * @returns {boolean} `true` when `value` is finite and greater than zero.
 */
function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
