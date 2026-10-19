# UserApprovalConfig and registration status

Per [config.md](https://github.com/darthjee/citadel/blob/main/docs/agents/specs/user-approval/config.md).

- New `auth/user-approval.config.ts`: `UserApprovalConfig` with
  `static fromConfigService(configService)` (reads
  `CITADEL_PLACEHOLDER_USER_APPROVAL_REQUIRED`, `=== 'true'`, same convention as
  `mail/mail.config.ts`), `get required(): boolean` and `registrationStatus(): UserStatus`
  (`PENDING` when required, `APPROVED` otherwise). Immutable once built.
- `auth/auth.module.ts`: factory provider
  `{ provide: UserApprovalConfig, inject: [ConfigService], useFactory: (c) => UserApprovalConfig.fromConfigService(c) }`.
- `AuthService`: inject `UserApprovalConfig`; `register` saves
  `status: this.userApprovalConfig.registrationStatus()`. Response unchanged.

Tests:

- New `auth/tests/user-approval.config.spec.ts`: `'true'` → required / `pending`; unset, `''`,
  `'false'`, `'TRUE'`, `'1'` → not required / `approved`.
- `auth.service.spec.ts`: `register` saves the configured status (both values).
- `auth.controller.register.e2e-spec.ts` (using `buildAuthTestApp`'s `configOverrides`): flag off
  → stored user `approved`; flag on → `pending`; the two response bodies are identical in shape
  and carry no `status`; registering with a denied user's username / email → the existing `409`.
- Existing users keep their status when the app boots with the other flag value (a row seeded
  `approved`, app built with the flag on, row unchanged; and the reverse for `pending`).

## Files to Change

- `backend/src/auth/user-approval.config.ts` — new.
- `backend/src/auth/auth.module.ts` — factory provider.
- `backend/src/auth/auth.service.ts` — inject the config, set `status` on register.
- `backend/src/auth/tests/user-approval.config.spec.ts` — new.
- `backend/src/auth/tests/auth.service.spec.ts` — register cases.
- `backend/src/auth/tests/auth.controller.register.e2e-spec.ts` — flag on/off, denied `409`.
