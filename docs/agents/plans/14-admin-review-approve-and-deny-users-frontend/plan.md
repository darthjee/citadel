# Plan: Admin review: approve and deny users (frontend)

Issue: [14-admin-review-approve-and-deny-users-frontend.md](../../issues/14-admin-review-approve-and-deny-users-frontend.md)

## Overview
Add the admin review UI on top of #6's API:
- `AdminClient` gains `status` on search, `approveUser` and `denyUser`;
- the admin users page gains a status filter, a status column, and per-row Approve and Deny
  buttons that never offer an action the API would refuse.

Frontend only; requires #6 merged.

See [frontend.md](frontend.md) for the full plan.
