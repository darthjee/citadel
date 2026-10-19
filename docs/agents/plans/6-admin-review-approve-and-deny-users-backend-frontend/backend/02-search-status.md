# `status` on admin items, search filter and `currentUserId`

- `AdminController#serializeUser` adds `status: user.status`. Update the JSDoc return shapes of
  `edit` and `search` (search now `{ users: [{ id, username, email, isAdmin, createdAt, status }],
  currentUserId }`). The shared `serializeUser` in `auth-response.ts` is not touched.
- `SearchUsersDto`: add `@IsOptional() @IsIn(Object.values(UserStatus)) status?: UserStatus`.
- `AdminService#searchUsers(q?: string, status?: UserStatus)`: `status` is ANDed into the query —
  no `q`: `find({ where: status ? { status } : undefined })` (or plain `find()` when neither);
  with `q`: `where: [{ username: ILike(…), ...statusFilter }, { email: ILike(…), ...statusFilter
  }]`. Update its JSDoc.
- `AdminController#search(@Body() dto, @CurrentUser() caller)`: calls
  `searchUsers(dto.q, dto.status)` and returns `{ users, currentUserId: caller.sub }`.

## Tests

- `admin.service.spec.ts`: each `status` alone builds `where: { status }`; `q` + `status` puts
  `status` in both `ILike` branches; neither keeps today's `find()`.
- `admin.controller.review.e2e-spec.ts` (new): each status value filters; `q` + `status` is an
  AND; no `status` returns every status; `status: 'bogus'` → `400 VALIDATION_FAILED`; response
  `currentUserId` equals the admin's id and every item has `status`; `edit.json` item has
  `status`.
- Existing search e2e assertions that compare whole items gain `status: 'approved'`.

## Files to Change

- `backend/src/auth/admin.controller.ts` — serializer, `search` signature/return, JSDoc.
- `backend/src/auth/admin.service.ts` — `searchUsers(q, status)`.
- `backend/src/auth/dto/search-users.dto.ts` — `status` field.
- `backend/src/auth/tests/admin.service.spec.ts` — search unit tests.
- `backend/src/auth/tests/admin.controller.review.e2e-spec.ts` — new e2e file.
- `backend/src/auth/tests/admin.controller.e2e-spec.ts` — item shape updates if needed.
