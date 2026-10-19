# RefreshToken entity and RevokedReason

Extend `RefreshToken` (`auth_refresh_tokens`) with:

```ts
@Column({ name: 'revoked_reason', type: 'varchar', length: 32, nullable: true })
  revokedReason!: RevokedReason | null;

@Index()
@Column({ name: 'session_uuid', length: 36 })
  sessionUuid!: string;

@Column({ name: 'started_at', type: 'datetime' })
  startedAt!: Date;
```

Export the reason const and type next to the entity:

```ts
export const RevokedReason = {
  ROTATED: 'rotated',
  LOGOUT: 'logout',
  PASSWORD_RESET: 'password_reset',
  REPLAY_DETECTED: 'replay_detected',
} as const;
export type RevokedReason = typeof RevokedReason[keyof typeof RevokedReason];
```

Give each key a JSDoc line saying who writes it. Update the class JSDoc so it explains sessions:
one chain of rotated tokens, with at most one active row per session. It should also say that only
`rotated` triggers replay detection. `ADMIN_DENIED` is added by #5.

## Files to Change

- `backend/src/auth/entities/refresh-token.entity.ts`: new columns, `RevokedReason`, JSDoc.
