# Product decision and the feature page

Fold the spec `README.md` (plus the status rules from `model.md` and the flag from `config.md`)
into the product doc and a new feature page.

- `product.md`:
  - "What's already decided": add a **User approval** bullet next to "Accounts and login":
    statuses `pending` / `approved` / `denied`, only `approved` is authenticated, optional
    approval of new self-registrations, admins approve pending accounts and deny any account
    but their own (admins may deny admins), `denied` is final and un-deny is rejected. Link to
    `modules/auth/user-approval.md`.
  - "Env vars for the framework": add `CITADEL_PLACEHOLDER_USER_APPROVAL_REQUIRED`.
  - "Deferred": replace "_None recorded yet._" with approve/deny and new-pending notifications,
    and pagination of the admin user listing.
- New `modules/auth/user-approval.md`: overview, status table and state diagram, rules
  (approve strict from `pending`, deny lenient from any status, status changes only through
  approve/deny), the flag (boot-time, only decides new registrations, never disables the gate,
  toggling never changes existing users), lifecycle edge cases (pending keeps its session and
  passes on the next request after approval; expired refresh token while pending; denied keeps
  username/email so re-registering gets the existing `409`), what each endpoint does per status
  (summary, linking to the route docs), the admin review flow, and a Reference section with the
  Kerghan links by GitHub URL. Link out to `modules/auth.md`, `backend/routes/auth.md`,
  `backend/routes/admin.md`, `architecture/security.md` and `architecture/frontend.md` rather
  than duplicating them.

## Files to Change
- `docs/agents/product.md` — decided bullet, env var, deferred items
- `docs/agents/modules/auth/user-approval.md` — new feature page
