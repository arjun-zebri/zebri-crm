# Zebri Page Specifications

This document defines every page in the CRM.

## Feedback pill (global to the dashboard)

Every page inside `app/(dashboard)` renders a fixed "Feedback" pill in the
bottom-right corner, on desktop and mobile alike. It is mounted once in
`app/(dashboard)/layout.tsx` as `<FeedbackLauncher />`, so no page opts in or
out.

- Opens a modal with three fields (kind, summary, what happened) plus an
  optional screenshot. Everything else a ticket needs is captured by the API
  route, so an MC never describes their own environment.
- Two ways to attach an image: **Take screenshot** rasterises the page behind
  the form (the modal excludes itself, so there is no flicker and no dimmed
  backdrop in the shot), or **Attach an image** for one they already have.
  Either shows a thumbnail that opens full size, because a capture sweeps up
  whatever couple names and amounts were on screen and the MC should be able
  to check that before sending.
- Files a Notion task in Tasks Tracker under the `User submitted tickets`
  sprint at status `Triage`, and confirms with a toast naming the ticket, e.g.
  "Thanks, logged as ZEB-42".
- Hidden entirely while an admin is in Shadow mode, and rejected server-side
  too, so a ticket can never look like an MC raised it when they did not.
- Sits at `z-[150]`, above the overlay ladder, so it stays usable with a modal
  open. It hides itself while its own modal is open.

Public surfaces (portal, contract signing, public invoice) have no pill.

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

# Welcome Onboarding Wizard

Route: Modal overlay during application (no standalone route).

Route group: `(dashboard)`  -  authenticated, displays after login on first interaction.

Purpose: Eight-step welcome wizard for new users  -  capture their profile details, then walk them through the core loop (couple → template → send → automation) as animated previews, closing on a personal founder note.

## Gate

The wizard is shown once per user, gated on `user_metadata.welcome_onboarded_at` timestamp. A soft gate using localStorage (key `zebri:welcome-onboarded`) acts as an offline hint to skip the fetch. Every user, regardless of age, has never been stamped on this field, so all existing accounts see the modal once after deploy. A backfill of the gate is the lever to suppress it for old users if needed.

The modal uses `size="2xl"` with `floatingClose` (headerless  -  the step title sits flush at the top). It is dismissible on every exit path (Finish, Escape, ×, backdrop), each of which stamps the gate.

## Eight Steps

1. **Welcome**  -  What Zebri is, in a breath, over a bento grid of wedding-photo tiles that pop in one by one (grey placeholders until the real photos land). Zebri wordmark above the heading. "Next" CTA.
2. **Details**  -  Name, email (read-only, with an info-glyph tooltip explaining why), business name, phone, signature name, address (`AddressAutocomplete`). Icon-labelled inputs. Prefilled from signup.
3. **Links**  -  Website, Instagram, Facebook with icon labels. **Advancing from step 3 is the single save point** (writes `user_metadata` via `auth.updateUser`); a failed write never blocks the flow. On steps 2-3 a **Skip** button closes the whole tour (the dismiss path stamps the gate).
4. **Preview: Add a couple**  -  Blank frame → sidebar click → New couple → Add manually → Add Couple modal (dark backdrop, underline fields, one caret at a time, typewriter) → Save → the couple lands on the Kanban board.
5. **Preview: Create a template**  -  New template opens the editor modal (Template name + Category, Subject/Body with green `{{token}}` highlights and Insert-variable chips, editor toolbar) → Attach file → PDF lands. Modal opens at final size; content fades in without reflow.
6. **Preview: Send it in two clicks**  -  Starts inside the couple profile overlay (vertical tab nav). Emails tab → Send email → template picker popover → compose modal with resolved plain-text subject/body (couple addressed by first name) → Send → the button flips to a green Sent and the animation rests on the composed email.
7. **Preview: Let it run itself**  -  Automation canvas: Add trigger → anchored dropdown → New enquiry; Add action → Send email (card lands complete with `Template · Enquiry reply`); Activate flips the header pill to Active.
8. **Founder note**  -  Real headshot (`public/headshot.jpeg`), personal note (why Zebri exists, one-tool-for-all vision, community emphasis), real signature (`public/signature.png`). "Finish" CTA.

The previews share a beat-clock animation system: a fake cursor measured onto real elements (`data-cursor` attributes), a trailing content clock so effects land only after the pointer arrives (`useSettledBeat`), one-shot click ripples, and a no-loop rest on the final frame. Reduced motion jumps straight to each preview's finished state.

## File Structure

```
app/(dashboard)/onboarding/
  welcome-gate.tsx                       -  gate logic (localStorage hint + metadata read)
  welcome-modal.tsx                      -  Modal shell (2xl, floatingClose, fixed-height wrapper)
  welcome-wizard.tsx                     -  step state, single save point, footer chrome host
  wizard-chrome.tsx                      -  progress bar + Skip/Back/Next/Finish
  use-reduced-motion.ts                  -  system prefers-reduced-motion hook
  steps/
    step-welcome.tsx                     -  step 1
    step-details.tsx                     -  step 2 (owns the WelcomeProfile type)
    step-links.tsx                       -  step 3
    step-preview.tsx                     -  steps 4-7 host (title + copy + script)
    step-founder.tsx                     -  step 8
  previews/
    preview-frame.tsx                    -  mini app chassis: sidebar rail, cursor engine, overlay slot
    preview-modal.tsx                    -  Backdrop + PreviewModal + EditorToolbar minis
    typewriter.tsx                       -  character-by-character reveal with caret
    use-preview-script.ts                -  beat clock + trailing settled-beat clock
    script-couple.tsx                    -  step 4 script
    script-template.tsx                  -  step 5 script
    script-send.tsx                      -  step 6 script
    script-automation.tsx                -  step 7 script
```

## Rollout Note

Existing accounts have never been stamped, so every existing user sees the modal once after deploy. A backfill of `welcome_onboarded_at` via admin API or bulk-update script is the lever to suppress the modal for specific users or cohorts if feedback warrants it.

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

Header: Title "Couples" + total count. Compact Notion-style toolbar inline: expandable search icon, sort dropdown (ArrowUpDown icon), filter dropdown (SlidersHorizontal icon), small black "New couple" button. The "New couple" button is a split menu with two items: "Add manually" (opens the Add Couple modal) and "Import from CSV" (opens the import modal). On mobile the same menu hangs off the circular + button. List/Board tabs below with larger gap from title.

Status values: new, contacted, confirmed, paid, complete

Table Columns:

Name Email Phone Event Date Venue Status

Sorting: Controlled via sort dropdown in header toolbar (name, event date, created date). No clickable sort on table headers.

Actions:

Add Couple Edit Couple Convert to Booking

CSV import ("Import from CSV"):

Three-step modal for bulk-creating couples from a spreadsheet.

- **Step 1 (Upload):** a short numbered walkthrough (1. download the template / use your own `.csv`, 2. one couple per row with `couple_name` + `primary_name` required, 3. upload to map + preview), a click-to-select `.csv` dropzone, and the column list shown as helper text. Fields: `couple_name` (required), `primary_name` (required), `primary_email`, `primary_phone`, `secondary_name`, `secondary_email`, `secondary_phone`, `event_date`, `venue`, `status`. An empty file is rejected with a message.
- **Step 2 (Map):** the file is parsed into a grid (the first row is treated as headers when ≥2 cells look like known field names). Each Zebri field gets a dropdown to pick which source column feeds it, auto-guessed from the header name + aliases (e.g. "Bride" → `primary_name`, "Wedding Date" → `event_date`) or by position when there are no headers. A "First row contains column names" toggle handles files whose header row is missing or garbage. Couple name + primary name must be mapped to continue. `event_date` parses leniently: year-first (`2026-9-1`) or day-first AU (`1/9/2026`, `01-09-2026`, `1.9.26`, 2-digit year as `20YY`), normalized to ISO.
- **Step 3 (Preview):** a scrollable table showing every mapped column and cell value, one row per parsed line, with a per-row checkbox and a header select-all. Status column tags each row Ready (valid, pre-checked), Possible duplicate (matches an existing couple by primary email or couple name, or an earlier row in the file; unchecked but selectable), or invalid (shows the reason, e.g. "Missing couple name"; not selectable). Only `couple_name` and `primary_name` are required; a bad value in an optional field (unreadable date, malformed email) is dropped to null and shown in red in its cell, and the couple still imports. A summary line reads "N of M rows will import." Import creates only the checked rows. The modal widens to its 2xl size for this step.
- `status` falls back to the user's first status when blank or unrecognized.
- **Event date is a real event.** The couple-level `event_date` column is legacy/dead (the schedule lives in `events`), so an imported row with a date creates an `events` row (date + venue) for the couple, which then shows on the calendar and the list. The Add Couple modal has **Wedding date** (the shared `DatePicker`) and **Venue** (the shared `VenueAutocomplete`, Google Places maps autofill capturing venue + phone/website/lat/lng) fields that do the same via `upsertCoupleEventDateAction` (creates the couple's first event, or updates its soonest). `VenueAutocomplete` is shared with the Event modal. Every field in the modal is the boxed 32px `Input` geometry; the underline vocabulary it used until 2026-08-07 was dropped when `DatePicker` lost its `underline` variant.
- The Starter couple cap is respected: the server fills the remaining quota and reports the overflow; the toast reports created / skipped / invalid counts, and the upgrade modal opens when rows were skipped for the cap. Capped at 500 rows per file. Parsing/mapping/validation/dedup live in `lib/utils/csv-import.ts`; the bulk insert is `bulkCreateCouplesAction` (re-validates every row, stamps `user_id` from the session, creates events).

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

**Tab settings (gear):** A Settings (gear) button sits next to Delete in the
header (desktop inline row; mobile actions popover), with a smooth rotate/fade
when toggled. It flips the nav into an inline "settings mode"  -  a vertical,
drag-to-reorder list of every tab, each row with an eye / eye-off button to hide
or show that tab (Overview is locked visible  -  the guaranteed fallback). Edits
live in a working draft so the nav updates instantly (no flicker when toggling
the gear back). The layout is **per-user and global across couples** (not
per-couple) and is **saved when the modal closes** (overlay / Esc / ✕) to
`user_public_settings.couple_profile_tabs_config` via
`updateCoupleProfileTabsConfigAction`. Hidden tabs and order apply everywhere;
hiding the active tab falls the body back to the first visible tab. Derive logic
tolerates drift (unknown stored keys dropped, newly added tabs appended).

**Tabs:** Overview, Pulse, Tasks, **Time**, Contacts, Timeline, Songs, Files,
Vows, Payments, Contracts, Automations, **Templates**.

### Time tracking (couple timer)

Lets an MC time the work they put into a couple and charge accordingly.
Hours only: there are no rates, amounts, or invoice line items.

**Header clock.** A `Timer` icon button in the profile header (desktop
inline row, and a matching row in the mobile `⋯` menu). `Clock` is not
used because Timeline already owns it. Three states:
- nothing running: ghost icon, `aria-label="Start timing"`;
- running for this couple: active treatment (as settings mode) with the
  ticking `HH:MM:SS` beside it, `aria-label="Stop timing"`;
- running for another couple: an informational chip naming that couple
  and its elapsed time, beside a Start button for this one. Starting here
  stops the other, so switching couples stays a single click.

**Running pill.** While a timer runs, a fixed pill sits top-right on every
dashboard page (`z-[90]`; `top-3` desktop, `top-16` on mobile to clear the
56px top bar) showing the couple name, ticking elapsed, and Stop. It
cannot be dismissed, so a forgotten timer stays visible.

One control at a time: the couple-profile overlay claims the timer surface
while open (`claimSurface()`), which hides the pill, because the pill's
corner is where that overlay puts its ✕. Closing the profile restores it.

**Stopping.** The session saves immediately, then a dialog asks what was
worked on: **Category first** (a `w-56` type-to-create picker, since it is
the one-tap decision) then a tall, fixed-size note (`resize-none`). Both
are optional and Skip keeps the session (annotate it later from the Time
tab). Nothing is ever lost by skipping. The dialog is `size="md"` (512px)
and every control in it, trigger, search field, rows, and note, uses
`text-body` so nothing reads as oversized against the labels. Category
create / rename / delete are optimistic, so the list never waits on the
server.

**Persistence.** The running timer is a row with `ended_at is null`, so it
survives reloads, tab closes, and device switches. Elapsed is measured
against the server clock (`server_now` at read time), never the device's.

**Runaway timers.** A session over 8 hours is clamped to `started_at + 8h`
on the next read, flagged `auto_stopped`, and the row shows
"Auto-stopped at 8h" for correction.

**Time tab.** Header shows the grand total ("4h 12m tracked") and, below
it, the breakdown bar. Rows are one
session each: date, category chip, note, duration, and a `⋯` for Edit /
Delete. A running row reads "Running", shows "from 2:14 pm", and has no
`⋯` (stop it from the pill or the header). Sub-minute durations render in
seconds, never `0m`.

Only a running row prints a clock time. A finished row is day plus
duration: manual entries are logged as a length, so their stored instants
are an anchor rather than a time the MC chose, and printing them back
would read as a record of when the work happened.

**Breakdown bar.** One thin horizontal stacked bar under the total, plus
a legend naming each segment with its duration and share. Part-to-whole
across a handful of categories, so a stacked bar rather than a donut:
proportion reads at a glance and it costs a row of the header instead of
a panel. The total stays a plain number beside it  -  a chart of a single
value is decoration, and the total is what the MC bills from.

Rules that keep it honest:

- **Nothing is drawn below two segments.** One segment is a solid block
  that says nothing the total has not already said.
- **Largest first**, tail past five folded into a neutral "Other", and
  **uncategorised always pinned last** in the neutral fill. Uncategorised
  is the actionable gap, not a category, so it never competes for the
  eye's first stop and is never folded away.
- **Colour is never the only carrier of identity.** Every segment has a
  legend row with its name, and each timesheet row repeats its category's
  dot beside the name. Three palette slots sit below 3:1 contrast on
  white, so those labels are what makes the bar accessible.

Colours come from the category, chosen by the MC through the same
`ColorPopover` branding uses (swatch on each picker row → hex field, hue
strip, eyedropper). Defaults are assigned from the validated categorical
order in `lib/time-tracking/colors.ts`, first unused slot wins, so a bar
is readable before anyone opens a picker.

**Add / edit time.** Date, duration, category, note. The form asks how
long the work took, not when it started and stopped: someone writing up a
venue walkthrough that evening knows "about an hour and a half", and
reconstructing "2:10 to 3:40" is arithmetic in service of two numbers the
timesheet never shows. Duration is a quarter-hour stepper either side of a
free-text field that reads `90`, `1h 30m`, `1:30` and `1.5h`, normalising
to `1h 30m` on blur. Stepping from an off-grid value snaps onto the grid
(1h 07m − → 1h). Zero is not saveable, so Save stays disabled until the
field parses.

The row still stores two instants, because the live timer produces them
and every total is computed from them. The form anchors rather than asks:
editing keeps the session where it sat and moves only its end, so
correcting a duration never silently reschedules the work; a new entry
ends at the current time of day on the chosen date.

Every control in the form is `text-body` on `rounded-control`, 32px
tall, including the date trigger (`DatePicker size="sm"`), whose calendar
matches the trigger's width rather than inflating with it.

**Shadow mode.** All timer controls are hidden while an admin is
impersonating, so a support session cannot write onto the MC's timesheet.
The Time tab still shows their existing sessions.

The **Templates** tab (Mail icon, after Automations) is where the MC
emails this couple. Header has two actions: **Send email** (compose from
a saved template → sends to the couple) and **Test template** (same
compose, but sends to the MC's own inbox with a `[Test]` subject, not
logged). Below is the sent-history  -  newest first, each row showing
subject, source template, recipient, a status pill, and relative sent
time (calm card list mirroring Automations). Backed by `couple_emails`;
the send route logs a row on each real send. (The "Send email" entry
point moved here off the Overview's General section.)

**Overview tab (default):**
- Two-column grid on `lg+` (`grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16`), stacks to 1-col on mobile
- Left: General info (Phone, Email, Lead Source inline editable fields) + Package (inline editable Popover of the MC's non-archived packages with name + price, mirroring the Lead Source row; shows what the couple picked in the portal and lets the MC set/override/clear it via a plain RLS update to `couples.selected_package_id`, added 2026-08-19; `couple-package-selector.tsx` on the shared `use-packages` hook). The Package row is **always rendered**, reading "None selected" when the MC has packages but this couple has none, and "No packages yet" only when there are none to choose from: a field that hides itself is undiscoverable. A package can also be chosen up front in the Add/Edit Couple modal, so it does not have to be set as an after-the-fact override. The row is presentational: it reports the chosen id and the couple's single update path persists it, the same as Lead Source.

**Adding a new editable column to `couples` means adding it to `useUpdateCouple`'s payload too.** That mutation sends an explicit field whitelist, and `updateCoupleAction`'s schema defaults any missing field to null and writes it, so an omitted column is erased rather than left alone. `selected_package_id` shipped missing from that list and every save silently cleared the package the MC had just picked. + Notes textarea (4 rows default, 6 rows when focused)
- Right: Events list + Vendors/Contacts list

The client portal's Overview section mirrors this with a couple-facing "Your
package" selector (`app/portal/[token]/package-selector.tsx`, rendered only
when the MC has non-archived packages): a dropdown of packages with formatted
totals, saving through the token-gated `save_portal_package` RPC with inline
Saving/Saved/error feedback and fed by `get_portal_packages`.

**Payments tab:**
- Invoices list for the couple, with a "+ New Invoice" button opening the builder in couple context
- Invoice due date hidden on mobile (`hidden sm:inline`) to prevent row overflow

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
- Package (select, optional  -  the MC's non-archived packages with name + price, same Popover pattern as Lead Source; writes `couples.selected_package_id` through the create and update actions, added 2026-08-19)
- Notes (textarea, optional)

Note: Event Date and Venue fields are managed exclusively via the Events tab. The couple modal does not expose these fields for editing.

---

# Calendar Page (Scheduler Phase B / E)

Route: `/calendar`

Purpose: View the MC's couples' events and confirmed bookings on a calendar, manage meeting types, and configure personal availability.

## Layout

Four tabs at the top: Calendar | Meeting types | Availability | Bookings

The Calendar, Meeting types, and Availability tabs toggle main-panel content while keeping the sidebar. The Bookings tab renders a full-height list (no sidebar switch).

`PageHeader` shows the title alone. On the Bookings tab it also carries a **Share booking link** action: one active meeting type copies its link straight to the clipboard, several open a menu to pick which link, none renders the button disabled.

## Which timezone the grid draws on

`user_public_settings.timezone` is nullable with **no default**, and nothing
seeds it at signup: it stays null until the MC first saves on the Availability
tab, which writes the rules and the zone in the same action. So "rules exist"
implies "timezone saved", and a null zone always means a brand-new MC.

Every surface resolves it through `useMcTimezone()`
(`app/(dashboard)/calendar/use-mc-timezone.ts`):

**saved zone → browser zone (`useBrowserTimezone()`) → `UTC`**

UTC is the last resort only. The grids previously each inlined
`availability?.timezone || 'UTC'`, so a new MC's connected calendar was drawn on
a UTC clock — ten hours out in Sydney — while the Availability tab showed them
their browser zone and made the setting look already correct. The zone sets
`dayStart` (`getLocalDayStart`), which is what every busy block, booking chip and
availability band is positioned against, so getting it wrong moves every event
on the grid.

Note the public slot engine keeps its own server-side default of
`Australia/Sydney` (`lib/booking/availability.ts`) because there is no browser to
read. That cannot affect a real booking: with no rules there are no slots, and
rules never exist without a saved zone.

## Calendar connection states

An MC can connect Google/Outlook from here as well as from Settings → Public Page → Calendars; both routes share `useCalendarConnections()` so they can never disagree. Connecting from here passes `return=calendar`, so the consent round trip lands back on `/calendar` with a toast.

**Nothing on this route is blocked by a missing connection.** Scheduling on Zebri data alone stays supported; the MC just should not discover the trade-off by accident. What silently degrades without one: the grid shows no external busy blocks, offered slots ignore the MC's real calendar, confirmed bookings never reach it, and `video` meeting types produce no join link.

- **Banner** above the tabs, visible from all four. Absent when a healthy connection exists, and while the query is still loading so it never flashes in. Two variants: never connected ("No calendar connected. Bookings won't check your real calendar for clashes.") and errored ("Your calendar connection stopped working…"). These read differently on purpose: telling a first-time MC their calendar "stopped working" is nonsense.
- **Calendar tab** shows an inline prompt above the grid when the connection list is empty: "Only Zebri bookings are shown here." Mutually exclusive with the sidebar's existing "could not be reached" warning, which means *connected but unreachable*.
- **Meeting types tab** warns when an **active** `video` type exists and no calendar is connected, because that gap is visible to the couple: they get a "Video call" confirmation with nothing to click.

When a booking is confirmed while the MC has no connection, `booking_created_without_calendar` fires to Slack. The public booking page itself is unchanged.

## Tab 0: Calendar

MC's calendar with multiple views and a detail panel for managing bookings.

**Views:** Three view modes (day/week/month) selectable via dropdown or mobile letter buttons (D/W/M). Day and Week show hourly time grids; Month shows a date grid.

**Header controls:** Today, prev/next, the period label, a **Statuses** filter and the view switcher.

The Statuses filter narrows the **wedding** layer to couples in the ticked statuses. It never hides a booking or an external busy block: those are commitments the MC has already made, and hiding one is a way to double-book. Unticked state is `null` (no filter) rather than an empty set, so a fresh MC sees everything and unticking the last status shows nothing rather than silently resetting. The first toggle seeds the set from every configured status, so unticking one leaves the rest on.

There are **no** per-layer visibility toggles (Bookings / Weddings / Busy). They were removed for the same reason: the three switches only offered new ways to miss something.

**Sidebar:**
- Mini-month navigator with clickable dates (moves the main view)
- Selected day agenda: lists that day's bookings and weddings in time order; clicking a booking or wedding row opens the detail panel or couple profile respectively

**Day View (24-hour grid):**
- Time column on left (00:00-23:59, 1 hour per row)
- Single wide column showing bands and chips in the MC's timezone
- All-day band at top (wedding events)
- Availability shading (MC's availability windows as a tinted background)
- External busy blocks (Google/Outlook calendar events, with titles visible on dashboard only)
- Booking chips (brand-colored, overlap-layout managed by grid engine, cancelled state muted)
- Current-time indicator (red line at the present moment)
- Legend showing availability, busy, and booking swatch meanings

**Week View (24-hour grid):**
- Time column on left, seven day columns (Mon-Sun in MC's timezone local-midnight-based week)
- Column headers fixed above scrolling grid with day numbers (derived in MC's timezone, not UTC)
- All-day band at top (weddings only)
- Same availability shading, busy blocks, and booking chips as Day view
- Current-time indicator spans all columns
- Legend visible at top

**Month View (date grid):**
- Six-week calendar grid (ISO week starting Monday if partial weeks included)
- Day cells show couple names and wedding count (no time precision)
- Click a day to navigate the sidebar agenda (does not switch to Day view)
- No time grids; couples-era filtering and search still present

**Booking detail modal** (opened from a calendar chip, the sidebar agenda, or a Bookings row):

Laid out like the quote and invoice builders, so a booking reads as one of the app's documents rather than a one-off surface:

- `Modal` size `md`, standard header band: the word "Booking" plus a status pill (Confirmed while it is live, Done once it has ended, Cancelled when called off), then **Join** and **Copy link** as the contextual `headerActions` beside the close. Both appear only when `video_join_url` is set and the booking is live, and both act on the same call: one takes the MC into it, the other puts the link on the clipboard to pass on.
- Body opens with a `text-section` hero, "{meeting type} with {booker}", over one muted meta line: "Fri 21 Aug 2026 · 4:30pm–5:00pm AEST · 30 min · video call" in the MC's timezone.
- Under it, the countdown ("Starts in 2 hours" / "Happening now" / "Ended 3 days ago", green while the meeting is still ahead). Cancelled bookings show no countdown.
- There is no add-to-calendar action: a confirmed booking is pushed to the MC's connected calendar when it is made, so offering a file would invite a duplicate event.
- **DETAILS** section, label-left / value-right rows in the couple-profile idiom, all about the booker: Name, Email (`mailto:`), Phone (`tel:`), Couple (a link into the couple profile, or "Not linked yet"), Booked ("18 Aug, via booking link" from `created_at`), and their timezone when it differs from the MC's.
- **THEIR NOTE** section renders the booker's `notes` as muted prose when there is one.
- Footer: **Cancel booking** (outline, behind `ConfirmDialog`, calls cancel_booking RPC) and **Reschedule** (outline, reveals a date + time form, calls reschedule_booking RPC). Both slots stay bordered controls in either mode, so the left button does not lose its edges when the modal flips into reschedule. A cancelled booking gets no footer.
- A failed action keeps the modal open and shows the error; a successful one invalidates the `bookings` query and toasts.
- Close (X), backdrop, or Escape to dismiss. Uses the shared `useOverlay` depth-aware state so it nests correctly over the couple profile.

**Design:** Tailwind tokens only. Times rendered via `getLocalDayStart`, `zonedDateParts`, and `zonedTimeToUtc` from `lib/scheduling/timezone.ts`, composed in `lib/calendar/timezone.ts`. Grid layout managed by `bandGeometry` and `layoutOverlaps` in `lib/calendar/grid-layout.ts`. Grid window (viewport slice) handled by `lib/calendar/grid-window.ts`.

## Tab 2: Meeting Types

Bookable meeting types library. CRUD interface.

Header: "Meeting Types" title + "+ New meeting type" button (opens modal).

List of meeting types (table or card grid):
- Name + description
- Duration + location type (Video / Phone / In person)
- Copy booking link icon (copies `${origin}/book/<share_token>` to clipboard; Phase C public page ships later)
- Edit icon (opens modal)
- Delete icon (with confirmation)

**Add/Edit Meeting Type Modal:**

Fields:
- Name (text, required)
- Description (textarea, optional)
- Duration (minutes, 5-480, required)
- Location type (radio or select: Video | Phone | In person, default Video)
- Address (text, shown only when In person selected, optional)
- Buffer before (minutes, 0-240, default 0)
- Buffer after (minutes, 0-240, default 0)
- Minimum notice (hours, 0-720, default 24)
- Maximum advance (days, 1-365, default 60)
- Reminder enabled (toggle, default on)
- Active (toggle, default on)

**Availability section** (bottom of the modal):

- A "Use my standard hours" toggle, on by default. On, the type follows the weekly hours from Tab 3.
- Off, a compact seven-row weekly grid appears (short day names, one on/off switch and one or more windows per day, an add-window button per row) plus a footer showing the weekly total and a reminder that date overrides still apply.
- The grid is seeded from the MC's standard hours, so switching to custom starts from something real rather than an empty week that would quietly make the type unbookable.
- Custom hours REPLACE the standard hours for that type: they can open times the standard week excludes, and a custom schedule with every day off means the type is never bookable.
- Date overrides stay user-level and are not editable here; a blocked wedding day blocks every type.
- Saved as `meeting_type_availability_rules` rows plus `meeting_types.uses_custom_availability`. The card shows "custom hours" beside the duration for a type on its own schedule.
- Saving from the modal always writes the hours. Other callers (the card's pause switch) omit the availability payload entirely, which leaves the stored hours untouched.

Actions: Save | Delete (edit only)

## Tab 3: Availability

MC's weekly availability + date overrides. Timezone-aware editor.

**Action bar** (above both cards):

- Left: timezone button showing the current IANA zone (e.g. 'Australia/Sydney') with a globe icon. Opens a searchable modal listing every zone the runtime knows, each with its current GMT offset and a tick on the selected one. The search field is **not** focused on open, so the modal reads as a list you can browse rather than a field you must type into; clicking it and pressing Enter still picks the top match. The list is a fixed height so the modal does not resize as matches are filtered.
- Right: **Add an override** (opens the override modal), **Discard** (only while the weekly editor is dirty), **Save changes** (disabled until dirty).
- Timezone is populated from the browser on first visit and persists to `user_public_settings.timezone`.

**Weekly hours card:**

Header row: "Weekly hours" plus two bulk actions, **Copy Monday to weekdays** (applies Monday's windows and on/off state to Tue-Fri, leaving the weekend alone) and **Clear week** (switches every day off; still needs Save, so Discard undoes it).

These are the MC's **standard** hours, used by every meeting type except those switched to their own schedule in the meeting-type modal (Tab 2).

Mon-first seven-day rows. Each row: a `Toggle` for the day, the day name, its time windows, the day's total hours, and an add-window button. A day switched off reads "Unavailable" and shows no hours; its windows are retained in state, so switching it back on restores what was typed.

Actions per day:
- Add window (+ button at the end of the row)
- Edit window (TimeSelect at each end of the window)
- Delete window (X per window, shown once a day has more than one)

Footer row: "Times are in {timezone}. Couples always see their own timezone." and the total, "{n}h bookable".

Windows display as 12-hour labels over "HH:mm" values. All windows across all enabled days persist as availability_rules rows.

**Date Overrides:**

Card below the weekly hours: "Date overrides", subtitled "These beat the weekly hours for that date".

List of overrides with date ("Sat 12 Sept"), status (Blocked / "9:00 AM to 5:00 PM"), and delete icon behind a ConfirmDialog. Empty state invites adding one.

Adding happens in the **Add a date override** modal (opened from the action bar), a `md` modal matching the meeting-type and timezone ones on this page: date picker, "Block the whole day" checkbox, and a time window when unchecked (each end taking half the row), with a line explaining what the choice does. The hours row stays mounted and the explanation keeps one line reserved, so ticking the checkbox never resizes the modal under the cursor.

Each override is one availability_overrides row (available=true for custom window, available=false for blocked day).

**Interaction / Save semantics:**

- **Weekly hours are buffered.** Edits accumulate in local state; Save changes writes them (replace-all), Discard reverts to the last saved snapshot. The dirty check compares flattened rules, so re-ordering which day was switched on first, or windows retained on a disabled day, do not count as changes.
- **Overrides save immediately.** Adding one from the modal or deleting one writes straight away, so those actions have no Save bar.
- Both paths toast on success and on failure.
- Changes persist across page reloads.

**Design:**

- `Toggle` primitive for the per-day on/off switch, `TimeSelect` for all time inputs (24-hour "HH:mm" value, 12-hour labels), `DatePicker` for override dates, `Card` for both sections, `Modal` for the timezone picker and the override form.
- Pure helpers (week transforms, hour totals, dirty check, labels) live in `availability-utils.ts`; the tab is an orchestrator.
- Minimal form styling, tokens only.

## Tab 4: Bookings

Every meeting an MC has taken through a booking link, as one full-height list that runs to the bottom of the page and scrolls inside itself.

**Toolbar:** a segmented switcher (Upcoming | Past | Cancelled) with the row count beside each label, and a search box on the right matching booker name or couple name.

- **Upcoming**: confirmed bookings that have not finished yet, soonest first.
- **Past**: bookings whose `ends_at` is behind now, most recent first. A booking is history once it has ended, even though the status stays `confirmed`.
- **Cancelled**: anything with status `cancelled`, most recent first.

**List:** one bordered card holding day bands and their rows.

- Day band: sticky heading, e.g. "Today · Fri 21 Aug" ("Tomorrow · …" for the next day, a plain date after that) plus "N bookings". Grouping happens in the MC's timezone, so a 9am Sydney booking never lands on the previous day.
- Row: start time (tabular, MC timezone) · booker name over "{meeting type} · {duration} min · {location}" · "Couple: {name}" or "New enquiry" (hidden below `md`) · status pill · chevron. Today's rows carry a `bg-success/5` tint on the Upcoming filter. Clicking a row opens the booking detail modal.
- Closing line "Nothing else booked yet." under the last row of an unfiltered Upcoming list.

**States:** `BookingsSkeleton` while loading, `ErrorState` on failure, and a per-filter `Empty` ("Nothing booked yet" / "No past bookings" / "No cancelled bookings"). Searching with no match says so instead, so an empty result never reads as an empty diary.

**Design:** the tab is an orchestrator; `bookings-toolbar.tsx`, `bookings-list.tsx` and `booking-row.tsx` own the layout, and every date, time and countdown string comes from `booking-display.ts` so the list and the modal cannot drift apart.

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

Purpose: Unified hub for managing invoices and contracts. The MC can view, create, and edit both in one place with tab-based navigation.

Header: Title "Payments" + two tabs: **Invoices** | **Contracts** (Invoices is the default tab). The active tab is the `PaymentsTab` type (`'invoices' | 'contracts'`, in `use-payments-shortcut.ts`). Search bar + "New Invoice" / "New Contract" button (label changes based on active tab). Pressing `/` outside an input focuses the search box; Escape clears it.

Invoices are fully **manual**  -  the MC builds each one by hand (optionally starting from a saved invoice template or package). Nothing seeds an invoice or a payment schedule automatically; signing a contract does not create an invoice.

**Composition (Phase 2C decomposition):** `app/(dashboard)/payments/page.tsx` is an orchestrator that composes the following co-located sections:

- `payments-header.tsx`  -  title row, search toolbar, tab strip.
- `payments-table.tsx`  -  shared desktop-table / mobile-list primitive consumed by both tabs.
- `payments-footer.tsx`  -  fixed bottom count + (for invoices) money total.
- `invoices-list.tsx`, `contracts-list.tsx`  -  per-tab row mapping + status pill catalogues.
- `use-payments-data.ts`  -  React Query hooks for the two lists.
- `use-payments-shortcut.ts`  -  `PaymentsTab` type + `/` keyboard shortcut + Escape-to-clear.

## Invoices Tab

Table Columns (matching couples/vendors style):
- Number (invoice #, gray text)
- Title
- Couple (name)
- Status (badge: gray=draft, blue=sent, emerald=paid, red=overdue, gray=cancelled). "Overdue" begins the day *after* `due_date`  -  an invoice due today is not yet overdue (derived via `isPastDue` in `@/lib/utils`; same boundary the A4 `invoice_overdue` automation uses).
- Total (right-aligned, currency formatted AUD)
- Due Date (right-aligned, formatted date, red if overdue)

**Actions:**
- Click row → opens InvoiceBuilderModal for editing
- "New Invoice" button → opens couple picker dropdown, then InvoiceBuilderModal
- Search bar filters across: title, invoice number, couple name, status

**Empty state:** Invoice icon + "No invoices yet. Create one from a couple's profile."

## Modals

InvoiceBuilderModal is rendered on this page (and reused on the couple profile). **Phase 2C.2** redesigned it into a **two-pane layout**: edit form on the left, live preview on the right. The modal uses the `fullscreen` size (`max-w-7xl`) on desktop; below the `lg:` breakpoint (1024px) the panes stack vertically with the preview as a collapsible section below the form.

### Shared shell (`builder-modal-shell.tsx`)
- Top of the modal: document number (e.g. `INV-001`) + inline `StatePill` (the same tonal pill used on the Billing tab).
- Right side of the header: status-aware contextual primary CTA + `⋯` overflow menu for destructive / revert actions.
- Body: hero title input (large unbordered text  -  Notion-style) followed by the composed parts.
- Footer (spans both panes): `share-and-send` row (link affordance + Save + primary Send to couple). While the doc is still a draft, a subtle "Mark as sent" text button sits next to Copy link / Open  -  it flips the status draft→sent **without** firing an email (for MCs who shared the link out-of-band via SMS/WhatsApp). It leaves `email_sent_at` null, so the primary stays "Send to couple".
  - **When the link affordances appear.** They need a saved row (the share token is generated on insert). Opened from the couple profile the row already exists, so Copy link / Open / Mark as sent are there from the first paint. Opened from `/payments`, "New invoice" starts an unsaved draft with no row and no token, so the footer shows only Save + Send to couple; the builder adopts the id its first save returns, and the link affordances appear in place without reopening the modal. The contract builder behaves the same way.
- New `previewPane` prop carries the right-side preview content. When provided, the shell switches to a 2-column grid (`grid-cols-1 lg:grid-cols-2`) and the modal upgrades to `fullscreen` size.

### Preview pane (`builder-preview-pane.tsx`)
- Header row: `<` collapse toggle + "Preview ⓘ" + tabs (PDF · Email · Payment page).
- Sub-header: "Branded as {Business Name} · Update branding ↗"  -  the link opens `/branding` in a new tab so the user can tweak + come back without losing the modal.
- Three tabs, each rendering live (the form state flows directly into the preview every render):
  - **PDF**: `<PreviewPdf>`  -  renders the same HTML that `buildPdfHtml()` produces for the print dialog, inside a sandboxed iframe.
  - **Email**: `<PreviewEmail>`  -  `From/To/Subject` envelope above a sandboxed iframe carrying the templated email body (`invoiceHtml()` from `@/lib/email`).
  - **Payment page**: `<PreviewPaymentPage>`  -  uses the same `PublicBlockRenderer` the public `/invoice/[token]` route uses, fed by `useCurrentBranding(surface)`. Pixel-faithful preview of what the couple sees.
- The pane is collapsible  -  clicking the `<` chevron toggles a slim vertical bar with a `>` chevron to expand again. Useful when the MC wants to focus on just the form.

### Branding integration (`useCurrentBranding`)
- New hook at `lib/branding/use-current-branding.ts` fetches the user's branding from `user_metadata` + the `user_branding` table, assembles a `PublicBranding`-shaped object the renderer consumes.
- Falls back to the `minimal` theme preset for any unset fields.
- `buildPublicBranding(metadata)` is pure + exported for tests.

### `InvoiceBuilderModal`
- Meta row: couple picker + payment terms (Net 7/14/30/due-on-receipt/custom) + due date. Net terms auto-fill the due date.
- **Template picker**: prominent "Start from template" card above the items area when the invoice is empty; collapses to a smaller "Apply template" link in the items header once items exist. Sources are the MC's invoice templates + packages.
- Line items table: description + amount only (quantity removed in 2C.2  -  `saveInvoiceAction` writes `quantity = 1, unit_price = amount` for forward compat with the existing schema).
- "+ Add discount" / "+ Apply 10% GST" link buttons below the items, expanding inline when configured. Totals panel: Subtotal · (optional Discount) · (optional GST 10%) · **Total** (bold). The tax rate and the "Prices include GST" note are mutually exclusive in `TaxControl` (2026-08-19): ticking the note clears and disables the rate, and a set rate disables the note, because the rate is always added on top and combining the two double-charged GST. The exclusion reacts to the **typed draft**, not the committed value, so the checkbox enables and disables as the MC types or clears the rate rather than only after Done.
The invoice's delete and cancel confirmations render through the shared
`ConfirmDialog`, which portals to `document.body` (2026-08-19). Without that
it stayed a DOM descendant of whatever mounted it, so a confirm raised from
an invoice opened inside the couple profile was trapped in that overlay's
stacking context and painted behind the invoice modal despite its `top` tier.

- **Payment schedule**: vertical timeline. `● Deposit ─┊─ ○ Final` with state pill + amount + due date + inline "Mark paid" affordance per stage. Filled dot when paid, hollow when due. "+ Add payment schedule" link button when none is configured. Unpaid stages render their due date as an inline `DatePicker` (2026-08-19) so the MC can overwrite the template-computed date per payment; paid stages stay locked, and reapplying a template recomputes all dates. The schedule combobox opens on input click/focus (not just the chevron), typing filters saved schedules, and an unmatched name offers a Notion-style "Create '<typed>'" row that seeds the schedule modal with that name.
- **Card payments toggle**: only visible if `stripeConnectEnabled(user)` is true (read via `@/lib/auth/entitlements`  -  `app_metadata.stripe_connect_enabled`; never the user-writable `user_metadata`). Toggle + helper text in a token-styled row.
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
- `saveInvoiceAction(input)`  -  Zod-validated, RLS-scoped, transactional (replace-line-items pattern), plus payment schedule fields + `quantity=1`/`unit_price=amount` invariant.
- `deleteInvoiceAction(id)`  -  RLS-scoped destructive.
- Status mutations (mark sent / mark paid / revert / cancel) remain inline one-line UPDATEs in the modal  -  they don't justify their own server actions. "Mark sent" flips a draft to `sent` + ensures `share_token_enabled`, without sending an email.

## Couple Profile Integration

- Couple Profile "Invoices" tab: Shows couple's invoices, "+ New Invoice" button opens modal in couple context
- Rows can be clicked to open the modal for editing

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
full page) styled to match the Couple Profile overlay  -  centered
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
sidebar; mobile ≤ sm: horizontal scrollable pill row)  -  same pattern
as `couple-profile-nav.tsx`. Active tab driven by `?tab=` search
param (deep-linkable; tab clicks `router.replace` it), default
`personal-info`. Legacy `?tab=branding` / `?tab=portal` redirect to
`/branding`; `?tab=templates` redirects to `/templates`.

Tabs:

### Personal Info (`?tab=personal-info`)

Fields: Display Name, Business Name, Phone, Avatar URL

**Auto-saves**  -  no Save button. Text fields persist on blur; the
business-type picker and address selection persist on change (writes
`user_metadata` via `auth.updateUser({ data })`  -  user-owned fields,
not entitlements). A change to the email field is the one case that
toasts (a confirmation link is sent; it isn't live until confirmed).
A calm inline "Saving… / Saved" hint (`auto-save-status.tsx`) replaces
the button.

### Public Page (`?tab=public`)

Outward-facing config couples see. Persisted to `user_public_settings`
(one RLS-owned row per MC)  -  not `user_metadata`. Components:
`public-page-section.tsx` (orchestrator: subdomain + surfaces) and
`public-page-email.tsx` (the email subsection). Server actions live in
`app/(dashboard)/settings/public/actions.ts`.

**Zebri address (subdomain).** A branded slug fronting the public
surfaces (`name.zebri.com.au`). **Auto-saves on blur** via
`saveSubdomainAction` (same calm `auto-save-status.tsx` hint).
Normalised to a DNS-safe slug, reserved words rejected, and **globally
unique** (a partial unique index on `lower(subdomain)`; a clash returns
"already taken"). Today this is a stored preference and a preview list  - 
routing the subdomain to the app (wildcard DNS + tenant middleware) is a
separate infra task.

**Email sending.** Two modes, persisted in `email_mode`, available on
every plan (no gate):

- **Send from Zebri** (default): mail goes from the shared Zebri address
  via Resend. Works instantly, no setup.
- **Connect your own email** (OAuth  -  Gmail or Outlook): the MC clicks
  "Connect Gmail" / "Connect Outlook" and authorizes. Connecting is the
  redirect flow in `app/api/oauth/{authorize,callback}`  -  `authorize`
  pins a CSRF `state` in a signed httpOnly cookie and 302s to the
  provider's consent screen; `callback` verifies the state, exchanges the
  code (`lib/oauth/tokens`), looks up the connected address, encrypts the
  tokens (`lib/crypto/secret-box`, AES-256-GCM), and persists
  `oauth_status = 'connected'`. `disconnectMailboxAction` revokes + clears.
  The tokens are never returned to the client.

At send time every couple-facing email resolves its transport via
`resolveSender` (`lib/email/sender-identity`) → `dispatchEmail`
(`lib/email/dispatch`): the MC's mailbox via the **Gmail API** /
**Microsoft Graph** when `email_mode = 'oauth'` **and**
`oauth_status = 'connected'` (the access token is auto-refreshed when
expired), otherwise the shared Zebri address over Resend (fail-safe  -  any
lookup/decrypt/refresh error never blocks a send). Sending through the
MC's own mailbox means mail lands in their Sent folder and replies come
back to them, at no per-MC cost to Zebri.

Note: Gmail's `gmail.send` is a Google *restricted* scope  -  usable
unverified for <100 connected accounts, then needs Google verification +
a CASA assessment. Microsoft's `Mail.Send` has no equivalent gate. The
Google Cloud OAuth client + Azure app registration are operational
prerequisites (`.env.example`).

### Lead Capture (`?tab=lead-capture`)  -  ZEB-2

An embeddable enquiry form the MC puts on their own website; submissions
create couples automatically. Component: `lead-capture-section.tsx`
(self-loads via the `ensureLeadForm` server action, which lazily creates
the one-per-MC `lead_capture_forms` row on first open). Server actions:
`app/(dashboard)/settings/lead-capture/actions.ts`
(`ensureLeadForm`, `saveLeadCaptureSettings`).

Controls:

- **Form enabled** toggle (`lead_capture_forms.enabled`). Off stops the
  public form (`get_lead_form` returns null → "Form unavailable").
- **New leads land in**  -  a `Select` of the MC's `couple_statuses`; the
  chosen slug is `target_status_slug`. "Top of pipeline (default)" (a
  sentinel, not `value=""`) leaves it null → first status by position.
- **Three copy blocks:** hosted link (`{origin}/lead/{token}`), iframe
  embed (`?embed=1`), and a JS snippet
  (`<script src="{origin}/lead-embed.js" data-zebri-form="{token}">`  -  a
  static loader in `public/lead-embed.js` that injects the iframe and
  auto-resizes it from the form's `postMessage` height).

**Public form  -  `/lead/[token]`** (`app/lead/[token]/page.tsx`, client
orchestrator). Loads `get_lead_form` via the anon client, applies the
MC's `_user_branding` scalars, and renders `lead-form.tsx` with explicit
loading / submitting / success / error states plus an "unavailable" card.
Fields: your name (required), partner's name, email (required), phone,
wedding date, venue, "how did you hear about me?", message, a hidden
honeypot, and a render timestamp. Submits to `POST /api/lead/submit`
(rate-limited, honeypot + timing bot check, then the `submit_lead` RPC;
the MC is emailed on success). `?embed=1` strips the page chrome for
iframe embedding. Works on desktop + mobile.

**Website form branding surface (block-based, 2026-08).** The form is
also a `lead` branding surface ("Website form" tab) in the branding
editor, designed from blocks like every other surface. The surface is
enabled by default: `resolveEnabledSurfaces` (in
`lib/branding/enabled-surfaces.ts`) treats a missing `lead` key in
`user_branding.enabled_surfaces` as on, so existing accounts see the tab
without re-onboarding; only an explicit `lead: false` (written when the
MC toggles it off) hides it. It also appears as a toggle in the branding
onboarding wizard's documents step, on by default. General blocks
(business name, text, image, divider, spacer, tagline, footer) plus two
document-specific blocks: `formField` (a configurable input, one per
field, with a `role` + `inputType` + required flag; `role='select'`
carries options) and `formSubmit` (the singleton submit button). The
add-block palette lists each enquiry question as its own ready-made
entry (Your name, Partner's name, Email, Phone, Wedding date, Venue,
How did you hear about me?, Message, plus Custom question): all are
`formField` presets (`PaletteEntry.preset` in `blocks-by-surface.ts`),
not distinct block types, with required preset on name + email. The
submit block has an after-submit choice (`successMode`): show
`successMessage` in place of the form (default) or redirect to
`redirectUrl` (the MC's own thank-you page, e.g. for conversion
pixels). Only http(s) URLs are honoured (`successRedirectUrl` in
`lib/lead-capture/block-fields.ts`); the redirect navigates the top
window out of the iframe embed, falling back to the message if blocked. Readiness (`NotReadyPanel`) nags when
the form has no field, no submit, no Name question, or no Email
question, in question vocabulary: "At least one question for the
couple to answer", "A Submit button", 'A "Your name" question', and
'An "Email" question'. Selected
`formField` blocks title their toolbar by their question label
(`blockDisplayName` in blocks/types.ts), not the generic type name. The default block
tree mirrors the fixed-field fallback form exactly: same eight
questions, same order and labels, required matching what the couple
must fill in (name + email). The submit block renders through the shared
`RenderFormSubmitButton` (editor preview and public form alike),
styled like the action block's primary button: block overrides for
colour, radius, variant, size, alignment, and width fall back to the
brand's global button settings. The after-submit behaviour is
configured in the labelled toolbar controls (Button label / After
sending on one row, Success message or Redirect URL full-width on the
next, then the style row). Field controls are
labelled too (Maps to / Input type / Question / Placeholder). `get_lead_form`
returns the saved `lead` block tree; the public page renders it, mapping
each `formField` answer to a couple column by `role` and folding
`role='custom'` answers into the couple notes. Every submission is also
stored in `form_submissions`. When the MC has not customised the form,
the public page falls back to the fixed enquiry field set above.

### Signature (`?tab=signature`)

Listed **below Public Page** in the nav. A single reusable **email
signature** edited in a Gmail/Outlook-style rich editor
(`signature-editor.tsx` + `signature-toolbar.tsx`): font family (a
preview-in-its-own-font dropdown of web-safe families), font size, bold /
italic / underline, text + highlight colour (the shared branding
`ColorPopover` with swatches + hex + eyedropper, now at
`components/ui/color-popover.tsx`), link, image, alignment, and lists.
Links auto-normalise a bare host (`test.com.au` to `https://test.com.au`)
so they are absolute, not app-relative. Images upload to the public
`branding` bucket and can be **resized** (drag handle) or **deleted**
(hover control) via a NodeView (`signature-image-view.tsx`); the chosen
width persists into the rendered email. The editor content uses the
shared `.contract-content` styles, so lists, links, and headings render
the same as the contract / template editors. No template variables inside
it. The editor and the server-side email render share one extension set
(`lib/email/signature-extensions.ts`) so stored JSON round-trips. Toolbar
popovers render at `z-[70]` to sit above the `z-[60]` Settings modal.
**Auto-saves**: a debounced save 800ms after the last edit, with a blur
out of the editor as an immediate backstop; both go through one
idempotent save that no-ops when nothing changed, persisting the TipTap
JSON to `user_metadata.email_signature` via `auth.updateUser({ data })`.
The editor ignores parent re-renders that echo its own emitted value, so
typing can't flick back to a saved version. Same calm
`auto-save-status.tsx` hint as Personal Info.

Templates drop the whole signature in with the **Your email signature**
variable (`{{mc.signature}}`): rich HTML when used in an email body,
flattened text in a subject. An empty signature renders to nothing and
never blocks a send (it is exempt from the missing-variable gate). See
`lib/email/templates.ts` for the rendering path.

### Account (`?tab=account`)

Change password + email preferences + danger zone.

- **Change password**  -  explicit `Change password` button (security
  action: requires the current password; not auto-saved).
- **Email preferences**  -  toggles **auto-save** immediately on change.
- **Danger zone**  -  explicit `Delete account` button (destructive).

### Plans & Billing (`?tab=billing`)

Document-style layout. Section labels + thin dividers, no nested
cards. Composition:

- **Plan section**  -  `CurrentPlanCard` (plan name + state pill +
  inline price + meta line + prose summary + action row + Starter
  usage when applicable).
- **Billing history** section  -  `BillingHistory` (last 12 invoices
  via `/api/stripe/billing-history`; skeleton on load, hidden when
  empty + no upcoming charge).
- **Plan comparison**  -  `PlanComparisonDialog`, opened from
  "Change plan" / "Upgrade". 3-column feature table with absolute-
  positioned tint behind the current plan's column.
- **Cancel confirmation**  -  `CancelConfirmModal`, state hoisted to
  `BillingSection` so both the card and the comparison dialog
  trigger it via `onRequestCancel`.

| CardState                  | StatePill          | Primary action          | Meta line          | Cancel link |
| -------------------------- | ------------------ | ----------------------- | ------------------ | ----------- |
| `starter`                  | "Free plan"        | Upgrade to Pro          | "Joined {date}"    |  -            |
| `active`                   | "Active" (green)   | Change plan             | "Renews {date}"    | ✅          |
| `cancelling_in_grace`      | "Cancelling"       | Resubscribe             | "Access until {d}" |  -            |
| `past_due`                 | "Payment failed"   | Update payment          | "Joined {date}"    |  -            |
| `expired`                  | "Ended"            | Upgrade to Pro          | "Ended {date}"     |  -            |
| `comped`                   | "Comped" (green)   | (no action row)         | "Joined {date}"    |  -            |

Server actions in `app/(dashboard)/settings/billing/actions.ts`:

- `createPlanChangeSessionAction(plan)`  -  Stripe Portal deep-link
  `subscription_update_confirm`.
- `cancelSubscriptionAction()`  -  Stripe API `cancel_at_period_end:
  true` + synchronous `app_metadata` write of
  `subscription_end` (UI doesn't wait on the webhook).
- `resumeSubscriptionAction()`  -  symmetric undo.
- `paymentMethodPortalAction()`  -  Stripe Portal deep-link
  `payment_method_update`.

All four actions are rate-limited per-user (5/min/user) via
`STRIPE_RATE_LIMITS`. Hits fire `stripe_rate_limit_hit` with the
specific action name.

After every cancel/resume, `BillingSection`'s polling effect (the
same one used after Stripe Checkout) watches `app_metadata` and
reloads when the webhook lands. Manual "Refresh" escape hatch
appears after 60s  -  covers the local-dev "did you start
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

**Bank details**  -  Account name, BSB, Account number inputs. **Auto-save on blur** (no Save button)  -  updates `user_metadata` (user-owned fields  -  `bank_account_name`, `bank_bsb`, `bank_account_number`), with the shared inline "Saving… / Saved" hint. Helper text: "These details will be auto-filled in the Notes field when you create a new invoice."

**Card payments**  -  "Connect Stripe" button (`window.location.href = '/api/stripe/connect'`). Once connected, shows "Connected" emerald badge + masked account ID + "Disconnect" ghost button. The Connect callback writes `stripe_connect_account_id` and `stripe_connect_enabled` to **`app_metadata`** via `updateEntitlements()` (entitlements, not user-owned  -  they govern access to the public Pay button). Disconnect clears those fields the same way.

### Packages (`?tab=packages`)

Placeholder empty state. Coming soon.

### Notifications (`?tab=notifications`)

Placeholder empty state. Coming soon.

### Privacy (`?tab=privacy`)

Inline Privacy Policy copy (`privacy-section.tsx`), mirroring
zebri.com.au/privacy. Shows a "Last updated" line and a canonical
"View the latest at zebri.com.au/privacy" external link. Read-only  - 
no actions. Shares the `legal-section.tsx` prose chrome with Terms.

### Terms (`?tab=terms`)

Inline Terms of Service copy (`terms-section.tsx`), mirroring
zebri.com.au/terms. Same `legal-section.tsx` chrome + canonical link
as Privacy. Read-only.

---

# Branding Editor

Route: `/branding`

Route group: `(dashboard)`

Purpose: A Canva-grade design tool for customizing the MC's brand kit and block-based document layouts across invoice, contract, client portal, run sheet, and questionnaire surfaces.

## First-Run Onboarding

Users who have never customized branding see a three-step wizard at `/branding/onboarding/`: **Business** (logo, name, tagline), **Look** (six role-based colours + typography + density), **Documents** (surface enablement). Wizard is gated by `onboarded_at` in user_branding; once complete, the editor shows normally. Users can re-enter onboarding via Settings.

The **Look** step collects exactly six colour pickers (no more, no less): Heading, Subheading, Body text, Background, Primary button, Secondary button. Density (cozy/compact) is shown but corner-radius is NOT a control in onboarding (frozen to defaults; users edit corner-radius in the editor's Global styles section only).

## Layout

Three-pane: **Header** (five surface tabs: Invoice, Contract, Portal, Run sheet, Questionnaire) + **Left rail** (brand panel with accordions + Documents panel) + **Canvas** (surface preview). Top-right has Preview button (opens surface in new tab) and Reset button (reverts current surface to template).

## Brand Rail (left sidebar)

1. **Your business**  -  Logo, favicon, business name, tagline, ABN, phone, website, Instagram/Facebook URLs.
2. **Brand colours**  -  Six role-based colour pickers (all required, no toggles):
   - **Heading colour**  -  for h1, h2, h3 across all surfaces; default: black (#111827)
   - **Subheading colour**  -  for section titles and secondary headings; default: black (#111827)
   - **Body text colour**  -  for paragraphs, regular text, and the muted label/metadata alias; default: grey (#6B7280)
   - **Background colour**  -  for page backgrounds and surface fills; default: white (#FFFFFF)
   - **Primary button colour**  -  for main CTAs (Accept, Pay, etc.); default: black (#111827)
   - **Secondary button colour**  -  for supporting CTAs (Decline, etc.); default: grey (#6B7280)
   Each role has a colour picker + hex input + suggested swatches from the uploaded logo.
   **Derived aliases** (no longer user-set): accent_color (≡ primary button), muted_color (≡ body text), secondary_text_color (computed from secondary button), page_background (≡ background colour).
3. **Link colour** (editor-only control)  -  hyperlink colour; defaults to primary button colour. Not shown in onboarding.
4. **Typography**  -  Per role (heading / body): font dropdown (30+ Google fonts), size, weight, colour, alignment, text case, letter-spacing, line-height. Overall scale slider.
5. **Global styles**  -  Corner radius, link colour, default button style, base line-height, section spacing, page background.

## Documents Panel (below brand sections)

Toggles to enable/disable individual surfaces. Only enabled surfaces render to their public endpoints. Disabled surfaces return null from get_public_* RPCs. Each surface has a quick-reset link ("Reset to template") that replaces its block tree.

## Canvas (right side)

Renders the selected surface with live sample data. Fixed-core blocks (contractBody, contractSign, couplePortal, questionnaire, vendorTimeline) are marked "Fixed layout"; chrome blocks (header banner, business name, text, image, spacer, divider, footer, action) are freely positioned above/below. (contractBody + contractSign are still selectable  -  they flow through BlockFrame so the MC can reach their style toolbars  -  but remain locked against delete/duplicate.)

Per-block toolbar (Canva-style): padding (per side), background colour, border (width/colour/radius), width, horizontal alignment, space above/below. Text-bearing blocks add font/size/weight/colour/alignment/case/letter-spacing/line-height. Block-specific controls (header overlay, action variant/size/radius, divider thickness, etc.) per type.

Blocks inherit global branding (colours, fonts, corner radius, spacing); text blocks allow per-block overrides.

Mobile responsive: on <md breakpoint, sidebar becomes sticky-scrollable, canvas stacks below. Canvas uses container queries to adapt block layouts gracefully on small screens without breaking fixed-core block logic.

## Public-Blocks Slots + Chrome Pattern

The **public renderers** (`components/public-blocks/*`) are the sole markup for each surface. The **editor** injects `InlineText` slots into key text nodes (e.g. business-name text, action button label) to make those fields editable inline on the preview. The editor's toolbar is an overlay chrome that sits above the public renderer without modifying its output.

Slots always render (no conditional gating). Editor slot classes (`edit-mode-*` prefixes) match the static renderers exactly. The `upload-brand-asset` shared helper handles logo/favicon/image uploads to Supabase Storage, returning a public URL synchronously cached.

## Customer Preview

"Preview" button opens `/branding/preview/[surface]` in a new tab via the public block renderers, exactly as customers see it. Device toggle allows mobile (<md) testing. Requires the surface to be enabled.

## Block Palette & Model

The block palette has two labeled groups:

**General blocks** (available on all documents): Text, Divider, Spacer, My details, Image, Tagline, Footer. The Footer block includes per-network toggles (Facebook, Instagram, Twitter, Pinterest, Website) that control whether each social link renders in the public footer. URLs come from account branding settings (not entered per block).

**Document-specific blocks** (surface-only): each document has explicit required and optional blocks. Required blocks can be deleted; deleting one raises a "Not ready to send" flag (a calm NotReadyPanel in the editor listing what is missing in plain language) until the block is re-added. A "Required" chip is informational.

**Deletable-required model**: the editor validates per-surface via two layers. Layer A (template validity) checks required blocks present, invoice at-least-one of Bank details/Pay CTA, and questionnaire mode chosen. Layer B (account prerequisites) checks Stripe Connect (for Pay CTA), bank details in settings (for Bank details), and contract template created (for Contract body). Layer B flags never block editing, only sending.

**Questionnaire mode**: the Questionnaire body block now persists `mode: 'form' | 'oneAtATime'` (replacing the preview-only toggle); public rendering reads this to show regular-form vs one-at-a-time.

**Payment schedule**: now optional on Invoice. The shared `action` block is the Invoice Pay CTA; it is **not** used on Contracts  -  the sign/decline form is its own `contractSign` marker block (see the Contract surface below), so no generic CTA block belongs there. `headerBanner` remains only in migration code.

**Contract sign block**: the sign/decline form + MC countersignature are the `contractSign` marker block. Its behaviour is fixed (name input, agreement checkbox, sign/decline calls, decline dialog, signing state machine  -  all untouched); the MC edits only its heading, Sign/Decline labels, button colour and heading/label typography. `contractBody` + `contractSign` are the two `CLEARABLE_MARKERS`. **Legacy safety**: contracts sent before this block have no `contractSign` marker, so the public card injects the sign slot right after the body (today's placement)  -  they render identically and stay signable.

## Five Surfaces

- **Invoice**  -  Invoice header, Invoice line items, Invoice totals, Payment schedule (optional), Bank details (required - at least one of Bank details/Pay CTA), Pay CTA (required - at least one)
- **Contract**  -  Contract header (Expires + Ref both off by default; reads as contract title + couple name), Contract body, Sign contract (the sign/decline form + MC countersignature). No generic Sign CTA block. Legacy contracts predating the sign block have no `contractSign` marker and get the form injected after the body instead.
- **Client Portal**  -  Portal body
- **Vendor Timeline**  -  Run sheet body
- **Questionnaire**  -  Questionnaire body with mode toggle (form | oneAtATime)

## File Structure

```
app/(dashboard)/branding/
  page.tsx                            -  orchestrator
  branding-editor.tsx                 -  editor state + autosave
  brand-panel.tsx                     -  rail sections
  business-section.tsx                -  Your business accordion
  blocks/
    render.tsx                        -  editor block renderers (including new Image, Spacer)
    block-toolbar.tsx                 -  per-block controls
    blocks-by-surface.ts              -  availability gating
    block-frame.tsx                   -  editor wrapper (applies padding/background/etc)
    render-image.tsx                  -  image block editor
    render-spacer.tsx                 -  spacer block editor
  templates/
    index.ts                          -  template catalogue
    templates-section.tsx             -  Templates accordion picker
  add-block-palette.tsx               -  Add block grouped palette

app/branding/
  preview/[surface]/page.tsx          -  customer preview route (auth, reads branding + sample data)

lib/branding/
  fonts.ts                            -  30+ Google fonts (FONT_IDS, FONT_LABELS, FONT_STACKS, GOOGLE_FONT_FAMILIES)
  type-defaults.ts                    -  TypeDefaults + resolveTypeDefaults (heading/body type resolution)
  block-outer-style.ts                -  blockOuterStyle(block, branding) pure helper (padding/background/radius)
  public-blocks/
    image.tsx                         -  public renderer for Image block
    spacer.tsx                        -  public renderer for Spacer block
```

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

Top-level sidebar page (`/templates`, `FileStack` icon)  -  the single
home for every reusable-template kind. **Tabbed** (`templates-tabs.tsx`,
underline tabs matching the Settings chrome):

- **Emails**  -  the email-template library (below); used by automations
  and the manual couple "Send email" flow.
- **Packages**  -  `PackagesManager` (reusable priced service bundles;
  table `packages` + `package_items`). Sits before Quotes because
  quotes/invoices are built from packages.
- **Quotes**  -  `QuoteTemplateManager` (reusable line-item sets; table
  `quote_templates` + `quote_template_items`). The editor's **"Add
  from package"** picker snapshots a package's line items in.
- **Invoices**  -  `InvoiceTemplatesManager` (reusable invoices; table
  `invoice_templates` + `invoice_template_items`). The editor's
  **"Add from package or quote"** picker snapshots a package's or quote
  template's line items in (referencing by copy, not live FK).

Both tabs are thin wrappers around the shared
`LineItemTemplateManager` (`line-item-template-manager.tsx`), which
owns the list, preview, edit modal, starters, and all mutations via the
kind-parameterised `template-store.ts` (injectable client, integration-
tested directly). Saves rewrite items wipe-and-reinsert style so a
drag-reorder inside the edit modal persists, and set `updated_at`
explicitly (no touch trigger on these tables). Search matches name,
subtitle, applied notes, and item descriptions.
- **Contracts**  -  `ContractTemplateManager` (`contract_templates`).

(A **Timelines** tab once lived here for reusable run-sheet item sets;
it was removed on 2026-08-02  -  every wedding is bespoke, so templated
run-sheets added no value. The core per-event timeline is unaffected.)

Tab order follows the money flow (packages → quotes → invoices build on
each other). Quotes / Contracts moved here out of
**Settings → Templates** (that tab is removed; `/settings?tab=templates`
redirects to `/templates`).

The couple-facing **quote and invoice builders** also reference these
templates: their "Apply package or template" picker (shared
`TemplatePicker`, fed by `useApplySources`  -  namespaced `it:`/`qt:`/
`pkg:` ids) snapshots a source's line items + notes into the document.
The quote builder offers quote templates + packages; the invoice
builder opts into invoice templates too
(`useApplySources({ includeInvoiceTemplates: true })`), listed first as
the most specific source. Applied notes always come from a source's
`description` column (customer-facing); the `notes` column is the
internal subtitle shown only in the Templates list and is never applied.

## Emails tab layout

- Header row: email subtitle + "New template" button (`size="sm"` with
  a `Plus` icon, matching the Couples "New couple" button).
- Library: a slim search box, then templates **grouped by the MC's own
  categories** (Notion-style, colour-dotted uppercase subheaders in the
  user's drag order, with a trailing "Uncategorised" bucket)  -  matching
  the calm couple-overview / automations surfaces. Each row shows name
  + rendered subject; whole-row click opens the editor. Search filters
  by name or subject and only non-empty groups render.
- **Categories** (`email_template_categories`): user-editable name +
  colour (8 named palette keys) + drag order. The editor's
  `CategoryPicker` selects, creates inline, and has an "Edit" mode for
  rename / recolour / delete / reorder without leaving the modal.
  Deleting a category uncategorises its templates (FK set-null). Six
  defaults (the historical lifecycle stages) seed lazily on first load,
  guarded by `user_metadata.email_categories_initialized` so deleting
  them all sticks. The old `lifecycle_stage` column is legacy.
- Editor modal (fullscreen): left = name, **Category** picker, subject
  (mustache, with Insert-variable popover), TipTap body editor wired to
  the email variable catalogue (toolbar popover **or typing `{{`** for
  the inline suggestion list; also a Link button), and an
  **Attachments** section (upload to the private bucket, listed with
  remove; works on unsaved drafts too  -  uploads park unlinked under
  `{user}/drafts/` and are linked on first save, deleted on discard  - 
  files are included on every send of the template, deselectable per
  send in the compose modal); right = **WYSIWYG preview**: subject row + the full branded
  email shell (logo/wordmark, brand accents, the MC's fonts, corner
  radius, footer) rendered into a sandboxed iframe by the same
  `wrapTemplateHtml` the send route uses, with sample data + the MC's
  real saved signature filled in. Footer has **Send test to myself**
  (emails the live draft to the MC's own inbox, `[Test]` prefix,
  rate-limited) beside Cancel / Save.
- The **branded shell** applies to real sends too (manual + automation
  `send_email` wraps), so preview = send. Branding is assembled from
  `user_metadata` by `buildPublicBranding`
  (`lib/branding/public-branding.ts`, pure/server-safe) and rides on
  `ctx.mc.branding`.

## Page States

- **Loading**: `TemplatesSkeleton`  -  search box + stage-grouped row
  placeholders mirroring the real layout (no spinner, no reflow).
- **Empty** (no templates  -  the default for a new MC, since nothing is
  auto-seeded): `Empty` offering **Browse starter templates** + **New
  template**.
- **Error**: `ErrorState` with retry.

## Starter templates (opt-in catalog  -  no auto-seed)

Nothing is auto-seeded. The Emails tab has a **Browse starter
templates** button (and an empty-state CTA) opening
`StarterLibraryPanel`  -  the catalog of **3 exemplars** (trimmed
2026-07-09: starters are a guide showing how a template is built, not a
library  -  Enquiry acknowledgement, Quote cover email, You're booked
confirmation; canonical set in `lib/email/starter-templates.ts`).
Catalog entries already in the library are hidden; **Add** (or
**Add all**) inserts copies via `addStarterTemplatesAction`, which
resolves content server-side from the catalog by name (client sends
names only), skips duplicates, and files each copy under the user's
matching default category. Migration
`20260618000200_clear_seeded_starter_templates.sql` removes the rows
from the old auto-seed model (only `is_starter` rows; user-created
templates untouched).

## Packages / Quotes / Invoices / Contracts tabs (email-consistent)

These four tabs mirror the Emails treatment so every Templates tab feels
identical:

- **Empty state**: the `Empty` primitive (per-type icon), with **Browse
  starters** (`outline`) + **New …** actions. A "Browse starters" button
  also sits beside the header "New" button.
- **List rows**: borderless, token-styled
  (`rounded-xl px-3 py-2.5 hover:bg-surface-muted`) with a 2-line text
  block and a `RowActionsMenu` (Edit / Delete). The Quotes / Invoices
  tabs keep dnd-kit drag-reorder (muted `GripVertical` handle);
  Packages and Contracts have no reorder (Packages lists in `position`
  order, which is creation order). (Emails group by lifecycle stage
  instead of reordering.)
- **Detail pane actions**: the `TemplatePreviewHeader` `⋯` menu offers
  Edit / Duplicate / Delete on the Packages, Quotes, and Invoices tabs
  (Packages adds Archive). Duplicate copies the template + items as
  "<name> (copy)" placed directly after its source and selects it;
  Archive (packages only) soft-retires it (`archived_at`: kept under a
  collapsed "Archived (N)" group at the bottom of the list, out of the
  builders' pickers, restorable); Delete goes through a `ConfirmDialog`
  (copy notes that quotes/invoices already created from it keep their
  snapshot). The header also shows the "Edited X ago" line
  (`updated_at`, set explicitly on every save  -  none of these tables
  has a touch trigger) and, once a package has been applied to quotes,
  a "Used in N quotes · M accepted" line (`use-package-usage.ts`
  reading `quotes.source_package_id`).
- **Edit modals**: Packages, Quotes, and Invoices share the calm
  modal styling  -  underline inputs, black section headers, the shared
  `LineItemsEditor` grid (grip · description · [qty] · amount · remove,
  borderless with hairline rows, auto-animated add/remove), and a
  sticky Cancel / Save footer. Packages use `PackageEditForm`; Quotes
  and Invoices share `TemplateEditForm` (Quotes gets a packages-only
  `sources` picker; Invoices gets packages + quote templates). The
  form has both a **Subtitle** (`notes`, internal, shown in the list)
  and a **Notes** field (`description`, customer-facing, applied to
  the document). Save is blocked with a quiet hint when a priced line
  item has no description or the name duplicates another template;
  fully empty item rows are silently dropped. The read-only
  `LineItemPreview` lives in the detail pane (with an "Added to the
  notes when applied" block when notes exist), not inside the modal.
  Amounts display cents only when non-zero (`formatAUD` in
  `lib/payments/format.ts`). Contracts edit in the TipTap editor.
- **Starter catalogs**: each tab has its own opt-in catalog surfaced
  through the shared `StarterCatalogModal` (flat list, no stage grouping).
  Catalogs:
  `lib/payments/starter-line-item-templates.ts` (4 packages, 3 quote
  templates, 3 invoice templates with suggested AU amounts) and
  `lib/contracts/starter-contracts.ts` (Wedding MC Service Agreement +
  Deposit & Cancellation Terms). Adds run through
  `addStarterPackagesAction` / `addStarterQuoteTemplatesAction` /
  `addStarterInvoiceTemplatesAction` / `addStarterContractsAction` in
  `starter-actions.ts`: names sent from the client, content resolved
  server-side, names already owned skipped, rows flagged `is_starter`.
  The legacy single contract default still auto-seeds on signup
  (`seed_default_contract_template`); the contract catalog is additive.

## Packages v2 (commercial fields)

A package is more than a flat item list; the edit modal
(`package-edit-form.tsx` + `package-items-editor.tsx`) captures:

- **What's included** (`description`): prose shown on the preview and
  applied as the quote/invoice notes (the `notes` subtitle stays
  internal and is never applied).
- **Base line items + optional add-ons**: two drag-sortable sections;
  each item has quantity × per-unit price (flattened to
  "N × description" on apply, since builder items carry no qty).
- **Pricing details**: booking deposit % (pre-fills the invoice
  builder's payment schedule), weekend loading % (applying appends a
  transparent "Weekend rate loading (X%)" line the MC deletes
  off-peak), and a "Prices include GST" flag (applying an inclusive
  package turns the builder's GST line off; exclusive keeps GST 10%).

The read-only preview (`package-preview.tsx`) mirrors this: inclusions
prose, base items + total, an "Optional add-ons" group, and a quiet
terms footer. Pure money math lives in `lib/payments/package-math.ts`.

**Builders**: applying a package with add-ons opens the shared
`AddOnPickerDialog` (`components/builders/parts/add-on-picker-dialog.tsx`)
to tick which extras to include (Cancel aborts the apply). The quote
builder records `sourcePackageId` through `saveQuoteAction` for
conversion stats; the invoice builder pre-fills the deposit schedule.
The apply pickers hide archived packages.

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
  page.tsx                  -  server: auth + hand off (no seeding)
  starter-library-panel.tsx -  "Browse starter templates" catalog modal
  templates-client.tsx      -  tab orchestrator (Emails/Quotes/Timelines/Contracts)
  templates-tabs.tsx        -  underline tab nav
  emails-tab.tsx            -  Emails tab: library + editor modal + New button
  templates-library.tsx     -  category-grouped list, search, row actions
  templates-skeleton.tsx    -  loading skeleton mirroring the grouped list
  template-editor-modal.tsx -  create/edit (editor + live preview)
  template-preview.tsx      -  shared filled-in preview
  subject-field.tsx         -  subject input + variable popover
  actions.ts                -  create/update/delete/clone (Zod + RLS)
  use-templates.ts          -  React Query hooks
  packages-manager.tsx          -  Packages tab (packages + package_items)
  invoice-templates-manager.tsx -  Invoices tab (+ "Add from package/quote" picker)
  quote-template-manager.tsx    -  Quotes tab (moved from settings/)
  contract-template-manager.tsx -  Contracts tab (moved from settings/)
lib/email/
  templates.ts              -  render + detectMissingVariables (shared)
  template-variables.ts     -  editor variable list + sample context
  starter-templates.ts      -  canonical starter catalog + starterTemplatesByName
types/email-template.ts     -  EmailTemplate + EmailTemplateCategory (+ legacy LifecycleStage)
```

## Manual send  -  couple "Send email" modal

Entry point: a "Send email" button in the couple Overview (`couple-overview.tsx`).
Opens `couple-send-email.tsx`:

- Pick a saved template (in the picker popover; inline compose is a
  planned follow-on).
- The template is resolved against the **real couple** via
  `loadSendContextAction` (couple + MC snapshot + stamped document
  links) into an **editable** subject + body. The MC edits the finished
  email directly before sending  -  what they see is what goes out.
- Any variable the couple can't fill is shown as its label in the body
  (editable in place) and flagged once in an amber banner  -  **no
  separate input panel**. Fills are part of this one email only; they
  never touch the couple record.
- On send, the edited subject + body go out **inline**
  (`inlineSubject` / `inlineBody`) via `POST /api/email/send-template`;
  the `templateId` is still passed so the send is logged under the
  template's name. Inline content takes precedence over the stored
  template server-side.

Files: `couple-send-email.tsx`, `send-email-actions.ts`,
`app/api/email/send-template/route.ts`, `lib/email/send-context.ts`.
The editable preview reuses `components/ui/rich-text-editor.tsx`
(`showVariableInserter={false}`); `resolveTemplateContent`
(`lib/email/templates.ts`) seeds it with the filled-in body.

Deferred sub-items: static-file attachment upload UI (the route + bucket
already support `attachmentFileIds`; the upload/attach UI lands with the
template editor), and inline (template-less) compose.

# Couple Questionnaires

MCs build reusable questionnaires, send them to couples, and read the answers
back inside the couple profile. Structurally modelled on contracts (template →
token-gated instance → branded public page). Question types: short text, long
text, single choice, multiple choice, dropdown, date, time, yes/no, number,
email, phone, and a non-input section heading. Each template has a display
mode  -  `typeform` (one question at a time) or `form` (all on one page)  - 
snapshotted onto the instance at send. Schema + validation:
`lib/questionnaires/`. The renderers themselves are shared feature components
in `components/questionnaires/` (`question-field`, `typeform-flow`,
`classic-form`, `experience-preview`, `theme`) so the public page and every
MC-side preview are pixel-identical.

## Template builder  -  Templates page → Questionnaires tab

`questionnaire-template-manager.tsx` lists the MC's templates (create from
scratch, duplicate an existing one, or clone a starter from
`STARTER_QUESTIONNAIRES`). `questionnaire-builder-modal.tsx` is a two-pane
modal: the left pane edits name/description, shows the answer style read-only
(derived from the MC's branding blocks via `useCurrentBranding`, with a
"Change in Branding" link to `/branding?surface=questionnaire`; the old
per-template display-mode toggle was removed 2026-08-19 because the public
page derives the mode from branding), and a dnd-kit-sortable question list
(`questionnaire-question-row.tsx`, with per-question duplicate); the right
pane is the real branded couple experience
(`QuestionnaireExperiencePreview`), interactive but local-only, rendering
whichever answer style branding currently has. The one-at-a-time preview
sits at its natural height at the top of the frame with no outer scrollbar,
so brand, title, question and nav stay grouped; stretching it to fill the
frame pushed the progress bar into the middle and the Next button out of
sight. `TypeformFlow` also reserves a shorter step floor in preview mode
than on the live page, where a full viewport can carry it. Save is
blocked (with inline per-question messages) while a question has no text or a
choice/dropdown has no options  -  `questionIssues` in
`lib/questionnaires/builder-state.ts`.

The Questionnaires tab's detail pane shows the same preview for the selected
template, fed by the same branding-derived answer style and the template's
description, so the two MC-side previews and the live page cannot disagree.
All three derive the style through `displayModeFromBlocks` in
`lib/questionnaires/display-mode`.

## Send + view  -  couple profile → Questionnaires tab

`couple-questionnaires.tsx` lists this couple's questionnaires with a
lifecycle pill (draft → sent → opened → in progress → completed, driven by
sent_at / viewed_at / non-empty responses / completed_at) and per-row actions
(`couple-questionnaire-row.tsx`): copy the share link, resend the cover email
(`resendCoupleQuestionnaireAction`), and turn the share link off/on. "Send"
picks a template and opens the send preview
(`questionnaire-send-preview.tsx`)  -  two tabs: the couple experience (with a
desktop/phone width toggle) and the actual cover email
(`questionnaireHtml` in a sandboxed iframe)  -  then calls
`sendCoupleQuestionnaireAction` (`questionnaire-actions.ts`), which snapshots
the template's questions + description + display mode into a
`couple_questionnaires` row,
enables the share token, and emails the couple the link. Clicking a row opens
the answers panel (`couple-questionnaire-answers.tsx`): sent/completed
metadata, print / save-as-PDF export (`lib/questionnaires/answers-html.ts`),
and an edit mode so the MC can fill answers on the couple's behalf (saved via
the RLS-scoped `responses` update).

## Public fill-in page  -  `/questionnaire/[token]`

Branded with the MC's colours/fonts (`useBrandingHead` + the shared
questionnaire theme). Two render modes, derived at render time from the MC's
branding blocks (`questionnaireOneAtATime` / `questionnaireAllOnePage`
markers; the instance's stored display_mode is a legacy snapshot):

- **typeform**  -  one question per screen, progress bar, keyboard-advance
  (Enter), choice/yes-no/dropdown answers auto-advance, and a final
  "Ready to send your answers?" confirmation step. Required answers hold
  the couple on the question **only in `live` mode**: an MC paging through
  a preview is reading the questions, not answering them, so a preview
  never blocks on Next.
- **form**  -  every question on one page with per-question required errors,
  scroll-to-first-missing, and the same pre-submit confirmation.

Both modes take their required-answer message from
`REQUIRED_ANSWER_MESSAGE` in `lib/questionnaires/question-schema` ("Please
answer this to continue."), phrased as the next step rather than as a rule:
the old "This one is required." scolded without saying what to do, and "this
one" was vague sitting under the question it referred to.

Both modes show the questionnaire's description (when set, muted text under
the title, snapshotted from the template at send time), a question count
under the title, a visible autosave state
("Saving… / Saved / Couldn't save") for the debounced autosave to
`/api/questionnaire/save`, and submit to `/api/questionnaire/submit`.
Long-text answers are fixed-height (6 rows, `resize-none`) and scroll
internally. Loads via `get_public_questionnaire(token)` (which also stamps
viewed_at on first open). States: loading, not-found (generic 404 for a
missing/disabled token), active fill, and a thank-you screen. Files:
`app/questionnaire/[token]/page.tsx` +
`_components/{fill-section,use-questionnaire-fill,public-questionnaire}` on
top of the shared `components/questionnaires/` renderers.

## Other entry points

- **Client portal:** a Questionnaires section lists the couple's sent
  questionnaires, each linking to the standalone fill-in page
  (`app/portal/[token]/questionnaires-section.tsx`, fed by
  `get_portal_questionnaires`).
- **Automations:** the `send_couple_questionnaire` action sends a
  questionnaire mid-flow; the `questionnaire_completed` trigger fires when a
  couple submits (or the MC marks one completed), with an optional
  per-template filter. `{{questionnaire.link}}` resolves from a send action's
  output or the completion payload's share token; `{{questionnaire.title}}`
  from the completion payload.

# Roadmap voting (`/roadmap`)

Standalone page (no dashboard shell, not linked from the sidebar) where
MCs vote on what Zebri builds next. **Visual-only for now**: it exists
primarily for the intro video's "You decide" scene; a persisted
(DB + RLS) version replaces it when community voting goes live.

- **Files:** `app/roadmap/page.tsx` (orchestrator),
  `roadmap-voting.tsx` (client list), `roadmap-options.ts`
  (React-free data + share math, unit-tested).
- **Options:** seven candidate features with seeded percentages that
  sum to 100, rendered as a leaderboard of cards, each with a Lucide
  icon, description, share, and progress bar.
- **Voting:** clicking a card highlights it (`border-brand-fg` +
  check badge), adds 1% to its share and takes 1% from the
  highest-seeded other option (total stays 100). Clicking another
  card moves the vote; clicking the same card withdraws it.
- **State:** in-memory only; a refresh resets the poll (deliberate,
  for clean retakes while filming). Route sits behind the normal
  auth middleware.

# Admin (`/admin`)

Founder-only single pane, gated by `isAdmin()` in middleware + page.
All data comes from service-role aggregators in
`lib/admin/admin-analytics.ts`; pure tier/value helpers safe for
client components live in `lib/admin/user-value.ts`. Two tabs
(`?tab=dashboard|users`); clicking any user anywhere opens the shared
detail slide-over.

## Dashboard tab

- **Row 1  -  hero chart cards:** MRR (Pro/Max breakdown), active subs,
  churn rate, new signups; 12-week approximate series.
- **Row 2  -  Engagement:** activity strip (active last 7d / 30d, new
  this week) beside the **Gone quiet** list: paying or comped users not
  seen for 14+ days, highest tier first (`computeGoneQuiet` in
  `user-value.ts`). Dormant = never started; gone quiet = revenue at
  risk. The filter reads `last_seen_at`, the same column the list sorts
  and renders on; it filtered on `last_sign_in_at` until 2026-08-21,
  which meant the most engaged paying accounts on the platform (never
  logged out, so never re-authenticated) sat on the revenue-at-risk
  list. Shadow mode signs the admin in as the target and creates a
  session for them, so a recently-shadowed user can look falsely active.
- **Row 3  -  operational lists:** upcoming renewals, past due, Connect
  issues.
- **Row 4  -  supporting lists:** dormant accounts, recent signups.

## Users tab

- Search box filters by email / business / display name (email is
  searchable but not a column  -  it lives in the detail panel).
- Columns: Name (+ admin badge), Business, Plan (effective plan today;
  cancelled ex-payers show Starter, comped users show their granted
  plan with a "comped" suffix), Last seen (relative), Couples,
  Events, Invoices (count + $ collected from PAID invoices via the
  canonical `invoiceTotal()` math in `lib/payments/invoice-total.ts`),
  Templates (combined count across email / contract / invoice /
  questionnaire templates + packages), Automations, Signed up.
- Default order: Max → Pro → Starter, then most recently seen
  (`compareUsersByPlanThenLastSeen`).
- **Last seen** is `AdminUser.last_seen_at`, sourced from `auth.sessions`
  via the `admin_user_last_seen()` RPC  -  NOT `auth.users.last_sign_in_at`.
  GoTrue only stamps `last_sign_in_at` on a real credential exchange; a
  token refresh leaves it untouched. Zebri sets no session `timebox` or
  `inactivity_timeout` and `login/page.tsx` redirects anyone with a live
  session away from the form, so a returning user never re-authenticates
  and that column froze at their last password entry. Confirmed in
  production: a user whose sessions were refreshed the previous day still
  reported a sign-in from four weeks earlier.
- Per-user numbers come from `getAllUserStats()`  -  one paginated
  service-role pass over the activity tables, aggregated in TS (no
  SQL migration required).

## Fixing a paying user who shows as free

A missed Stripe webhook leaves `app_metadata` without
`subscription_*` fields, so the user counts as free Starter. Fix via
the detail panel → Subscription → **Link Stripe customer** (pulls the
subscription from Stripe and writes entitlements), or **Comp user**
for non-Stripe arrangements (comped users are excluded from the
paying/MRR counts by design).

# Public Booking Page (`/book/[token]`)  -  Phase E

Route: `/book/[token]`

Route group: none (standalone public route, no sidebar, no auth required)

Purpose: Allow logged-out visitors to book consultations with the MC via a share-token URL. Three-column branded interface (Calendly-style).

## Three-Column Layout

A single card wrapping three equal columns (or stacked on mobile):

**Left panel (meta):**
- MC name (from branding)
- Meeting type name
- Meeting type duration (e.g. "30 min")
- Meeting type location type and address (if in-person)
- Branding accent color used for interaction elements

**Center column (month calendar and day selector):**
- Month/year header with prev/next arrows (allows browsing forward)
- Six-week calendar grid
- Available days marked with a small filled circle in brand color (derived from availability rules, overrides, and booked slots)
- Selected day marked with a solid filled circle (brand fill)
- Unavailable dates are greyed out and not clickable
- Clicking an available day populates the right column's slot list

**Right column (time slots):**
- Heading: the selected day, rendered in the booker's timezone
- City line naming that zone, e.g. "All times are in Perth time" (IANA-derived, never a fixed offset)
- Scrollable list of available time slots for the selected day (times in the booker's timezone, formatted HH:MM AM/PM)
- Each slot is a button; clicking advances to the booking form
- Empty state if no slots are available that day
- Below the list, the timezone control: the current zone plus a searchable picker

## Timezone handling

Zebri cannot know where a couple is, so the booking page follows the Calendly
model: **guess from the browser, state the guess next to the times, and make
correcting it one click.** It never infers the booker's zone from the MC's.

- **Detection** is `detectViewerTimezone()` (`lib/scheduling/timezone-options.ts`),
  surfaced through `useSyncExternalStore` so the server snapshot is empty and
  SSR and the first client render agree. On the server it returns `null` rather
  than the host zone, which on Vercel is UTC and is nobody's actual timezone.
- **Override** is `TimezonePickerModal` (`components/scheduling/`), the same
  searchable list the MC's availability settings use. An explicit choice beats
  detection and survives slot refetches.
- **Regrouping**: slots are absolute instants, so changing zone refetches
  nothing, but a slot can cross a local-day boundary. `changeTimezone` re-derives
  the available dates and moves off a selected day that no longer has any times.
- **Precedence** everywhere: explicit choice → browser detection → the MC's zone
  (first paint only).

**Two audiences, two zones.** `bookings.timezone` stores the BOOKER's zone:

| Message | Rendered in |
|---|---|
| Booker's confirmation, 24h reminder, cancel/reschedule notice | booker's zone (`bookings.timezone`) |
| MC's new-booking and change notifications | MC's zone (`user_public_settings.timezone`) |

Sending the MC the booker's zone would make them convert their own diary; the
reverse strands the couple. Regression coverage:
`tests/unit/lib/booking/lifecycle.test.ts` ("audience-specific timezones").

## 2-Step Booking Flow

1. **Slot Picker (interactive month calendar plus day slots)**
   - Booker clicks an available day, then a time slot
   - Both selections must happen before form submission

2. **Booking Form (modal overlay, step: "details")**
   - Back button returns to month calendar (preserves day selection, resets time)
   - Selected time displays as a read-only summary box
   - Fields:
     - Your name (required)
     - Partner's name (optional)
     - Email (required)
     - Phone (optional)
     - Notes (optional)
   - Honeypot: hidden "website" field plus form-start timestamp (matches lead-capture bot defense pattern)
   - CTA: "Confirm booking" button (disabled if name or email empty, or form is submitting)
   - Loading state: button shows spinner overlay on label
   - On submit: calls submit_booking RPC

3. **Confirmation (step: "confirmed")**
   - Meeting type name (from booking page)
   - Scheduled time (formatted in booker's timezone with city line)
   - Video join URL (if video meeting and event-push populated it)
   - "Check your email" callout
   - No further CTAs (end state)

## Special Behaviors

**Embed Variant (`?embed=1`)**
Chromeless mode for iframe embedding on MC's website. Strips page chrome (heading, padding); emits `zebri-book-height` postMessage to parent so host can resize the iframe. Transparent background (inherited from host).

**Slot-Taken Recovery**
If the first visitor books a slot and a second visitor tries to book the same time:
- The second visitor's form submission (step 2) receives `{"error": "slot_taken"}` from submit_booking RPC
- Page transitions back to slot picker (step "pick")
- A notice banner appears: "That time was just taken. Please choose another time."
- The banner auto-hides or remains until slot re-selection (UX TBD; current code shows persistent)
- Booker can pick a different slot

**Fail-Closed (503)**
If the share token is invalid/expired/inactive:
- Renders NotFoundView: "This booking link is not available. Please check the URL or contact the business."
- No fallback CTA (fail-closed; prevents token leak via public error message)

If the slot-generation service is down:
- Renders ErrorView: "Availability is temporarily unavailable, please try again shortly." + retry button
- Retry reloads the page (soft retry pattern)

## Data Fetching

**Page Load (orchestrator)**
1. Extracts share_token from URL params
2. Calls get_public_booking_page(token) RPC → fetches meeting type, MC branding, business name
3. Stores timezone from MC settings (user_public_settings.timezone)
4. Initializes slot-generation state (currentFrom/currentTo fortnights)

**Slot Generation**
1. Server-side endpoint (route: `/api/booking/slots` per security.md) accepts (token, fromDate, toDate)
2. Generates available time slots based on:
   - Meeting type duration + buffers
   - Availability rules (weekday-based)
   - Availability overrides (date-based exceptions)
   - Existing confirmed bookings (exclusion via query)
3. Returns array of slots: [{start: ISO8601, end: ISO8601}, ...]
4. Frontend groups by booker's local day, formats times with timezone abbreviations

**Form Submission**
1. submit_booking RPC (anon-callable, rate-limited)
2. Returns:
   - Success: {ok: true, booking_id, manage_token, couple_id, ...}
   - Error: {error: "not_found" | "invalid" | "rate_limited" | "slot_taken"}
3. Route fetches mc_email server-side (from auth.users) for Slack alert and email headers

## Responsive Behavior

**Mobile (Pixel 5, iPhone 12)**
- Slot picker: 2-column grid on phone, 3-column on tablet
- Form: full-width inputs, no multi-column layouts
- Prev/Next pagination buttons stack vertically if space-constrained
- Embed mode works identically (parent iframe handles sizing)

**Desktop**
- Max-width container (512px / 32rem) centered on page
- Slot grid adjusts column count based on viewport width

## Branding Integration

The page reads MC's branding from the get_public_booking_page payload (merged via _user_branding RPC):
- Page background (surface_color)
- Text color, heading color
- Font family + weights (bodyFontFamily utility)
- Density (cozy/compact): affects padding scale

All rendered directly as inline style attributes (not Tailwind tokens, to honor custom MC branding on public surfaces).

## Accessibility & Bot Defense

- Form uses Input primitive (semantic label + aria-label)
- Honeypot field (hidden, aria-hidden="true", tabindex="-1")
- Form-start timestamp (startedAt) submitted server-side for timing analysis
- Buttons use native `<button>` with `disabled` prop

## No Authentication

- Fully public (no auth wall, no middleware redirect)
- RPC calls are anon-callable (SECURITY DEFINER)
- IP rate-limiting on API layer (/api/booking/slots: 30/min/IP, /api/booking/submit: 5/min/IP)
- In-RPC rate-limit on submit_booking: 6/hour/meeting_type (per brief)

Migration: `20260820000000_create_bookings.sql` + `20260820001000_booking_rpcs.sql`.

---

# /book/manage/[manage_token]

Route: `/book/manage/[manage_token]` (public, unprotected)

Route group: `(public)`

Purpose: Allow booker to view, reschedule, or cancel their confirmed consultation booking via a capability token (manage_token).

## States

**Loading**
- Fetches booking via get_booking_by_manage_token(token) RPC
- Shows spinner with "Loading booking details" copy

**Not Found**
- Renders NotFoundView: "Booking link not found or expired. Please check the URL or contact the business."
- No fallback CTA (fail-closed)
- Thrown when token does not exist

**Error**
- Renders ErrorView: "Could not load booking. Please try again shortly." + retry button
- Retry reloads the page
- Thrown on RPC network errors

**Active**
- Booking status = "confirmed"
- User can reschedule or cancel
- Shows booking details (date/time in booker's timezone, meeting type name, business name, video URL if present)
- Two CTA buttons: "Reschedule" and "Cancel"

**Already Cancelled**
- Booking status = "cancelled"
- Read-only view
- Shows original booking details
- Shows "This booking has been cancelled" callout
- No CTAs

**Past**
- Booking ends_at <= now()
- Read-only view
- Shows booking details
- Shows "This booking is in the past. Rescheduling and cancellation are no longer available" callout
- No CTAs

## Cancel Flow

1. User clicks "Cancel" button
2. Modal opens: "Are you sure you want to cancel this booking?" + "This action cannot be undone."
3. Confirmation checkbox: "I understand I am cancelling this booking. Please confirm." (required)
4. CTA buttons: "Cancel Booking" (danger variant) and "Keep Booking"
5. On confirmation:
   - Calls cancel_booking(manage_token) RPC
   - Button enters loading state
   - On success: page transitions to "Already Cancelled" state
   - On error (e.g. "past"): shows error banner, remains on active state
6. Confirmation dismissal via Escape or modal close button returns to active state without action

## Reschedule Flow

1. User clicks "Reschedule" button
2. Modal opens: "Pick a new time for your booking"
3. Slot picker (same as public booking form):
   - Calendar mini-picker (month/year navigation)
   - Available time slots for selected date
   - User selects a time slot
   - Time display updates (converted to booker's timezone)
4. On slot selection:
   - Calls reschedule_booking(manage_token, starts_at, ends_at) RPC
   - Button enters loading state
   - On success: page transitions back to active state, details update to new time
   - On error handling:
     - "slot_taken": displays banner "That time was just taken. Please choose another time." and returns to slot picker
     - "past": displays banner "Cannot reschedule a past booking. Please contact the business." and closes modal
     - "invalid": displays banner "Invalid time selection. Please try again." and returns to slot picker
     - "not_found": displays banner "Booking not found." and closes modal
   - Other errors: displays generic error banner
5. Modal dismissal via Escape or close button cancels reschedule (no state change)

## Slot-Taken Recovery

If two concurrent users try to book the same slot:
- The first succeeds
- The second's reschedule_booking call receives `{"error": "slot_taken"}`
- Slot picker re-opens with banner: "That time was just taken. Please choose another time."
- Booker can select a different slot

## 503 Availability Message

If the slot-generation service is down:
- Renders message in slot picker: "Availability is temporarily unavailable, please try again shortly."
- Retry button reloads the page

## Mobile Layout

- Full-width view
- Modal transitions adjusted for smaller screens (stacks vertically on mobile)
- Slot picker calendar adapted for mobile (smaller touch targets, scrollable day grid)
- Time zone display always visible

Migration: `20260821000000_booking_lifecycle.sql`.
