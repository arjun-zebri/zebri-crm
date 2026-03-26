# Zebri — Claude Development Guide

Zebri is a **minimal CRM for Wedding MCs**.
Workflow: Couple → Enquiry → Quote → Booked → Wedding → Follow-up
Feel: minimal, fast, calm, modern. Never enterprise.

## Tech Stack
- Frontend: Next.js (App Router), React, Tailwind
- Backend: Supabase (Postgres + Auth)
- Libraries: tanstack-table, react-query, lucide-react, dnd-kit

## MVP Scope — Build ONLY
Authentication | Couples (with events) | Vendors | Tasks | Payments

## DO NOT build
Analytics | Automation | AI features | Messaging | Marketplace

## App Layout
Sidebar (240px fixed) | Main content area
Navigation: Dashboard, Couples, Vendors

## Component Architecture
- Pages are orchestrators — no form logic, no mutations
- Section components co-located with their page file
- Shared UI lives in `components/ui/`
- Max ~150 lines per component — split if larger

## Typography
- Page titles: `text-3xl font-semibold`
- Section titles: `text-xl font-semibold`
- Everything else: `text-sm`

## Brand Assets
Official assets in `.claude/brand_assets/` — copy to `public/` when needed. Never recreate.

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
- Tests live in `tests/e2e/` — one file per feature area
- When running tests, **fix the app** for every failure; don't just patch the test
- Use Tailwind responsive prefixes for mobile fixes — never raw CSS media queries
- Prefer semantic selectors: `getByRole` > `getByLabel` > `getByText` > `data-testid`
- See `.claude/docs/testing.md` for full conventions

## Slash Commands Available
- `/new-page` — scaffold a new page (loads page-specs.md)
- `/new-component` — create a UI component (loads component-library.md)
- `/db-migration` — write a schema migration (loads database-schema.md)
- `/fix-ui` — audit/fix for design system compliance
- `/add-alert` — add a Slack alert (loads alerts.md)
- `/ship-check` — pre-ship checklist
- `/test` — run Playwright tests (desktop + mobile) and fix issues found

## Always-Loaded Context
@.claude/docs/frontend-design.md
@.claude/docs/component-library.md
@.claude/docs/database-schema.md
@.claude/docs/product-principles.md
