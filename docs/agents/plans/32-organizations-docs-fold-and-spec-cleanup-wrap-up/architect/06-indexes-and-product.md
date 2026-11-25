# Indexes, product definitions and agent files

## Indexes

- `docs/agents/index.md`: under Architecture, add `architecture/owner-context.md`. Under Modules →
  Auth, add `modules/auth/organizations.md`. Under Routes, add `backend/routes/orgs.md`.
- `docs/agents/summary.md`: add one-paragraph abstracts for the same three pages, matching the
  existing entries' style (the Todo entry at ~line 30 is a good model).

## Product definitions and agent files

The template now ships **user-or-organization ownership** (owner-context, organization roles). Each
derived project still defines its own domain entities and editing rules. Update the "ownership chain
is still open" wording, linking `architecture/owner-context.md` and `modules/auth/organizations.md`:

- `docs/agents/product.md` (~lines 40, 52, 57): the "Ownership chain" bullet and the "leaves to each
  project" / "fill in" guidance;
- `.claude/agents/product-owner.md` (~lines 15-17);
- `.claude/agents/architect.md` "Data model" section (~lines 126-128).

## Original-project mentions

- `docs/agents/architecture/backend.md:14`: drop "per ward's precedent" and keep the reasoning
  for `poolSize: 5`.

## Files to Change

- `docs/agents/index.md`: three new links
- `docs/agents/summary.md`: three new abstracts
- `docs/agents/product.md`: ownership wording
- `.claude/agents/product-owner.md`: ownership wording
- `.claude/agents/architect.md`: "Data model" wording
- `docs/agents/architecture/backend.md`: remove the `ward` mention at line 14
