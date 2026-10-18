# Feature README

Write the feature entry point, from §1, §2 and §13 of the reference specification.

Contents of `docs/agents/specs/user-approval/README.md`:

- Overview and purpose: optional admin approval of self-registered accounts; admins can deny
  (reject or ban) any account.
- Product decision (kept here until #7 moves it to `product.md`).
- Status model table (`pending` / `approved` / `denied`), the transition diagram, and the rules:
  only `approved` is authenticated (always, whatever the flag); approve strict from `pending`;
  deny lenient from any status; `denied` final; status changes only through approve/deny.
- Lifecycle edge cases from the issue: pending keeps its session and passes after approval with
  no new login; expired refresh token while pending → log in again → awaiting-approval view;
  toggling the flag never changes existing users; a denied account keeps its username/email
  (re-registering gets the existing "already taken" error, intended).
- Gap analysis (§2) as "what Citadel adds", and the sub-issue map: which sub-issue (#3–#7)
  implements which file(s).
- Scope / out of scope: default user, notifications, admin listing pagination, un-deny.
- Index linking every other file in the folder.
- Reference: Kerghan
  [user-approval.md](https://github.com/darthjee/kerghan/blob/main/docs/agents/modules/auth/user-approval.md),
  epic [#389](https://github.com/darthjee/kerghan/issues/389).
- Required tests: the cross-cutting end-to-end scenarios (flag off unchanged registration; flag
  on → pending blocked → approved passes with the same session; denied logged out everywhere).

## Files to Change
- `docs/agents/specs/user-approval/README.md` — new.
