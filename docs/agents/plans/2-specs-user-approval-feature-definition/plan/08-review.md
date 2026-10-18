# Review and consistency pass

- Consult, read-only: **product-owner** (README product decision and status model fit
  `docs/agents/product.md`), **security** (`gate.md`, `security.md`, `api/auth.md`),
  **data-access** (admin user item fields, `status.json` exposure). Fold their findings into the
  spec files.
- Cross-check: every edge case 1–13 from the issue appears in its named file with a Required
  test; every file has Reference + Required tests sections; the README index and sub-issue map
  link every file; error codes, env var name (`CITADEL_PLACEHOLDER_USER_APPROVAL_REQUIRED`) and
  revoked reasons are spelled identically everywhere.
- Run `grep -rn "/Users/" docs/agents/specs docs/agents/specs.md` — must print nothing — and
  check every relative link resolves.

## Files to Change
- `docs/agents/specs/user-approval/**` — fixes from the review only.
