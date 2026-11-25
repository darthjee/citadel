# Organizations - Code Sample

Hub: [Organizations](README.md).

## Purpose

Index of every source file needed to replicate the organizations feature. The list is split into
three parts, meant to be copied **in order**:

| Part | File | Files | Still in `code_sample/` after #26 | After #27 |
|---|---|---|---|---|
| 1. Backend | [code-sample-backend.md](./code-sample-backend.md) | 67 | 45 | 25 |
| 2. Migrations | [code-sample-migrations.md](./code-sample-migrations.md) | 2 | 1 | 1 |
| 3. Frontend | [code-sample-frontend.md](./code-sample-frontend.md) | 57 | 57 | 57 |

**Total: 126 files plus 3 directories** (103 files plus 3 directories still under `code_sample/`
after #26: 4 files were ported into `backend/src/core/`, and 19 no-port copies of files citadel
already has were deleted; their rows now link to citadel's own file). After #27, **83 files plus 2
directories** remain: the owner-context mechanism and its core specs (20 files, including
`core/tests/support/`) were ported into `backend/src/core/`.

The split follows the dependency order, not a preference: the backend compiles without the
frontend, the migrations need the entities to exist first, and the frontend needs both.

## Why three parts

- **Verifiable copying.** Each part is a checklist you can finish and sign off before moving on. A
  single 126-row table invites a skipped row.
- **Different failure modes.** A missing backend file breaks the build. A missing migration breaks
  the boot. A missing frontend file breaks one page. Splitting keeps the diagnosis local.
- **Migrations are short and dangerous.** Two files, but they fail loudly and in a specific order.
  They deserve their own page rather than a row buried in a long table.

## The mirror convention

Every row in the three parts links to a path under `orgs/code_sample/` that reproduces the original
repository layout:

```
original:  backend/src/auth/organization.service.ts
mirror:    orgs/code_sample/backend/src/auth/organization.service.ts
```

Copy the real file into the mirror path with the **same name and case**. The links then resolve
without editing any page.

```
orgs/code_sample/
  backend/
    src/
      auth/            entities, dto, organization.service.ts, controller, response, tests
      core/            guards, decorators, ports, pipes, roles, cache
      database/
        migrations/    the single organizations migration
  frontend/
    assets/js/         routing, context, permissions, ownerContext, pages, client
    specs/             Jasmine specs mirroring assets/js
```

## Proof of the paths

**Every path in the three parts was read from the repository tree on branch `main`.** None is
inferred from naming convention. If a file is renamed upstream, a link breaks - that is the signal
to update the page, not a sign that the file never existed.

## Copy order and checkpoints

| Step | Copy | Then verify |
|---|---|---|
| 1 | [Backend](./code-sample-backend.md) | The project compiles: entities, service, guards and module resolve |
| 2 | [Migrations](./code-sample-migrations.md) | `auth_users` exists first; the organizations migration then runs clean |
| 3 | [Frontend](./code-sample-frontend.md) | `npm run build` passes; the specs run with `jsx-loader.mjs` in place |

**Do not skip step 2 between the others.** The organizations migration carries a foreign key to
`auth_users`. Copying the backend without the migrations gives a build that passes and a boot that
fails.

## Copying with rsync

`rsync -a --parents` recreates the full path under the destination, which is exactly the mirror
layout these pages assume.

```
# a single file
rsync -a --parents \
  backend/src/auth/organization.service.ts \
  docs/agents/modules/auth/orgs/code_sample/

# a whole directory, when a row points at a directory
rsync -a --parents \
  backend/src/core/tests/support \
  docs/agents/modules/auth/orgs/code_sample/
```

Adjust the destination to wherever `orgs/` lives in the target repository.

## Not covered by any of the three parts

| Item | Why |
|---|---|
| Configuration files | `docker-compose*.yml`, `package.json`, `tsconfig.json`, ESLint config, `vite.config.*` are project-wide, not organizations-specific |
| `20260824120001-auth-create-users.ts` | Required as a prerequisite for the organizations migration, but it belongs to the users feature. Copy it from the auth module |
| Other auth entities | `user.entity.ts` is listed in part 1 because the membership references it. Token, session and authorization-request entities are only needed if the replica keeps login |
| The `bank` module | Only two role-enforcement test files are listed, as a working example of the `@MinOrgRole` matrix. The module itself is a separate feature |
| Form validation utilities | `fieldValidators.js` and `formValidators.js` are used by the organization forms. Add them if form validation is replicated |
