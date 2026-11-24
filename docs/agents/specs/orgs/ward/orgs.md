# Organizations

Hub for the organizations concept.

Organizations let domain data belong to a group of users instead of one user. The concept is
general - any module may reuse it - so it lives next to the user entity, not inside a domain
module.

This page is an **index**. Each topic below has its own page; nothing is duplicated here.

## Where to start

| If you want to... | Read |
|---|---|
| Understand what an organization is and why it exists | [General](./orgs/general.md) |
| Know which meaning of "owner" a sentence uses | [Glossary](./orgs/glossary.md) |
| Integrate with the API | [Endpoints](./orgs/endpoints.md), then [Examples](./orgs/examples.md) |
| Understand the permission model | [Roles](./orgs/roles.md) |
| Understand how a request is authorized | [Owner context](./orgs/owner-context.md) |
| See the database | [Tables](./orgs/tables.md), [Migrations](./orgs/migrations.md) |
| Know what is not built yet | [Roadmap](./orgs/roadmap.md) |

## Reading order

The pages are grouped in five arcs. Each arc depends on the one before it, but any page can be
read alone - each one restates what it needs.

### 1. Concept

| Page | Covers |
|---|---|
| [General](./orgs/general.md) | What an organization is, the design principles, roles at a glance, the security posture, what exists today, deferred work |
| [Glossary](./orgs/glossary.md) | The domain vocabulary, and the two ambiguities that cause most misreadings |

### 2. Data

| Page | Covers |
|---|---|
| [Models](./orgs/models.md) | The two entities, field by field, including what is deliberately absent |
| [Tables](./orgs/tables.md) | The physical schema: columns, primary keys, foreign keys, indexes |
| [Migrations](./orgs/migrations.md) | The single migration that creates both tables, its creation order and its rollback |

### 3. Access control

| Page | Covers |
|---|---|
| [Roles](./orgs/roles.md) | The `user` < `admin` < `owner` ranking, the capability split, and the three enforcement points |
| [Service](./orgs/service.md) | `OrganizationService`, the single-writer rule, and the membership-lookup port |
| [Owner context](./orgs/owner-context.md) | How the owner of every request is resolved in one place, and why the core layer never imports the auth layer |

### 4. Surface

| Page | Covers |
|---|---|
| [Endpoints](./orgs/endpoints.md) | The four routes: payloads, statuses, errors, check order, filters |
| [Security](./orgs/security.md) | The threat model, the 404/403 contract, name validation, the review checklist |
| [Response](./orgs/response.md) | The serializer and the five-field shape; what is never exposed |
| [Caching](./orgs/caching.md) | Cache classes, the proxy rule, and why an id in the URL is not public |

### 5. Around it

| Page | Covers |
|---|---|
| [Frontend](./orgs/frontend.md) | Routing, the context switcher, remembered context, `can()`, role refresh on 403 |
| [Edge cases](./orgs/edge-cases.md) | Zero organizations, pending/denied users, stale context, concurrent renames |
| [Tests](./orgs/tests.md) | The coverage spec, the `data-access` checklist, and what neither can catch |
| [Roadmap](./orgs/roadmap.md) | The six open issues and what each would break |
| [Examples](./orgs/examples.md) | Concrete requests and responses for the four routes |

### 6. Code Samples
| Page | Covers |
|---|---|
| [code sample](./orgs/code-sample.md) | Links to samples of code used by other projects implementing it |

## The short version

If you read nothing else, these six facts carry the design:

1. **Two entities, no owner column.** `Organization` and `OrganizationMembership`. Ownership lives
   only in the membership role.
2. **Exactly one owner per organization.** Not a database constraint - it holds because
   `OrganizationService#create` is the only code that writes memberships.
3. **Organizations are optional.** Registration creates none; zero organizations is the normal
   state.
4. **The active context lives in the URL.** Personal `#/<module>/...`, an organization
   `#/orgs/:orgId/<module>/...`.
5. **The owner of a request is resolved in one place.** `OwnerContextGuard`, a global `APP_GUARD`
   that acts only where `@OwnerScoped()` exists.
6. **The role is re-read from the database on every request**, with no cache and no `is_admin`
   bypass.

## Two words that mean two things

Read the [Glossary](./orgs/glossary.md) before writing anything about this domain.

- **owner** (role) - a value of `OrganizationMembership.role`, the highest of three.
- **owner** (of a record) - the user or organization a domain record belongs to.

And one term that is not an entity:

- **Personal** - a context label, not an organization and not a flag on `Organization`.

## Scope

Organizations are **implemented** on the backend and the frontend, with role enforcement on both
sides. The open work is listed in [Roadmap](./orgs/roadmap.md): joining and members, closing,
creation rate limit, moving a record, sharing a record and authorship.

Because there is no way to join, **every organization has exactly one member today: its owner.**

## Conventions used across these pages

- **`implemented`** means behaviour that exists and is covered by specs.
- **`target`** means documented as intended but **not built**. Every `target` item carries its
  issue number.
- Field, file and route names are given exactly as they appear in the code.
- Where a rule is stated but the source is not quoted, the page says so explicitly in a final
  section rather than reconstructing it silently.
