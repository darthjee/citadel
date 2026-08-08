import { ConfigService } from '@nestjs/config';

/**
 * Reads a numeric configuration value by `key` from `configService`, falling back to `fallback`
 * whenever the raw value is unset (`undefined`/`null`) or parses to `NaN` — guarding the
 * abuse-guard services (`AccountEditAbuseGuardService`, `AuthorizationRequestAbuseGuardService`)
 * against a malformed env var silently becoming `NaN` and disabling their thresholds/windows.
 * @param {ConfigService} configService - Supplies the raw, unparsed config value.
 * @param {string} key - The config key to read (e.g. `CITADEL_PLACEHOLDER_ACCOUNT_EDIT_MAX_ATTEMPTS`).
 * @param {number} fallback - The value to return when `key` is unset or non-numeric.
 * @returns {number} The parsed numeric value, or `fallback`.
 */
export function getNumberConfig(configService: ConfigService, key: string, fallback: number): number {
  const raw = configService.get(key);

  if (raw === undefined || raw === null) {
    return fallback;
  }

  const parsed = Number(raw);

  return Number.isNaN(parsed) ? fallback : parsed;
}
