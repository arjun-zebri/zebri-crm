# Zebri Page Specifications

This document defines every page in the CRM.

## Mobile Layout Notes

All pages are fully responsive. Key patterns:

- **Dashboard**: Stats stack to 1-col on mobile → 3-col on sm+. Top grid is 1-col on mobile → 7-col on lg. Bottom grid is 1-col → 2-col md → 4-col xl.
- **Couples / Vendors list**: Table scrolls horizontally on mobile. Only name+status columns visible at 375px; more columns revealed at sm/lg breakpoints.
- **Couple Profile modal**: Centered modal with `p-3` gap on all edges on mobile. Horizontal scrollable tab strip replaces vertical sidebar nav. All header actions consolidated into `⋯` Popover dropdown.
- **Vendor Profile slide-over**: Full-width on mobile, 640px on md+.
- **Calendar (Couples)**: Filter sidebar hidden on mobile, opens as overlay drawer via SlidersHorizontal button. View switcher shows single letter (D/W/M) on mobile.
- **Headers (Couples/Vendors)**: Search input narrows to w-36 on mobile (w-56 on sm+). New button has larger touch target on mobile.

---

# Login

Route: `/login`

Route group: `(auth)`  -  centered card layout, no sidebar.

Purpose: Sign in to Zebri.

Fields: Email, Password

Actions: Sign In, "Forgot password?" link to `/reset-password`, "Sign up" link to `/signup`

---

# Sign Up

Route: `/signup`

Route group: `(auth)`

Purpose: Create a new vendor account.

Fields: Display Name, Business Name, Email, Password

Actions: Create Account, "Already have an account?" link to `/login`

On submit: creates account with `account_type: 'vendor'` in user_metadata.

---

# Reset Password

Route: `/reset-password`

Route group: `(auth)`

Purpose: Request a password reset email.

Fields: Email

Actions: Send Reset Link

Shows confirmation message after submission.

---

# Update Password

Route: `/update-password`

Route group: `(auth)`

Purpose: Set a new password after clicking the reset link.

Fields: New Password, Confirm Password

Actions: Update Password

Redirects to `/login` on success.

---

# Dashboard

Route: `/dashboard` or `/` (landing page after login)

Route group: `(dashboard)`

Purpose: At a glance, see what's happening this week and this month. The MC's command centre  -  quick wins, immediate action items, and a pulse on the business. Focused on _action_ not analytics.

## Layout

Full-width page. Header with "Dashboard" title and New Vendor / New Couple buttons.

Two-tier grid layout:

1. **Top section:** `grid-cols-5`  -  Stats + Revenue Chart (left 3 cols) | Calendar Widget (right 2 cols)
2. **Bottom section:** `grid-cols-3`  -  Leads (left) | Lead Sources (center) | Outstanding Tasks (right)

## Top Left: Stats (3 metric cards)

3 minimal metric cards in a single row (`grid-cols-3`):

| Metric | Calculation |
|--------|-------------|
| Leads | COUNT(all couples) |
| Conversion Rate | COUNT(confirmed+paid+complete couples) / COUNT(all couples) * 100 |
| Revenue | SUM(events.price) where status='completed' (all time) |

Each card shows:
- Label (text-xs font-medium uppercase tracking-wide gray-500) + percentage badge (green/red pill)
- Value (text-2xl font-semibold)
- Diff text: "+X vs last week" (text-xs text-gray-500)
- Percentage badge: emerald-50/emerald-600 for positive, red-50/red-600 for negative
- Currency formatted as AUD
- Values show " - " when 0

## Top Left: Revenue Chart

**Card title:** "Revenue"

**Content:** Recharts AreaChart showing revenue over time. Period selectors: 1m, 3m, 6m (default), 1Y as pill-style toggle.

- Large dollar total display + % change vs previous period
- Stroke: #111111, fill gradient from #A7F3D0 to transparent
- Empty state: "No revenue data yet."

## Top Right: Calendar Widget

**Card title:** "Calendar"

**Content:** Mini month calendar with event dot indicators.

- Month/year header with prev/next chevron navigation
- 7-column day grid (Su–Sa), 6 rows
- Today highlighted with green ring
- Days with events show small emerald dot
- Selected day: black bg, white text
- Below grid: list of events for selected date (couple name, venue)
- Click event to open couple's profile slide-over

## Bottom Left: Leads

**Card title:** "Leads"

**Content:** Status breakdown of all couples with proportional bar chart.

- Row per status: colored dot + label + proportional bar + count
- Bar colors from STATUS_DOT_COLORS in couples-types.ts
- Total count shown in header

## Bottom Center: Lead Sources

**Card title:** "Lead Sources"

**Content:** Breakdown of couples by lead_source with proportional bar chart.

- Row per source (sorted by count, descending): colored dot + label + proportional bar + count
- Sources with 0 couples are hidden
- Total count shown in header
- Unknown source shown for couples with no lead_source set

## Bottom Right: Outstanding Tasks

**Card title:** "Outstanding Tasks"

**Content:** Up to 10 incomplete tasks (status != 'done'), ordered by due_date ascending.

**For each task:**
- Checkbox (accent-black) to mark done (optimistic update)
- Task title
- Couple name (gray, if linked)
- Due date (overdue dates in text-red-500)

**Empty state:** "All caught up."

**Click behaviour:** Click row to open couple's profile slide-over.

## Overall Styling

- Page background: white
- Module cards: bg-white with shadow-sm, rounded-xl, border
- Typography: text-sm for body, text-xs for secondary
- Calm aesthetic with neutral grays

## File Structure

```
app/(dashboard)/
  page.tsx (dashboard orchestrator)
  use-dashboard.ts (data hooks)
  dashboard-stats.tsx (3 metric cards)
  dashboard-revenue-chart.tsx (recharts area chart)
  dashboard-calendar.tsx (mini month calendar widget)
  dashboard-leads.tsx (status breakdown bars)
  dashboard-lead-sources.tsx (lead source breakdown bars)
  dashboard-tasks.tsx (outstanding tasks list)
```

## Notes

- **Fast loading:** Limit queries  -  10 for tasks, calendar scoped to selected month.
- **Calm aesthetic:** Neutral grays and status badge colors. Red only for overdue task dates.
- **Keyboard friendly:** Arrow keys to navigate, Enter to open profiles.

---

# Couples Page

Purpose:

Manage enquiries from couples.

Header: Title "Couples" + total count. Compact Notion-style toolbar inline: expandable search icon, sort dropdown (ArrowUpDown icon), filter dropdown (SlidersHorizontal icon), small black "New" button. List/Board tabs below with larger gap from title.

Status values: new, contacted, confirmed, paid, complete

Table Columns:

Name Email Phone Event Date Venue Status

Sorting: Controlled via sort dropdown in header toolbar (name, event date, created date). No clickable sort on table headers.

Actions:

Add Couple Edit Couple Convert to Booking

Views: List (table), Kanban (5 columns, drag-and-drop), and Calendar (month view).

Kanban style: Notion-inspired board.

- Columns with bg-gray-50 rounded-xl background, content-height (not equal)
- Colored pill headers (e.g. amber-50 bg + amber-600 text for "New")
- Cards are bg-white with shadow-sm; hover shows shadow-md
- "+ New" button full-width at bottom of each column with status-colored border
- No icons on cards  -  date and venue shown as plain gray text
- Scrollbar hidden on kanban container

List style: Notion-inspired clean table.

- No card wrapper (no border/rounded-xl around table)
- Lighter headers: white background, bottom border, sentence-case text
- Plain text pagination (Previous / Next) instead of bordered buttons
- Table scrollable within its container

Calendar style: Month view showing all couples' event dates.

- Standard calendar grid (Sunday-Saturday columns, 6 weeks max)
- Day cells show the date number top-left
- Event dates within a day displayed as small pill tags below the date
- Scrollbar hidden on calendar container
- Pills show: couple name (text-xs), status-based colors: blue for upcoming, emerald for completed, red for cancelled
- Soft shadow on hover
- Click opens couple profile (not event-specific, shows full couple context)
- Multiple event dates in one day stack vertically
- Today's date highlighted with green ring (ring-2 ring-green-500)
- Navigation: Previous/Next month buttons, current month/year displayed (no Today button)
- Filtering and sorting still apply in calendar view (search not applicable)

## Couple Profile

Opens as a centered full-screen modal (not a slide-over). Overlay covers the full viewport.

**Modal layout:**
- Wrapper: `fixed inset-0 flex items-center justify-center p-3 sm:p-4`  -  12px gap on all edges on mobile, 16px on desktop
- Modal box: `w-full sm:w-[90vw] sm:max-w-[1400px] h-full sm:h-[90vh] rounded-2xl`
- Body: vertical flex on mobile (tab strip on top), horizontal flex on desktop (sidebar nav on left)

**Profile header:**
- Couple name (`text-xl font-semibold`) + status badge
- All actions in a single `⋯` (MoreHorizontal) Popover dropdown: Call, Email, WhatsApp, Portal toggle + copy links, Delete couple
- Close button (×) right of `⋯`

**Navigation:**
- Mobile: horizontal scrollable tab strip (`overflow-x-auto`) below header  -  icon + label per tab, `whitespace-nowrap`
- Desktop: vertical 200px sidebar on left  -  same tabs as icon + label rows

**Tabs:** Overview, Payments, Timeline, Names (MC Portal Names), Songs, Files, Pulse

**Overview tab (default):**
- Two-column grid on `lg+` (`grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16`), stacks to 1-col on mobile
- Left: General info (Phone, Email, Lead Source inline editable fields) + Notes textarea (4 rows default, 6 rows when focused)
- Right: Events list + Vendors/Contacts list

**Payments tab:**
- Two-column grid (`grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-16`): Quotes | Invoices
- Invoice due date hidden on mobile (`hidden sm:inline`) to prevent row overflow
- Totals row: `grid-cols-1 sm:grid-cols-2`

**Timeline tab:**
- Event dropdown at top; calendar + sidebar stacked on mobile (`flex-col sm:flex-row`)
- Right sidebar (Unscheduled + To Review) goes full-width on mobile (`w-full sm:w-[260px]`)
- Bottom padding on sidebar: `pb-6 sm:pb-2` to ensure scroll space

**Names tab (MC Portal):**
- Two-column grid (`grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16`) for Couple+Bridal Party | Family+Others

**Pulse tab:**
- Hero: ring + metadata in a `flex` row; score breakdown below as `grid-cols-2 sm:grid-cols-4`
- Ring SVG: `w-28 h-28 sm:w-36 sm:h-36`
- Summary/Intelligence | Recommended Action: `grid-cols-1 sm:grid-cols-2`
- Activity strip: `grid-cols-2 sm:grid-cols-4`

---

## Event Profile

Opens as a slide-over panel within the Events tab of the Couple Profile (or can open from Calendar view). 640px width on desktop, full-width on mobile.

**Profile header:**

- Event date (formatted, e.g. "Saturday, 12 April 2025") + venue (text-sm text-gray-500)
- Status badge (upcoming / completed / cancelled)
- Quick actions right-aligned: Edit (opens edit modal)

**Tabs:** Overview | Vendors | Tasks | Timeline

**Overview tab:** Key event details  -  date, venue, price, status, timeline_notes.

**Vendors tab:** Contacts assigned to this event via event_contacts. Add/remove contacts.

**Tasks tab:** Tasks linked to this event via tasks.related_event_id.

**Timeline tab:**

Two sections stacked vertically:

**Section 1  -  Timeline Items**

Header row: "Timeline" label (text-sm font-medium text-gray-900) + right-aligned "Add item" button (ghost border style, same as other `+ Add` buttons in tab panels).

Item list: each item is a row with `border border-gray-200 rounded-xl p-3 mb-2`. Row layout:
- Drag handle: GripVertical icon (text-gray-300), visible on hover only. Desktop only  -  hidden on mobile.
- Time column: text-sm text-gray-500, min-w-[64px]. Shows " - " when no time set.
- Title: text-sm font-medium text-gray-900, flex-1.
- Duration badge: "~30 min" style, text-xs text-gray-400.
- Contact badge: category color dot + contact name, text-xs.
- Edit / delete icons: fade in on hover (same pattern as Vendor row actions).

Sort order: items with `start_time` set are sorted ascending; untimed items sit below, ordered by `position`. Drag-to-reorder adjusts `position` only  -  timed items stay anchored to their time.

Drag and drop: dnd-kit `SortableContext` with vertical list strategy. Drag handle is the only drag initiator (no accidental drags on scroll/tap). On drop, fire optimistic position update mutation.

Empty state: "No timeline items yet." centered + "+ Add first item" button.

Mobile: drag handle hidden; tap row to open edit modal.

**Add/Edit Timeline Item Modal:**

Title: "Add item" / "Edit item"

Form fields (single-column):

| Field | Type | Required | Notes |
|---|---|---|---|
| Time | `<input type="time">` | No | Native time picker. Displays as "5:30 PM" (12-hour). Clear button to unset. |
| Title | text | Yes | Placeholder: "e.g. Bridal party entrance" |
| Description | textarea 2 rows | No | Placeholder: "Internal notes, cues, reminders..." |
| Duration | number + "min" suffix | No | Placeholder: "e.g. 30" |
| Assigned contact | searchable Select | No | Populated from contacts in this event only (event_contacts). Shows name + category badge. |

Footer: Delete (red, left, "click again to confirm" pattern) + Cancel + Save (black).

**Section 2  -  Share Link**

Separated by `border-t border-gray-100 mt-6 pt-6`.

Header: "Share link" (text-sm font-medium text-gray-900)
Subtext: "Anyone with this link can view the timeline." (text-xs text-gray-500)

**Disabled state (default):** Pill toggle off. "Copy link" button grayed and disabled. Label: "Enable link to share."

**Enabled state:** Toggle on (green fill). Active "Copy link" button  -  clicking copies `/timeline/[token]` to clipboard and shows inline "Copied!" text (no toast). "Regenerate" ghost button (RotateCw icon) right of Copy. Clicking Regenerate shows inline confirm: "This will break the existing link. Regenerate?" with Confirm / Cancel. On toggle enable: toast "Share link enabled."

**New component files** (co-located in `app/(dashboard)/events/`):

```
event-timeline.tsx
event-timeline-item.tsx
event-timeline-modal.tsx
event-timeline-share.tsx
use-event-timeline.ts
```

## Timeline Access from Events Route

Route: `/events/[id]/timeline`

Route group: `(dashboard)`  -  authenticated, full sidebar layout.

Purpose: A dedicated full-page view for building and managing the timeline for a specific event. Accessible directly (bookmarkable by the MC) without navigating through the couple profile slide-over.

**Entry points:**

- Event row in the Couple Profile Events tab: "Timeline" link/button on each event row (next to the Edit action). On desktop this is a text link; on mobile it's an icon button (CalendarClock icon).
- Direct URL navigation: `/events/[id]/timeline`

**Page layout:**

Two-column on desktop (`lg:grid-cols-[1fr_320px]`), single-column on mobile.

- Left column (main): timeline items list with the same drag-to-reorder, add/edit/delete behaviour as the Timeline tab in the Event Profile slide-over.
- Right column (sidebar): event summary card (couple name, date, venue, status badge) + Share Link section.

**Back navigation:** Breadcrumb or back link at top: "← [Couple Name]"  -  opens the couple profile slide-over.

**Page title:** "[Couple Name]  -  Timeline" (`text-3xl font-semibold`)

**No duplication of logic:** `event-timeline.tsx`, `event-timeline-modal.tsx`, `event-timeline-share.tsx` are the same components reused from the Event Profile slide-over. Only the layout wrapper differs.

**File:**

```
app/(dashboard)/events/[id]/timeline/page.tsx   -  layout wrapper only, imports event-timeline.tsx
```

---

## Add/Edit Couple Modal

Title: "Add Couple" or "Edit Couple"

Form fields:

- Name (text, required)
- Email (email, optional)
- Phone (tel, optional)
- Status (select, required)
- Lead Source (select, optional  -  referral, website, social_media, word_of_mouth, wedding_expo, venue_partner)
- Notes (textarea, optional)

Note: Event Date and Venue fields are managed exclusively via the Events tab. The couple modal does not expose these fields for editing.

---

# Tasks Page

Route: `/tasks`

Notion-style database table for cross-entity task management. Tasks scoped per-couple or per-event are also rendered as embedded sections inside the couple and event profiles using the same `TaskRow` + `TaskSidePanel` primitives, so a redesign here automatically propagates everywhere tasks appear.

## Page header

- Green-circle check icon + page title `Tasks` (text-2xl sm:text-3xl font-semibold)
- Subtitle: "Stay organized with tasks, your way."
- Right-aligned `+ New task` primary button on desktop; mobile uses a floating "+" FAB above the bottom nav.

## Toolbar

- Search input (matches title + description)
- `+ Filter` button → property picker → value picker → adds an inline filter chip. Clickable chips re-open the value picker; the chip's `X` removes that filter.
- `+ Sort` button works the same way; sort direction toggles by clicking the chip.
- Filterable properties: Status, Priority, Task type, Couple. Sortable: Due date, Status, Priority, Task name.
- **Group by** dropdown on the right: Status (default) · Date · Couple · Priority · Custom · None. Selection persists in `localStorage` under key `tasks-group-by`.

## Properties (columns)

Each task row is a grid: gutter | Task name | Status | Due date | Priority | Task type. Cells inline-edit by click  -  no need to open the side panel:

- **Task name**  -  click to enter inline text edit; Enter saves, Esc cancels.
- **Status**  -  pill picker. Values: `todo`/Not started (gray) · `in_progress`/In progress (blue) · `done`/Done (emerald).
- **Due date**  -  date picker popover. Overdue dates render in red.
- **Priority**  -  pill picker. `high` (red) · `medium` (amber) · `low` (emerald). Optional.
- **Task type**  -  autocomplete popover with create-on-the-fly. Free-form text (`tasks.task_type`); colour assigned deterministically from a 6-colour palette by hashing the value.

The first row of each section renders a column-header strip (`Aa Task name · Status · Due date · Priority · Task type`).

## Hover affordances

- The row gutter shows a hover-revealed checkbox for multi-select (always visible once any task is selected).
- The title cell shows a hover-revealed `Open` button (with `Maximize2` icon) on the right edge → opens the `TaskSidePanel`.
- A drag handle appears in the gutter on hover (desktop only).
- Clicking anywhere else in the row enters that cell's inline edit mode  -  clicking the row does NOT open the panel.

## Group-by modes

All modes render as collapsible Notion-style section pills: chevron + coloured header pill + count + hover actions (`Palette` colour, `MoreHorizontal` rename/delete for custom groups, `+` add task).

- **Status (default):** Sections per status value (Not started / In progress / Done). Drag a task to a different section to update its `status`.
- **Date:** Overdue (red) / Today / Upcoming / No date.
- **Couple:** One section per couple plus Unassigned. Drag updates `related_couple_id`.
- **Priority:** Sections per priority value plus No priority. Drag updates `priority`.
- **Custom:** Sections per `task_groups` row plus Ungrouped. Group headers are rename-on-click; recolour via Palette icon; delete via menu. `+ New group` affordance at the bottom.
- **None:** Flat list ordered by `position`.

In all modes, drag-to-reorder within a section updates `position`.

## Multi-select & bulk actions

- Shift-clicking a row's checkbox extends the selection from the last clicked row to the current one.
- When ≥ 1 task is selected, a floating `BulkActionsBar` slides up from bottom-centre: count · `Done` · `Date` · `Group` (custom mode only) · `Delete` · clear.
- `Esc` clears the selection.

## Side panel (peek view)

Triggered by the hover `Open` button on the row. Width 640px on desktop, 760px at `lg` breakpoint, full-screen sheet on mobile. Layout mirrors Notion's peek:

- Large editable title (no border; auto-saves on blur)
- Property table  -  Status, Due date, Priority, Task type, Group (if any), Couple  -  each as a clickable cell, same components as the table inline cells.
- Notes textarea (auto-saves on blur)
- Footer: `Delete task` (red).
- Header: prev / next arrows walk through the visible task list. Esc / backdrop / X close.

## File structure

```
app/(dashboard)/tasks/
  page.tsx               -  orchestrator: queries, mutations, group-by dispatch, dnd-kit wiring
  task-types.ts          -  Status / Priority enums + pill colour tables + taskTypeColor() hash
  task-cells.tsx         -  inline-edit cells: TitleCell, StatusCell, DueDateCell, PriorityCell, TaskTypeCell
  task-row.tsx           -  table row layout (gutter + cells), hover Open button, multi-select
  task-side-panel.tsx    -  wide peek panel reusing the same property cells
  group-by-toggle.tsx    -  toolbar dropdown
  group-section.tsx      -  collapsible section header + ColumnHeader strip
  filter-bar.tsx         -  Notion-style filter + sort chip bar
  bulk-actions-bar.tsx   -  floating multi-select bar
  use-task-groups.ts     -  react-query hooks for task_groups CRUD
```

Shared UI: `components/ui/side-panel.tsx`, `components/ui/row-actions-menu.tsx`.

---

# Payments Page

Route: `/payments`

Route group: `(dashboard)`

Purpose: Unified hub for managing quotes and invoices. The MC can view, create, and edit all financial documents (quotes and invoices) in one place with tab-based navigation.

Header: Title "Payments" + three tabs: **Quotes** | **Invoices** | **Contracts** (Contracts only renders when the user has Pro/Max via `hasContractsAccess(user)`). Search bar + "New Quote" / "New Invoice" / "New Contract" button (label changes based on active tab). Pressing `/` outside an input focuses the search box; Escape clears it.

**Composition (Phase 2C decomposition):** `app/(dashboard)/payments/page.tsx` is a 262-LOC orchestrator that composes the following co-located sections:

- `payments-header.tsx` — title row, search toolbar, tab strip.
- `payments-table.tsx` — shared desktop-table / mobile-list primitive consumed by every tab.
- `payments-footer.tsx` — fixed bottom count + (for quotes/invoices) money total.
- `quotes-list.tsx`, `invoices-list.tsx`, `contracts-list.tsx` — per-tab row mapping + status pill catalogues.
- `new-contract-popover.tsx` — inline "pick a couple" popover for the Contracts tab New button.
- `use-payments-data.ts` — React Query hooks for the three lists.
- `use-payments-shortcut.ts` — `/` keyboard shortcut + Escape-to-clear.

The Quote/Invoice/Contract builder modals are unchanged in 2C — their decomposition into `components/builders/parts/` is deferred to **PR 2C.2** (the modals are 1047 + 1465 LOC each; structurally reviewable in isolation).

## Quotes Tab

Table Columns (matching couples/vendors style):
- Number (quote #, gray text)
- Title
- Couple (name)
- Status (badge: gray=draft, blue=sent, emerald=accepted, red=declined, amber=expired). "Expired" begins the day *after* `expires_at` — a quote expiring today is still active (derived via `isPastDue` in `@/lib/utils`).
- Total (right-aligned, currency formatted AUD)
- Expiry Date (right-aligned, formatted date)

**Actions:**
- Click row → opens QuoteBuilderModal for editing
- "New Quote" button → opens couple picker dropdown, then QuoteBuilderModal
- Search bar filters across: title, quote number, couple name, status

**Empty state:** Quote icon + "No quotes yet. Create one from a couple's profile."

## Invoices Tab

Table Columns (matching couples/vendors style):
- Number (invoice #, gray text)
- Title
- Couple (name)
- Status (badge: gray=draft, blue=sent, emerald=paid, red=overdue, gray=cancelled). "Overdue" begins the day *after* `due_date` — an invoice due today is not yet overdue (derived via `isPastDue` in `@/lib/utils`; same boundary the A4 `invoice_overdue` automation uses).
- Total (right-aligned, currency formatted AUD)
- Due Date (right-aligned, formatted date, red if overdue)

**Actions:**
- Click row → opens InvoiceBuilderModal for editing
- "New Invoice" button → opens couple picker dropdown, then InvoiceBuilderModal
- Search bar filters across: title, invoice number, couple name, status

**Empty state:** Invoice icon + "No invoices yet. Create one from a couple's profile."

## Modals

Both QuoteBuilderModal and InvoiceBuilderModal are rendered on this page. **Phase 2C.2** redesigned both into a **two-pane layout**: edit form on the left, live preview on the right. The modal uses the `fullscreen` size (`max-w-7xl`) on desktop; below the `lg:` breakpoint (1024px) the panes stack vertically with the preview as a collapsible section below the form.

### Shared shell (`builder-modal-shell.tsx`)
- Top of the modal: document number (e.g. `Q-001` / `INV-001`) + inline `StatePill` (the same tonal pill used on the Billing tab).
- Right side of the header: status-aware contextual primary CTA + `⋯` overflow menu for destructive / revert actions.
- Body: hero title input (large unbordered text — Notion-style) followed by the composed parts.
- Footer (spans both panes): `share-and-send` row (link affordance + Save + primary Send to couple). While the doc is still a draft, a subtle "Mark as sent" text button sits next to Copy link / Open — it flips the status draft→sent **without** firing an email (for MCs who shared the link out-of-band via SMS/WhatsApp). It leaves `email_sent_at` null, so the primary stays "Send to couple".
- New `previewPane` prop carries the right-side preview content. When provided, the shell switches to a 2-column grid (`grid-cols-1 lg:grid-cols-2`) and the modal upgrades to `fullscreen` size.

### Preview pane (`builder-preview-pane.tsx`)
- Header row: `<` collapse toggle + "Preview ⓘ" + tabs (PDF · Email · Payment page).
- Sub-header: "Branded as {Business Name} · Update branding ↗" — the link opens `/branding` in a new tab so the user can tweak + come back without losing the modal.
- Three tabs, each rendering live (the form state flows directly into the preview every render):
  - **PDF**: `<PreviewPdf>` — renders the same HTML that `buildPdfHtml()` produces for the print dialog, inside a sandboxed iframe.
  - **Email**: `<PreviewEmail>` — `From/To/Subject` envelope above a sandboxed iframe carrying the templated email body (`quoteHtml()` / `invoiceHtml()` from `@/lib/email`).
  - **Payment page**: `<PreviewPaymentPage>` — uses the same `PublicBlockRenderer` the public `/quote/[token]` and `/invoice/[token]` routes use, fed by `useCurrentBranding(surface)`. Pixel-faithful preview of what the couple sees.
- The pane is collapsible — clicking the `<` chevron toggles a slim vertical bar with a `>` chevron to expand again. Useful when the MC wants to focus on just the form.

### Branding integration (`useCurrentBranding`)
- New hook at `lib/branding/use-current-branding.ts` fetches the user's branding from `user_metadata` + the `user_branding` table, assembles a `PublicBranding`-shaped object the renderer consumes.
- Falls back to the `minimal` theme preset for any unset fields.
- `buildPublicBranding(metadata)` is pure + exported for tests.

### `QuoteBuilderModal`
- Meta row: couple picker + expiry date.
- **Template picker**: prominent "Start from template" card above the items area when the quote is empty; collapses to a smaller "Apply template" link in the items header once items exist.
- Line items table: description + amount columns only. Drag-reorder via dnd-kit. "+ Add item" inline.
- "+ Add discount" / "+ Apply 10% GST" link buttons below the items — expand inline when configured.
- Totals panel: Subtotal · (optional Discount) · (optional GST 10%) · **Total** (bold).
- Notes & terms textarea at the bottom.
- Overflow menu: "Convert to invoice" (when accepted) · "Delete quote".
- Save flow: `Save changes` (footer, secondary) + `Send to couple` (footer, primary). Send saves any dirty changes, ensures the share token is enabled, flips a draft to `sent`, and fires the email in one click. After first send, the primary becomes `Resend` + a small "Sent {date}" timestamp. A draft also shows a "Mark as sent" link (flips status without emailing — see the shell footer note above).
- State pill map: Draft (muted) · Sent (info + hollow dot) · Accepted (success + filled dot) · Declined (danger) · Expired (muted).

### `InvoiceBuilderModal`
Same shell + meta row pattern, plus:
- Meta row adds: payment terms (Net 7/14/30/due-on-receipt/custom) + due date. Net terms auto-fill the due date.
- Line items table: description + amount only (quantity removed in 2C.2 — `saveInvoiceAction` writes `quantity = 1, unit_price = amount` for forward compat with the existing schema).
- Discount + GST controls identical to the quote modal.
- **Payment schedule**: vertical timeline. `● Deposit ─┊─ ○ Final` with state pill + amount + due date + inline "Mark paid" affordance per stage. Filled dot when paid, hollow when due. "+ Add payment schedule" link button when none is configured.
- **Card payments toggle**: only visible if `stripeConnectEnabled(user)` is true (read via `@/lib/auth/entitlements` — `app_metadata.stripe_connect_enabled`; never the user-writable `user_metadata`). Toggle + helper text in a token-styled row.
- **Contextual header CTA** (status-aware):
  - Sent (no schedule) → "Mark paid"
  - Sent (with schedule) → "Mark deposit paid"
  - Deposit paid → "Mark final paid"
  - Paid → no CTA (status pill only)
  - Overdue → "Mark paid" (danger-toned)
- Overflow menu: "Revert to sent" (when paid) · "Cancel invoice" (when editable) · "Delete invoice".
- State pill map: Draft · Sent (info + hollow) · Deposit paid (warning + filled) · Paid (success + filled) · Overdue (danger + hollow) · Cancelled (muted).

### Server actions (`app/(dashboard)/payments/actions.ts`)
Mutations no longer happen inline. Saves flow through:
- `saveQuoteAction(input)` — Zod-validated, RLS-scoped, transactional (replace-line-items pattern).
- `saveInvoiceAction(input)` — same shape, plus payment schedule fields + `quantity=1`/`unit_price=amount` invariant.
- `deleteQuoteAction(id)` / `deleteInvoiceAction(id)` — RLS-scoped destructive.
- Status mutations (mark sent / mark paid / revert / cancel) remain inline one-line UPDATEs in the modal — they don't justify their own server actions. "Mark sent" flips a draft to `sent` + ensures `share_token_enabled`, without sending an email.

## Couple Profile Integration

- Couple Profile "Quotes" tab: Shows couple's quotes, "+ New Quote" button opens modal in couple context
- Couple Profile "Invoices" tab: Shows couple's invoices, "+ New Invoice" button opens modal in couple context
- Both tabs can click rows to open modals for editing

---

# Vendors Page

Route: `/vendors`

Route group: `(dashboard)`

Purpose: The MC's vendor directory  -  a trusted rolodex of every wedding professional they work with. Find a DJ's phone number at 4pm on a Saturday, remember the celebrant always runs long, or pull up a photographer to recommend to a couple.

Header: Title "Vendors" + total count. Same compact Notion-style toolbar as Couples: expandable search icon, sort dropdown (ArrowUpDown icon), filter dropdown (SlidersHorizontal icon), small black "New" button. No List/Board tabs  -  vendors is list-only (active/inactive is not a workflow).

Category values: venue, celebrant, photographer, videographer, dj, florist, hair_makeup, caterer, photo_booth, lighting_av, planner, other

Category display labels:
| DB value | Label |
|---|---|
| venue | Venue |
| celebrant | Celebrant |
| photographer | Photographer |
| videographer | Videographer |
| dj | DJ |
| florist | Florist |
| hair_makeup | Hair & Makeup |
| caterer | Caterer |
| photo_booth | Photo Booth |
| lighting_av | Lighting / AV |
| planner | Planner |
| other | Other |

Status values: active, inactive

Table Columns:
| Column | Width | Rendering |
|---|---|---|
| Vendor Name | 22% | font-medium text-gray-900 |
| Contact | 18% | text-gray-500, contact person name |
| Phone | 14% | text-gray-500 |
| Email | 20% | text-gray-500 truncate |
| Category | 14% | Category Badge (coloured dot + label) |
| Status | 12% | Dot only: green (bg-emerald-400) for active, gray (bg-gray-300) for inactive. Tooltip shows label. |

Category Badge colours:
| Category | bg | text | dot |
|---|---|---|---|
| venue | rose-50 | rose-700 | rose-400 |
| celebrant | violet-50 | violet-700 | violet-400 |
| photographer | sky-50 | sky-700 | sky-400 |
| videographer | indigo-50 | indigo-700 | indigo-400 |
| dj | fuchsia-50 | fuchsia-700 | fuchsia-400 |
| florist | pink-50 | pink-700 | pink-400 |
| hair_makeup | orange-50 | orange-700 | orange-400 |
| caterer | amber-50 | amber-700 | amber-400 |
| photo_booth | teal-50 | teal-700 | teal-400 |
| lighting_av | cyan-50 | cyan-700 | cyan-400 |
| planner | lime-50 | lime-700 | lime-400 |
| other | gray-50 | gray-600 | gray-400 |

Sorting: Via sort dropdown  -  Name A-Z, Name Z-A, Newest first (default), Oldest first. No clickable sort on table headers.

Filtering: Via filter dropdown. Category filter first (all 12 categories with counts), then a divider, then status filter (Active/Inactive with counts). One active filter at a time.

Search: Searches across vendor name, contact name, email, phone, and category.

Row hover: Two small icon buttons fade in on the right (Copy phone, Call via tel: link). Solves "I need this number NOW" on wedding day.

Row click: Opens vendor profile panel.

Keyboard shortcuts: `/` to focus search, `n` to open Add Vendor modal, `Escape` to clear search.

Pagination: 10 rows per page. Plain text Previous/Next, same as Couples.

Empty state: Store icon (lucide), "No vendors yet.", "Start building your vendor network."

## Add/Edit Vendor Modal

Title: "Add Vendor" or "Edit Vendor"

Form fields (2-column grid):
| Field | Span | Type | Required |
|---|---|---|---|
| Vendor / Business Name | 2 cols | text | Yes |
| Contact Person | 1 col | text | No |
| Phone | 1 col | tel | No |
| Email | 1 col | email | No |
| Category | 1 col | select (12 options) | No (defaults to "other") |
| Status | 1 col | select (active/inactive) | No (defaults to "active") |
| Notes | 2 cols | textarea, 4 rows | No |

Notes placeholder: "Working notes, preferences, things to remember..."

Footer: Delete (red, left, with "click again to confirm" pattern) + Cancel + Save (black).

## Vendor Profile

Opens as a slide-over panel from the right (640px width), not a full page navigation. Keeps the vendor list visible in the background for context.

**Profile header:**

- Vendor name (text-xl font-semibold) + Category Badge inline
- Contact person below (text-sm text-gray-500)
- Status dot + label
- Quick actions right-aligned: Call (Phone icon + number as tel: link), Email (Mail icon + address as mailto: link), Edit (Pencil icon, opens edit modal)

**Tabs:** Overview, Events (horizontal underline tabs, same style as Settings page)

**Overview tab (default):**

- Contact details: key-value layout (Phone, Email, Category, Status). Phone and Email clickable.
- Notes section: rendered text (not form field). If empty: "No notes yet." in italic gray. Edit button next to "Notes" title opens edit modal.
- Notes are the most valuable field  -  where MCs record things like "DJ prefers to be introduced as DJ Mike", "Photographer needs 20 min for portraits", "AV tech: ask for lapel mic, not handheld".

**Events tab:**

- Compact list of events where this vendor was involved (requires event_vendors join table).
- Each row: event date, couple name, venue. Sorted by date desc.
- Empty state: "No events linked yet. Events will appear here once this vendor is assigned to a wedding."

## File Structure

```
app/(dashboard)/vendors/
  page.tsx
  vendors-types.ts
  use-vendors.ts
  vendors-header.tsx
  vendors-list.tsx
  vendor-modal.tsx
  vendor-profile.tsx
  vendor-overview.tsx
  vendor-events.tsx
```

---

# Settings Page

Route: `/settings`

Route group: `(dashboard)`

Purpose: Unified settings, rendered as an **overlay modal** (not a
full page) styled to match the Couple Profile overlay — centered
`rounded-2xl` card with a left side-tab nav.

## Rendering: intercepting-route modal

Settings opens as an overlay over the current page via Next.js
parallel + intercepting routes:

- `app/(dashboard)/@modal/(.)settings/page.tsx` intercepts **soft
  navigation** to `/settings` (the sidebar link) and renders
  `<SettingsModal/>` over whatever page the user was on. The
  `@modal` slot is wired into `app/(dashboard)/layout.tsx`;
  `@modal/default.tsx` renders nothing when not on settings.
- `app/(dashboard)/settings/page.tsx` is the **hard-load / refresh
  fallback**: it renders the dashboard home as the backdrop plus the
  same `<SettingsModal/>` on top.
- Close (backdrop click / `Esc` / the header `X`) calls
  `router.back()`, falling back to `/` when there is no history.
- The modal shell mirrors `couple-profile.tsx`:
  `bg-black/40 backdrop-blur-sm` backdrop, `bg-white rounded-2xl
  shadow-xl`, `sm:max-w-[1100px] h-[90vh]`, `animate-modal-in`. The
  header is just the "Settings" title + close button.

Component layout (each ≤ ~150 lines): `settings-modal.tsx`
(orchestrator: loads the auth user, owns the active tab), reusing
`settings-nav.tsx` (the side nav) and `settings-body.tsx` (section
switch). The existing section components are reused unchanged.

## Tab Navigation

Left **side-tab nav** with Lucide icons (desktop: 200px vertical
sidebar; mobile ≤ sm: horizontal scrollable pill row) — same pattern
as `couple-profile-nav.tsx`. Active tab driven by `?tab=` search
param (deep-linkable; tab clicks `router.replace` it), default
`personal-info`. Legacy `?tab=branding` / `?tab=portal` redirect to
`/branding`; `?tab=templates` redirects to `/templates`.

Tabs:

### Personal Info (`?tab=personal-info`)

Fields: Display Name, Business Name, Phone, Avatar URL

**Auto-saves** — no Save button. Text fields persist on blur; the
business-type picker and address selection persist on change (writes
`user_metadata` via `auth.updateUser({ data })` — user-owned fields,
not entitlements). A change to the email field is the one case that
toasts (a confirmation link is sent; it isn't live until confirmed).
A calm inline "Saving… / Saved" hint (`auto-save-status.tsx`) replaces
the button.

### Account (`?tab=account`)

Change password + email preferences + danger zone.

- **Change password** — explicit `Change password` button (security
  action: requires the current password; not auto-saved).
- **Email preferences** — toggles **auto-save** immediately on change.
- **Danger zone** — explicit `Delete account` button (destructive).

### Plans & Billing (`?tab=billing`)

Document-style layout. Section labels + thin dividers, no nested
cards. Composition:

- **Plan section** — `CurrentPlanCard` (plan name + state pill +
  inline price + meta line + prose summary + action row + Starter
  usage when applicable).
- **Billing history** section — `BillingHistory` (last 12 invoices
  via `/api/stripe/billing-history`; skeleton on load, hidden when
  empty + no upcoming charge).
- **Plan comparison** — `PlanComparisonDialog`, opened from
  "Change plan" / "Upgrade". 3-column feature table with absolute-
  positioned tint behind the current plan's column.
- **Cancel confirmation** — `CancelConfirmModal`, state hoisted to
  `BillingSection` so both the card and the comparison dialog
  trigger it via `onRequestCancel`.

| CardState                  | StatePill          | Primary action          | Meta line          | Cancel link |
| -------------------------- | ------------------ | ----------------------- | ------------------ | ----------- |
| `starter`                  | "Free plan"        | Upgrade to Pro          | "Joined {date}"    | —           |
| `active`                   | "Active" (green)   | Change plan             | "Renews {date}"    | ✅          |
| `cancelling_in_grace`      | "Cancelling"       | Resubscribe             | "Access until {d}" | —           |
| `past_due`                 | "Payment failed"   | Update payment          | "Joined {date}"    | —           |
| `expired`                  | "Ended"            | Upgrade to Pro          | "Ended {date}"     | —           |
| `comped`                   | "Comped" (green)   | (no action row)         | "Joined {date}"    | —           |

Server actions in `app/(dashboard)/settings/billing/actions.ts`:

- `createPlanChangeSessionAction(plan)` — Stripe Portal deep-link
  `subscription_update_confirm`.
- `cancelSubscriptionAction()` — Stripe API `cancel_at_period_end:
  true` + synchronous `app_metadata` write of
  `subscription_end` (UI doesn't wait on the webhook).
- `resumeSubscriptionAction()` — symmetric undo.
- `paymentMethodPortalAction()` — Stripe Portal deep-link
  `payment_method_update`.

All four actions are rate-limited per-user (5/min/user) via
`STRIPE_RATE_LIMITS`. Hits fire `stripe_rate_limit_hit` with the
specific action name.

After every cancel/resume, `BillingSection`'s polling effect (the
same one used after Stripe Checkout) watches `app_metadata` and
reloads when the webhook lands. Manual "Refresh" escape hatch
appears after 60s — covers the local-dev "did you start
`stripe listen`?" case.

**Note:** the 14-day free trial was removed in Phase 1. The
Starter tier (5-couple cap, long-term free) is the only free
path. Paid plans charge from day 1.

Starter users see a "X of 5 couples used" usage indicator inline
on the card. At-cap users get an inline "Upgrade to add more"
button + the same Starter-cap UX block surfaces on couple-modal
opens.

### Payments (`?tab=payments`)

Two sections:

**Bank details**  -  Account name, BSB, Account number inputs. **Auto-save on blur** (no Save button) — updates `user_metadata` (user-owned fields — `bank_account_name`, `bank_bsb`, `bank_account_number`), with the shared inline "Saving… / Saved" hint. Helper text: "These details will be auto-filled in the Notes field when you create a new invoice."

**Card payments**  -  "Connect Stripe" button (`window.location.href = '/api/stripe/connect'`). Once connected, shows "Connected" emerald badge + masked account ID + "Disconnect" ghost button. The Connect callback writes `stripe_connect_account_id` and `stripe_connect_enabled` to **`app_metadata`** via `updateEntitlements()` (entitlements, not user-owned — they govern access to the public Pay button). Disconnect clears those fields the same way.

### Packages (`?tab=packages`)

Placeholder empty state. Coming soon.

### Notifications (`?tab=notifications`)

Placeholder empty state. Coming soon.

### Privacy (`?tab=privacy`)

Inline Privacy Policy copy (`privacy-section.tsx`), mirroring
zebri.com.au/privacy. Shows a "Last updated" line and a canonical
"View the latest at zebri.com.au/privacy" external link. Read-only —
no actions. Shares the `legal-section.tsx` prose chrome with Terms.

### Terms (`?tab=terms`)

Inline Terms of Service copy (`terms-section.tsx`), mirroring
zebri.com.au/terms. Same `legal-section.tsx` chrome + canonical link
as Privacy. Read-only.

---

# Public Invoice Page

Route: `/invoice/[token]`

Route group: Top-level `app/invoice/[token]/`  -  outside `(dashboard)` and `(auth)`. No auth required.

**Middleware:** `/invoice/` and `/api/stripe/invoice-payment` must be exempt from the paywall  -  couples are not logged in.

Purpose: Read-only invoice view for the couple. Shows line items, totals, and (optionally) a card payment button.

## Layout

No sidebar. Centered card: `max-w-lg mx-auto`. White background.

## Page States

- `loading`  -  skeleton
- `not_found` / `cancelled`  -  "This invoice is no longer available."
- `paid`  -  invoice details + "Payment received" banner (emerald)
- `active`  -  full invoice view
- `overdue`  -  same as active; due date shown in red

## Page Sections (active/overdue state)

1. **Header**  -  MC business name (small uppercase), invoice number + title, couple name, issue date
2. **Line items**  -  description, qty, unit price, amount (tabular)
3. **Totals**  -  Subtotal → GST (tax_rate%) if `tax_rate > 0` → Total
4. **Payment schedule**  -  shown if `deposit_percent != null`. Two rows: deposit (with %, amount, due date, "Paid" badge if `deposit_paid_at` set) and final balance (same). Not shown if invoice is paid.
5. **"Pay with card" button**  -  shown if `stripe_payment_enabled && stripe_connect_enabled && status !== 'paid' && deposit_percent IS NULL`. Black button, full width. On click: `POST /api/stripe/invoice-payment { invoiceId, shareToken }` → redirect to Stripe Checkout.
6. **Notes**  -  payment instructions / bank details section, shown if `notes` is non-empty. Label: "Payment instructions".

## Payment Success Page

Route: `/invoice/payment-success`

No auth required. Shows: "Payment received" heading, short confirmation message, invoice ID from `?invoice=` query param. No redirect  -  couple can close the tab.

File: `app/invoice/payment-success/page.tsx`

## File Structure

```
app/invoice/
  [token]/
    page.tsx                  -  fetches via get_public_invoice RPC, renders all states
    pay-with-card-button.tsx  -  client component; POST to /api/stripe/invoice-payment
  payment-success/
    page.tsx                  -  static confirmation page
```

---

# Public Timeline Page

Route: `/timeline/[token]`

Route group: Top-level `app/timeline/[token]/`  -  outside `(dashboard)` and `(auth)`. No auth required.

**Middleware:** `/timeline/` must be in PUBLIC_ROUTES so the auth middleware does not redirect unauthenticated visitors.

Purpose: A read-only, shareable view of an event's running order. Couples and vendors open this link without logging in.

## Layout

No sidebar, no app chrome. Centered content: `max-w-2xl mx-auto px-4`. White background with a subtle top gradient (`bg-gradient-to-b from-gray-50 to-white h-8`).

## Page Sections

**1. Event header** (`pt-12 pb-8`):
- Couple name: `text-2xl font-semibold text-gray-900`
- Event date (formatted, e.g. "Saturday, 12 April 2025") + venue: `text-sm text-gray-500`, separated by a centered dot (·)
- No status badge  -  irrelevant to the viewer.

**2. Timeline items list:**

Classic left-rail timeline visual  -  `border-l-2 border-gray-200 ml-4 pl-6 pb-6` per item block.

Time dot: `w-2 h-2 rounded-full bg-gray-400` positioned on the rail (`-ml-[25px]`).

Per item:
- Time: `text-xs font-medium text-gray-500 uppercase` (shows " - " if not set)
- Duration: `text-xs text-gray-400` ("~30 min"), right-aligned on the same row as time
- Title: `text-sm font-semibold text-gray-900`
- Description (if present): `text-sm text-gray-600 mt-1`
- Assigned contact (if present): category dot + contact name, `text-xs text-gray-500`

**3. Footer:** `border-t pt-6 pb-10 text-center`
- "Prepared by [business_name]"  -  `text-xs text-gray-400`
- No Zebri logo. No link back to the app. White-label for the MC.

## Not-Found / Disabled State

If the token doesn't match any event, or `share_token_enabled = false`: show centered message "This timeline is no longer available." in place of content. No redirect to login. No error stack.

## Print

Apply `print:` Tailwind utilities at the page root to reduce header padding and hide the footer gradient. No Print button needed  -  browser Cmd+P works. Zero server infrastructure required.

## Data Fetching

Server component. Calls `get_public_timeline(token)` Supabase SECURITY DEFINER function. Returns null → render not-found state.

Query shape:
```
event { date, venue, share_token_enabled,
  couple { name },
  timeline_items (ordered by position) { time, title, description, duration_min,
    contact { name, category }
  }
}
```

## File Structure

```
app/timeline/
  [token]/
    page.tsx            -  server component, fetches + renders
    timeline-item.tsx   -  presentational component for each item row
```

# Templates Page (all reusable templates)

Top-level sidebar page (`/templates`, `FileStack` icon) — the single
home for every reusable-template kind. **Tabbed** (`templates-tabs.tsx`,
underline tabs matching the Settings chrome):

- **Emails** — the email-template library (below); used by automations
  and the manual couple "Send email" flow.
- **Packages** — `PackagesManager` (reusable priced service bundles;
  table `packages` + `package_items`). Sits before Quotes because
  quotes/invoices are built from packages.
- **Quotes** — `QuoteTemplateManager` (reusable line-item sets; table
  `quote_templates` + `quote_template_items`).
- **Invoices** — `InvoiceTemplatesManager` (reusable invoices; table
  `invoice_templates` + `invoice_template_items`). The editor's
  **"Add from package or quote"** picker snapshots a package's or quote
  template's line items in (referencing by copy, not live FK).
- **Timelines** — `TimelineTemplateManager` (reusable run-sheet item
  sets; `timeline_templates` + `timeline_template_items`).
- **Contracts** — `ContractTemplateManager` (`contract_templates`).

Tab order follows the money flow (packages → quotes → invoices build on
each other). Quotes / Timelines / Contracts moved here out of
**Settings → Templates** (that tab is removed; `/settings?tab=templates`
redirects to `/templates`).

The couple-facing **quote and invoice builders** also reference packages:
their "Apply package or template" picker (shared `TemplatePicker`, fed by
`useApplySources` — quote templates + packages, namespaced `qt:`/`pkg:`
ids) snapshots a source's line items + notes into the document. The
invoice builder previously had no apply-from picker at all; it now shares
the quote builder's.

## Emails tab layout

- Header row: email subtitle + "New template" button (`size="sm"` with
  a `Plus` icon, matching the Couples "New couple" button).
- Library: a slim search box, then templates **grouped by lifecycle
  stage** (Enquiry · Quote · Booking · Planning · Wedding week ·
  Follow-up, then an "Other" bucket for un-tagged templates) under
  quiet uppercase subheaders — matching the calm couple-overview /
  automations surfaces. Each row shows name + rendered subject; whole-
  row click opens the editor, and Edit / Duplicate / Delete live in a
  hover-revealed `⋯` overflow menu (`RowActionsMenu`, `alwaysVisible`
  so touch users can reach it). No filter chips and no per-row stage
  chip — the group subheaders carry the stage; search filters by name
  or subject and only non-empty groups render.
- Editor modal (fullscreen): left = name, lifecycle Select, subject
  (mustache, with Insert-variable popover), TipTap body editor wired to
  the email variable catalogue; right = **live preview** filled with
  sample data via the shared renderer (`lib/email/templates`).

## Page States

- **Loading**: `TemplatesSkeleton` — search box + stage-grouped row
  placeholders mirroring the real layout (no spinner, no reflow).
- **Empty** (no templates — rare, since starters auto-seed): `Empty`
  with a New-template CTA.
- **Error**: `ErrorState` with retry.

## Seeding

The server `page.tsx` calls `ensureStarterTemplates()` on first visit,
auto-seeding ~27 editable starter templates (incl. celebrant AU-legal:
NOIM, document request, ceremony script, certificate info). Idempotent
— only seeds when the MC has zero templates.

## Variables & the missing-variable rule

Body mention nodes / subject tokens carry a namespaced automation
variable key (`couple.primary_name`, `event.date | friendly`). The
renderer resolves them through the automation resolver and returns the
set of **unresolved** variables. The library preview uses sample data
(everything resolves); the gate that blocks an email with a missing
variable applies at send time (manual modal + automation handler).

## File Structure

```
app/(dashboard)/templates/
  page.tsx                  -  server: auth + seed + hand off
  templates-client.tsx      -  tab orchestrator (Emails/Quotes/Timelines/Contracts)
  templates-tabs.tsx        -  underline tab nav
  emails-tab.tsx            -  Emails tab: library + editor modal + New button
  templates-library.tsx     -  stage-grouped list, search, row actions
  templates-skeleton.tsx    -  loading skeleton mirroring the grouped list
  template-editor-modal.tsx -  create/edit (editor + live preview)
  template-preview.tsx      -  shared filled-in preview
  subject-field.tsx         -  subject input + variable popover
  actions.ts                -  create/update/delete/clone (Zod + RLS)
  use-templates.ts          -  React Query hooks
  packages-manager.tsx          -  Packages tab (packages + package_items)
  invoice-templates-manager.tsx -  Invoices tab (+ "Add from package/quote" picker)
  quote-template-manager.tsx    -  Quotes tab (moved from settings/)
  timeline-template-manager.tsx -  Timelines tab (moved from settings/)
  contract-template-manager.tsx -  Contracts tab (moved from settings/)
lib/email/
  templates.ts              -  render + detectMissingVariables (shared)
  template-variables.ts     -  editor variable list + sample context
  starter-templates.ts      -  canonical starter set + ensureStarterTemplates
types/email-template.ts     -  EmailTemplate + LifecycleStage
```

## Manual send — couple "Send email" modal

Entry point: a "Send email" button in the couple Overview (`couple-overview.tsx`).
Opens `couple-send-email.tsx`:

- Pick a saved template (inline compose is a planned follow-on).
- Live preview filled against the **real couple** via
  `loadSendContextAction` (couple + MC snapshot + stamped document
  links). Unresolved variables are highlighted amber.
- `SendEmailMissingPanel` lists every missing variable with an inline
  input — values are **temporary for this send only**, never written to
  the couple record.
- Send is **blocked** while any variable is missing; an explicit **"Send
  anyway"** button overrides. The authoritative gate is re-applied in
  `POST /api/email/send-template` (422 when blocked without `sendAnyway`).

Files: `couple-send-email.tsx`, `send-email-missing-panel.tsx`,
`send-email-actions.ts`, `app/api/email/send-template/route.ts`,
`lib/email/send-context.ts`.

Deferred sub-items: static-file attachment upload UI (the route + bucket
already support `attachmentFileIds`; the upload/attach UI lands with the
template editor), and inline (template-less) compose.
