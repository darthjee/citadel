# Routes

Per-endpoint reference for backend routes, one file per domain, complementing the
entity/event-focused `docs/agents/modules/` pages.

- [Auth](routes/auth.md) — `/auth/*.json`: login, register, refresh, logoff, status, recovery,
  device authorization
- [Admin](routes/admin.md) — `/admin/users/*.json`: user search, edit, approve, deny, recovery
  tools
- [Todo](routes/todo.md) — `/todo/*.json` and `/orgs/:orgId/todo/*.json`: the owner-scoped example
  module's lists and items

Future backend modules add their own entry here as they land.
