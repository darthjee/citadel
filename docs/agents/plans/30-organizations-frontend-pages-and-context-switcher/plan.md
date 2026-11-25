# Plan: Organizations: frontend pages and context switcher

Issue: [30-organizations-frontend-pages-and-context-switcher.md](../../issues/30-organizations-frontend-pages-and-context-switcher.md)

## Overview

This plan ports the organization pages, the header context switcher and the shared Not-found and
permission-denied views from `docs/agents/specs/orgs/code_sample/frontend/`. Where the sample leaves
something out, it ports from ward (`~/projetos/mine/ward/frontend`):

- `validateOrganizationName`;
- the inline switcher in `HeaderHelper`;
- the `AppHelper` page registrations and the context-keyed remount;
- ward's specs.

It also registers the organization routes. Everything is frontend work, built on #29's foundation, and
there are no backend changes.

See [frontend.md](frontend.md) for the full plan.
