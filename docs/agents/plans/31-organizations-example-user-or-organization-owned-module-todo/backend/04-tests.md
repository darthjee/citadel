# Tests: unit specs, role matrix, coverage specs

All tests run through `docker-compose run --rm citadel_placeholder_tests yarn coverage`, never on the host.

## Test harness (`backend/src/todo/tests/support/`)

`build-todo-test-app.ts` reuses the auth e2e harness pattern from `auth/tests/support/build-auth-test-app.ts` with
`ownerContextGuard: true`:

- the real `OrganizationService` over the in-memory organization repos;
- `TodoModule`;
- in-memory repos (`createInMemoryRepo`) overriding `getRepositoryToken(TodoList)` and `getRepositoryToken(TodoItem)`.

Implementation options:

- extend `buildAuthTestApp` with an `imports`/`repoOverrides` option; or
- write a thin todo-specific builder that composes the same providers.

Either way, prefer extending the shared harness over copying it.

The harness exports what the ported files expect: `ALICE`, `BOB`, `ADMIN` (a global admin), `ALICE_ORG`, `BOB_ORG`,
`base(orgId)`, `send(app, method, path, user, body)`, `withoutTimestamp`, `seedMembership`, and a `createList`
helper.

- Users are logged in once (bcrypt-heavy setup, as in `owner-scoped.e2e-spec.ts`), and `send` sets the cookie.
- If the service uses a query builder or `In()`, make sure `in-memory-repo.ts` supports it. `In` and `IsNull` already
  work. Otherwise keep the service on `find`/`findOne`/`count` with plain conditions.
- Simulate the FK RESTRICT in the in-memory item/list repos only if needed for the race test. Otherwise unit-test the
  `QueryFailedError` mapping in the service spec with a mocked repo.

## Ported role-matrix files

**`backend/src/todo/tests/support/owner-matrix.ts`**, moved from `code_sample/.../bank/tests/support/owner-matrix.ts`
and kept close to the original:

- keep `UNIFORM_404`, `UNIFORM_403`, `ORG_MEMBERS` (20/21/22, or the harness's real ids), `seedOrgRoles` and
  `ownerKeysIn`;
- `OwnerFixtures` becomes `{ alicePersonal, aliceOrg, bobPersonal, bobOrg, items: {...} }`, holding list ids and
  one item each;
- `createOwnerFixtures` creates one list with one item per owner;
- `MatrixCase.accountId` becomes `listId`;
- `NOT_FOUND_CASES` keeps all 9 cases, including both global-admin rows;
- add `ITEM_NOT_FOUND_CASES`:
  - an item under a different list of the same owner;
  - another owner's item;
  - an item in the wrong context (personal and org);
  - an unknown or malformed `:itemId`.

**`backend/src/todo/tests/org-roles.e2e-spec.ts`**, moved from the sample `org-roles.e2e-spec.ts`:

- `ROUTES` lists the 6 owner-scoped todo writes with the minimum roles from the contract, and asserts
  `toHaveLength(6)`;
- keep the per-role 2xx/403 matrix, the non-member 404, "unaffected in the personal context" for admin routes, "the
  403 leaves data untouched / names neither resource nor role", "the 404 comes before the role check" (malformed
  `:orgId`, non-member on an admin route), and "reads stay open to every member";
- drop the bank-specific blocks (payment-generated, ledger mocks).

**`backend/src/todo/tests/todo.controller.e2e-spec.ts`** (new):

- the full CRUD happy paths in both contexts;
- the response key sets;
- `ownerKeysIn(body)` is empty, and no `list_id` appears, on every 2xx;
- `NOT_FOUND_CASES` and `ITEM_NOT_FOUND_CASES` across show, PATCH and DELETE of lists, and item PATCH and DELETE, all
  answering a uniform 404 whose bodies are `toEqual(UNIFORM_404)`;
- `items_count` and the show `items` never include another owner's items;
- deleting a non-empty list answers 409 `LIST_HAS_ITEMS`; deleting **another owner's** non-empty list answers 404,
  not 409;
- deleting an emptied list answers 204;
- validation:
  - 400 on empty or whitespace-only text, 256 code points, a control character, `done: "true"`, `done: 1`,
    `description: null`, `{}` on item PATCH, and `user_id`/`organization_id`/`list_id`/`id` in a body;
  - 2xx on `{ done: false }` alone and on 255 code points;
- cache headers:
  - GET carries `X-Skip-Cache: true` and `Cache-Control: private, no-store`;
  - a 2xx write emits `X-Cache-Invalidate: /todo` or `/orgs/<id>/todo`;
  - a 404 or 409 emits none;
- a `user` member gets 403 on list PATCH and on item DELETE (security review).

## Unit specs

- `todo/tests/todo.service.spec.ts`:
  - owner scoping is passed to every query;
  - the 409 runs only after the lookup;
  - `QueryFailedError` 1451 is mapped to 409;
  - the presence rule with `done: false`;
  - the owner is set from the context.
- `todo/tests/todo-response.spec.ts`: exact `Object.keys(...).sort()` for each serializer.
- `todo/tests/todo-dtos.spec.ts`: each validation rule.
- `core/tests/string-validators.spec.ts`: `NO_CONTROL_CHARACTERS` export, if it is moved.
- `core/tests/error-codes` / `http-exception.filter.spec.ts`: no change expected, since 409 already maps to
  `CONFLICT`.

## Coverage specs

Restore the "discovers owner-scoped routes (> 0)" assertions, replacing the placeholder comments, in:

- `core/tests/min-org-role.coverage.spec.ts:69`;
- `core/tests/owner-scoped.coverage.spec.ts:67`;
- `core/tests/cache-invalidation.coverage.spec.ts:72`.

`cache-policy.coverage.spec.ts` needs no change.

## Files to Change

- `backend/src/todo/tests/support/build-todo-test-app.ts`: new, or an option on the auth harness.
- `backend/src/todo/tests/support/owner-matrix.ts`: ported from `code_sample`.
- `backend/src/todo/tests/org-roles.e2e-spec.ts`: ported from `code_sample`.
- `backend/src/todo/tests/todo.controller.e2e-spec.ts`: new.
- `backend/src/todo/tests/todo.service.spec.ts`, `todo-response.spec.ts`, `todo-dtos.spec.ts`: new.
- `backend/src/core/tests/min-org-role.coverage.spec.ts`, `owner-scoped.coverage.spec.ts`,
  `cache-invalidation.coverage.spec.ts`: restore the "> 0" assertions.
- `backend/src/auth/tests/support/build-auth-test-app.ts`: only if extended with module/repo options.
