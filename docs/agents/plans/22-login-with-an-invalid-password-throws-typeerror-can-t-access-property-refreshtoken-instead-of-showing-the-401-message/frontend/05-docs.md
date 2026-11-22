# Docs (architect)

This step is owned by the **architect** (`docs/agents/` is outside the frontend scope). Run it
after steps 01–04 land. Ward reference: `docs/agents/architecture/frontend.md`,
`docs/agents/flow.md`, `docs/agents/backend/routes/auth.md` at `aa398da`. Document the
public-route opt-out and the reject-on-expiry contract:

- `docs/agents/architecture/frontend.md`
  - "Auth flow": replace "reacts to a `401` transparently..." with: default routes do one
    refresh-and-retry; on failure they clear `AuthSession`, open the modal, and **reject** with
    the original 401's `ApiError` marked `sessionExpired: true`. `AccountsClient`'s public
    methods (list them, including `logout`) pass `{ skipAuthRecovery: true }`, so a 401 rejects
    as a plain `ApiError` with no session change.
  - "Login modal": a wrong password shows the backend's `Invalid username or password`, next to
    the existing `403 USER_DENIED` note.
  - "API errors": every failure rejects with an `ApiError`; describe the `sessionExpired` field,
    the `isSessionExpired(error)` helper, and the rule that consumers stay silent on session
    expiry (check `isSessionExpired`, never `status === 401`).
- `docs/agents/flow.md` "Session renewal": public auth routes never attempt renewal, and the
  awaiting call rejects when renewal fails.
- `docs/agents/backend/routes/auth.md`: next to "A `403` never triggers the frontend
  `ApiClient`'s refresh-and-retry", add that the `401` answers of the `@Public()` auth routes
  don't trigger it either.

## Files to Change
- `docs/agents/architecture/frontend.md`
- `docs/agents/flow.md`
- `docs/agents/backend/routes/auth.md`
