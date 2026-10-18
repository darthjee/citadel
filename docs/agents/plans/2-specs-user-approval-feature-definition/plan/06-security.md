# Security

Write `docs/agents/specs/user-approval/security.md`, from §8 and the issue's race edge cases.

- Non-disclosure rules: denied looks logged-out/unknown everywhere except login after a correct
  password; `status.json` reveals only `pending` to that user's own session; recovery has the same
  observable effects for every status; business endpoints answer the identical `401`.
- Races: approve vs deny (conditional update, loser `422`); rotation / winning poll racing deny's
  bulk revoke (refresh re-check, poll re-check, gate requires `approved`); deny on denied still
  revokes.
- Accepted risks / costs: one admin can deny every other admin; one indexed DB lookup per
  authenticated request; denied accounts keep username/email.
- Reference + Required tests (non-disclosure byte-for-byte comparisons, race specs).

## Files to Change
- `docs/agents/specs/user-approval/security.md` — new.
