# Specs hub and links

Create the permanent specs hub and make it discoverable from the root doc indexes.

- `docs/agents/specs.md`: adapt Kerghan's hub — Purpose (specs vs plans vs issues), Lifecycle
  (first sub-issue writes the specs and registers them under Active specs; implementation
  sub-issues build against them and update them in the same PR when a decision changes; the last
  sub-issue folds them into the permanent docs, deletes the feature folder and moves the entry to
  Completed specs), Conventions (one `README.md` per feature with an index; files split by
  concern; subfolders for variants; Required tests section at the end of each file; GitHub URLs
  only for external references; specs describe decisions, not code), Active specs, Completed
  specs. State explicitly that the hub is permanent and reads "none" under Active specs when no
  feature is in progress; root files link only to the hub, never to a feature folder.
- Register `user-approval` under Active specs, pointing at
  `specs/user-approval/README.md` and epic #1. Completed specs starts empty (table header only,
  or "none").
- Link the hub:
  - `AGENTS.md` documentation table: a `Specs` row next to Plans / Issues.
  - `docs/agents/index.md`: under "Plans & Issues" (rename the heading to
    "Specs, Plans & Issues").
  - `docs/agents/summary.md`: a 2–4 line abstract under the same heading.
  - `docs/agents/folder-structure.md`: add `specs.md` to the top-level reference docs row and a
    `specs/` row (temporary per-feature spec folders).

## Files to Change
- `docs/agents/specs.md` — new permanent hub.
- `AGENTS.md` — docs table row.
- `docs/agents/index.md` — link.
- `docs/agents/summary.md` — abstract.
- `docs/agents/folder-structure.md` — `specs/` and `specs.md` entries.
