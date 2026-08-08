import { ConfigService } from '@nestjs/config';

// Env var holding the current secret key (signs JWTs, derives the cache token).
const SECRET_KEY_VAR = 'CITADEL_PLACEHOLDER_SECRET_KEY';
// Env var holding the optional, comma-separated list of retired secret keys.
const PREVIOUS_SECRET_KEYS_VAR = 'CITADEL_PLACEHOLDER_PREVIOUS_SECRET_KEYS';

/**
 * The resolved secret-key set used for zero-downtime key rotation: the
 * current key signs everything new, while previous keys are only accepted
 * when verifying.
 * @property {string} current - The current key (`CITADEL_PLACEHOLDER_SECRET_KEY`).
 * @property {string[]} previous - Retired keys still accepted on verification.
 * @property {string[]} all - `[current, ...previous]`, in verification order.
 */
export interface SecretKeys {
  current: string;
  previous: string[];
  all: string[];
}

/**
 * Resolves the secret-key set from `CITADEL_PLACEHOLDER_SECRET_KEY` and
 * `CITADEL_PLACEHOLDER_PREVIOUS_SECRET_KEYS`. Previous keys are trimmed, and blank
 * entries, duplicates and entries equal to the current key are dropped
 * (first-occurrence order is kept). Pure apart from the `ConfigService`
 * reads, so it is unit-testable without booting the app.
 * @param {ConfigService} configService - Supplies both env vars.
 * @returns {SecretKeys} The current key, the previous keys and both combined.
 */
export function buildSecretKeys(configService: ConfigService): SecretKeys {
  const current = configService.get<string>(SECRET_KEY_VAR) ?? '';
  const previous = parsePreviousKeys(configService.get<string>(PREVIOUS_SECRET_KEYS_VAR) ?? '', current);

  return { current, previous, all: [current, ...previous] };
}

/**
 * Splits and cleans the previous-keys list.
 * @param {string} raw - The raw `CITADEL_PLACEHOLDER_PREVIOUS_SECRET_KEYS` value.
 * @param {string} current - The current key, excluded from the result.
 * @returns {string[]} The unique, non-blank previous keys, in order.
 */
function parsePreviousKeys(raw: string, current: string): string[] {
  const keys = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '' && entry !== current);

  return [...new Set(keys)];
}
