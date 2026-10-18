# Errors

Back to the [feature README](README.md).

Every error body keeps the shape produced by `backend/src/core/http-exception.filter.ts`:

```json
{
  "error": { "code": "<CODE>", "message": "<message>" },
  "statusCode": 400,
  "timestamp": "<ISO 8601>"
}
```

## New error codes

Added to `ErrorCodes` in `backend/src/core/error-codes.ts` and attached at the throw site
(`new ForbiddenException({ code: ErrorCodes.USER_DENIED, message })`). Each message lives in an
exported constant next to its throw site so specs compare against the same string.

| Code | HTTP | Message | Thrown by | Sub-issue |
|---|---|---|---|---|
| `USER_DENIED` | `403` | `This account has been denied access` | `login.json`, correct password on a `denied` user ([api/auth.md](api/auth.md)) | #5 |
| `USER_NOT_PENDING` | `422` | `Only pending users can be approved` | `approve.json` on a non-`pending` user ([api/admin.md](api/admin.md)) | #6 |
| `CANNOT_DENY_SELF` | `422` | `You cannot deny your own account` | `deny.json` on the caller's own id ([api/admin.md](api/admin.md)) | #6 |

`422` has no category code in `categoryCodeFor` today; these throws always carry a specific code,
so none is needed. The unknown-id cases of approve/deny use the existing `404` (`NOT_FOUND`).

Examples:

```json
{
  "error": { "code": "USER_DENIED", "message": "This account has been denied access" },
  "statusCode": 403,
  "timestamp": "<ISO 8601>"
}
```

```json
{
  "error": { "code": "USER_NOT_PENDING", "message": "Only pending users can be approved" },
  "statusCode": 422,
  "timestamp": "<ISO 8601>"
}
```

## The identical `401`

Implemented by #4 (the gate) and relied on by #5.

Every gate rejection — bad signature, expired token, malformed claims, token without `sid`,
revoked or expired session, session of another user, and (from #5) a `pending` or `denied` user —
answers **the same** `401`, byte-for-byte apart from `timestamp`:

```json
{
  "error": { "code": "UNAUTHORIZED", "message": "Invalid or expired access token" },
  "statusCode": 401,
  "timestamp": "<ISO 8601>"
}
```

- A missing `access_token` cookie keeps its existing `Missing access token` message.
- A DB error during the lookup stays a `500` (`INTERNAL_ERROR`), never turned into a `401`.
- A `403` (`USER_DENIED`) never triggers the frontend `ApiClient`'s refresh-and-retry; only a
  `401` does.

## New revoked reason

`RevokedReason.ADMIN_DENIED = 'admin_denied'` (#5), written by `deny.json` and by the
`refresh.json` / `status.json` re-checks of a denied user. It is not `rotated`, so it never
triggers replay detection. See [model.md](model.md#revoked-reasons) for the full list.

## Reference

- [error-codes.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/core/error-codes.ts)
- [jwt.guard.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/core/jwt.guard.ts)
- [admin.service.ts](https://github.com/darthjee/kerghan/blob/main/backend/src/auth/admin.service.ts)

## Required tests

- Byte-for-byte `401` comparison (ignoring `timestamp`) between an expired token and each of: no
  `sid`, revoked session, (#5) pending user, (#5) denied user.
- `login.json` with a correct password on a denied user answers `403` with code `USER_DENIED`
  and the exact message.
- `approve.json` on an `approved` or `denied` user answers `422 USER_NOT_PENDING`.
- `deny.json` on the caller's own id answers `422 CANNOT_DENY_SELF`.
