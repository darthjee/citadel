# Plan: User-side approval flow (frontend)

Issue: [12-user-side-approval-flow-frontend.md](../../issues/12-user-side-approval-flow-frontend.md)

## Overview
Make the frontend aware of the pending and denied account states shipped by #5:
- a shared `AuthStatus.refresh` re-checks `status.json` on mount, after login or register, on
  Check again and on window focus;
- an "Awaiting approval" page replaces the app while pending, keeping the refresh token;
- a denied login shows a frontend-owned message.

Frontend only.

See [frontend.md](frontend.md) for the full plan.
