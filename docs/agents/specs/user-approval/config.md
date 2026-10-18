# Configuration

Back to the [feature README](README.md).

Implemented by #5.

| Env var | Default | Read by |
|---|---|---|
| `CITADEL_PLACEHOLDER_USER_APPROVAL_REQUIRED` | off | `UserApprovalConfig` (Auth module), once at boot |

(The `CITADEL_PLACEHOLDER_` prefix is the template placeholder; `scripts/init_project.sh`
renames it with the rest of the project name.)

## Rules

- Exactly `true` turns it on; anything else (unset, empty, `TRUE`, `1`, …) leaves it off. Same
  convention as `CITADEL_PLACEHOLDER_EMAILS_ENABLED`.
- It decides **only** the initial status of a **new self-registration**:

  | Flag | New registration status |
  |---|---|
  | off | `approved` |
  | on | `pending` |

- It **never** changes existing users when toggled: turning it off does not approve pending
  users, turning it on does not make approved users pending.
- It **never** disables the gate's `approved` requirement ([gate.md](gate.md)): a pending user
  stays blocked with the flag off.
- It **never** hides the admin review tools: the status filter, approve and deny are always
  available ([api/admin.md](api/admin.md)).
- It is not exposed to the frontend. The frontend learns about a pending account only through
  `status.json` ([api/auth.md](api/auth.md)).

## `UserApprovalConfig`

The only reader of the variable, built once at boot by a factory provider (no env reads inside
services, per [product.md](../../product.md)):

```ts
// backend/src/auth/user-approval.config.ts
export class UserApprovalConfig {
  static fromConfigService(configService: ConfigService): UserApprovalConfig;
  get required(): boolean;
  registrationStatus(): UserStatus; // PENDING when required, APPROVED otherwise
}
```

```ts
// backend/src/auth/auth.module.ts
{
  provide: UserApprovalConfig,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): UserApprovalConfig =>
    UserApprovalConfig.fromConfigService(configService),
},
```

```ts
// AuthService#register
status: this.userApprovalConfig.registrationStatus(),
```

## Wiring

#5 also:

- adds the variable to [environment-variables.md](../../environment-variables.md) (section 1,
  **Consumed**, optional) and to `.env.dev.sample` (set to `false`);
- checks that it reaches the backend containers. Today `docker-compose.yml` lists no
  `CITADEL_PLACEHOLDER_*` variable explicitly (they come from `.env`), so nothing should be needed
  there; any explicit allowlist added later must include it.

## Reference

- [user-approval.config.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/user-approval.config.ts)
- [auth.service.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/auth.service.ts)
- [environment-variables.md](https://github.com/darthjee/kerghan/blob/main/docs/agents/environment-variables.md) (`KERGHAN_USER_APPROVAL_REQUIRED` row)

## Required tests

- `UserApprovalConfig` (mirroring
  [user-approval.config.spec.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/tests/user-approval.config.spec.ts)):
  `true` → required, `registrationStatus()` is `pending`; unset, empty, `false`, `TRUE`, `1` → not
  required, `registrationStatus()` is `approved`.
- `register.json` with the flag off creates an `approved` user; with the flag on, a `pending`
  user. The response body is identical in both cases.
- Existing users keep their status when the app boots with a different flag value.
