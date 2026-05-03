# Zebri CRM Product Architecture

## Payments Consolidation (Apr 2, 2026)

See [payments_consolidation.md](payments_consolidation.md) for implementation details.

- Quotes and Invoices unified under `/payments` route with Quotes | Invoices tabs
- Sidebar now shows single "Payments" nav item (removed separate Quotes/Invoices entries)
- Both modals improved with couple selector, compact date inputs, tax display, green toggles
- Couple profile still has Quotes/Invoices tabs that open modals for editing
- Old list pages deleted; [id] detail pages remain but are not actively used

## Events Architecture (Updated Mar 11, 2026)

**Events are now owned by couples, not standalone.**
- Events managed within couple's profile (Overview, Events, Contacts, Tasks tabs)
- `/events` route removed — no standalone Events page/sidebar navigation
- Calendar view moved to Couples page (List/Kanban/Calendar tabs)
- Couple Profile now has Events tab to manage multiple events per couple

## Task Management

Tasks are context-specific and managed within:
- **Couples profile** - tasks related to that couple
- **Events (within couple profile)** - tasks related to specific events
- **Never in contact modal** - contacts don't have Tasks

## Contact Assignment

- Contacts attached to **couples** via `couple_contacts` join table
- Contacts attached to **events** via `event_contacts` join table
- This enables MCs to assign contacts when working with couples or events

## Calendar View (Redesigned Mar 20, 2026)

See [calendar_redesign.md](calendar_redesign.md) for implementation details.

- **Default view**: Week (with time grid)
- **Views available**: Day (time grid with details), Week (7-column time grid), Month (6-week grid)
- **Sidebar**: Mini month navigator + couple status filters + couple name search
- **Time-based layouts**: Day/Week views show 24-hour time grid on left
- **Checkboxes**: All use black accent color (`accent-black`)
- **Navigation**: Prev/Next buttons centered in header (no Today button)

## Couple Modal

- Event Date and Venue fields removed (managed exclusively via Events tab)
- Modal only edits: Name, Email, Phone, Status, Notes
- Event date/venue preserved in DB but not exposed for editing in modal
- See [feedback_couples_modal_design.md](feedback_couples_modal_design.md) — Overview section should show events & contacts inline, no separate sidebar tabs

## Contact & Task Management (Implemented Mar 11, 2026; renamed to Contacts Mar 26, 2026)

- ContactPicker component: reusable inline contact search for couples & events
- Couple/Event Contacts tabs: fully functional contact assignment
- Couple Tasks tab: functional task creation with inline form (title + due date)

# Working Style

- [Docs-first for new feature design](feedback_docs_first.md) — when user says "plan X" or "put this in docs", deliverable is `.claude/docs/<feature>.md` only, no code/migrations.
- [No native select elements](feedback_no_native_selects.md) — all dropdowns must be custom button+popover, never `<select>`.
