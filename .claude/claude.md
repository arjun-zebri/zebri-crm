# Zebri  -  Claude Development Guide

Zebri is a **minimal CRM for Wedding MCs**.
Workflow: Couple → Enquiry → Quote → Booked → Wedding → Follow-up
Feel: minimal, fast, calm, modern. Never enterprise.

## Tech Stack
- Frontend: Next.js (App Router), React, Tailwind
- Backend: Supabase (Postgres + Auth)
- Libraries: tanstack-table, react-query, lucide-react, dnd-kit

## Production Initiative — READ FIRST
This project is being hardened from prototype to production. The governing
plan, locked decisions, phase order, and the per-page Definition of Done live
in **`.claude/docs/production-readiness.md`**. When that doc and this file
disagree, the roadmap wins (this file's full rewrite is Phase 0.9).

## Current Scope (accurate as of Phase 0.1)
The app has grown well past the original "minimal MVP". In scope and shipped:
Authentication & subscriptions · Couples (+ couple-owned Events) · Contacts ·
Tasks · Payments (Quotes, Invoices) · Contracts (e-sign) · Client Portal ·
Timeline · Branding editor · Workflows/automation · Admin/Shadow-mode ·
Email (Resend) · Stripe Connect · Slack alerts.
> The old "DO NOT build: Analytics/Automation/…" rule is **obsolete** —
> those features exist and are in scope for production hardening.

## App Layout
Sidebar (240px fixed) | Main content area
Sidebar nav: Dashboard, Couples, Calendar, Tasks, Contacts, Payments,
Branding, Settings (Admin shown only for admin accounts).

## Component Architecture
- Pages are orchestrators  -  no form logic, no mutations
- Section components co-located with their page file
- Shared UI primitives in `components/ui/`
- Shared composite feature components in `components/<feature>/`
  (e.g. `components/builders/` — the Quote/Invoice/Contract modals)
- Max ~150 lines per component  -  split if larger

## Repo Structure & Conventions (Phase 0.1)
Full rationale in **`CONTRIBUTING.md`**. Summary:
- **`types/`** — shared domain/entity types (`@/types/couple`, `@/types/event`,
  `@/types/contact`, `@/types/task`, `@/types/branding-preview`). Import the
  specific module, not a barrel. Types intrinsic to one self-contained
  subsystem stay co-located (e.g. the branding block AST in
  `app/(dashboard)/branding/blocks/types.ts`).
- **`lib/`** — domain modules: `lib/supabase` (data/auth client),
  `lib/payments` (stripe, subscription), `lib/email`, `lib/alerts`,
  `lib/pdf`, `lib/contracts`, `lib/admin`, `lib/branding`, `lib/utils`.
  Pure functions only; no React in `lib/`.
- Prefer `@/`-absolute imports over deep relative (`../../`) paths.
- TSDoc on every exported function/type/module; why-comments on
  non-obvious logic (project-wide standard — see CONTRIBUTING).

## Typography
- Page titles: `text-3xl font-semibold`
- Section titles: `text-xl font-semibold`
- Everything else: `text-sm`

## Brand Assets
Official assets in `.claude/brand_assets/`  -  copy to `public/` when needed. Never recreate.

## Document Maintenance
When you make changes, update the relevant doc in `.claude/docs/`:
| Change area          | File to update                              |
|----------------------|---------------------------------------------|
| UI / design system   | frontend-design.md or component-library.md  |
| Database schema      | database-schema.md                          |
| Page behaviour       | page-specs.md                               |
| Auth flows           | authentication.md                           |
| Billing / Stripe     | payments.md                                 |
| Slack alerts         | alerts.md                                   |
| Tests / selectors    | testing.md                                  |

## Testing Rules
- All features must work on **desktop and mobile** (Pixel 5 + iPhone 12)
- Tests live in `tests/e2e/`  -  one file per feature area
- When running tests, **fix the app** for every failure; don't just patch the test
- Use Tailwind responsive prefixes for mobile fixes  -  never raw CSS media queries
- Prefer semantic selectors: `getByRole` > `getByLabel` > `getByText` > `data-testid`
- See `.claude/docs/testing.md` for full conventions

## Slash Commands Available
- `/new-page`  -  scaffold a new page (loads page-specs.md)
- `/new-component`  -  create a UI component (loads component-library.md)
- `/db-migration`  -  write a schema migration (loads database-schema.md)
- `/fix-ui`  -  audit/fix for design system compliance
- `/add-alert`  -  add a Slack alert (loads alerts.md)
- `/ship-check`  -  pre-ship checklist
- `/test`  -  run Playwright tests (desktop + mobile) and fix issues found

## Always-Loaded Context
@.claude/docs/frontend-design.md
@.claude/docs/component-library.md
@.claude/docs/database-schema.md
@.claude/docs/product-principles.md
