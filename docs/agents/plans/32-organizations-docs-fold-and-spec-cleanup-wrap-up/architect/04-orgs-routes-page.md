# Add backend/routes/orgs.md

Create `docs/agents/backend/routes/orgs.md`, following the shape of the existing
`backend/routes/todo.md`, `auth.md` and `admin.md` pages, folded from the spec's `endpoints.md` (and
optionally one sample per route from `examples.md`):

- `GET /orgs.json`, `POST /orgs.json`, `GET /orgs/:orgId.json`, `PATCH /orgs/:orgId.json`: auth
  requirement, body, response, status codes, cache class (as declared in code after #33).
- `:orgId` parsing, the `400 > 404 > 403` check order (link
  `../../architecture/owner-context.md`), the error bodies, and what the routes never contain.
- Skip anything `modules/auth.md` already states (e.g. the `/api` prefix being added by the proxy).

Then:

- add the `/orgs` entry to `docs/agents/backend/routes.md`, next to the existing Todo line;
- make `modules/auth.md`'s "Organization routes" section (~line 83) and `organizations.md`'s Routes
  summary link to the new page instead of repeating route details.

## Files to Change

- `docs/agents/backend/routes/orgs.md`: new page
- `docs/agents/backend/routes.md`: `/orgs` entry
- `docs/agents/modules/auth.md`: "Organization routes" links to `backend/routes/orgs.md`
