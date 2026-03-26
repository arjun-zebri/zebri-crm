# Zebri Page Specifications

This document defines every page in the CRM.

## Mobile Layout Notes

All pages are fully responsive. Key patterns:

- **Dashboard**: Stats stack to 1-col on mobile → 3-col on sm+. Top grid is 1-col on mobile → 7-col on lg. Bottom grid is 1-col → 2-col md → 3-col lg.
- **Couples / Vendors list**: Table scrolls horizontally on mobile. Only name+status columns visible at 375px; more columns revealed at sm/lg breakpoints.
- **Couples / Vendors slide-over**: Full-width on mobile, 640px on md+. Action button labels hidden on mobile (icons only).
- **Calendar (Couples)**: Filter sidebar hidden on mobile, opens as overlay drawer via SlidersHorizontal button. View switcher shows single letter (D/W/M) on mobile.
- **Headers (Couples/Vendors)**: Search input narrows to w-36 on mobile (w-56 on sm+). New button has larger touch target on mobile.

---

# Login

Route: `/login`

Route group: `(auth)` — centered card layout, no sidebar.

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

Purpose: At a glance, see what's happening this week and this month. The MC's command centre — quick wins, immediate action items, and a pulse on the business. Focused on _action_ not analytics.

## Layout

Full-width page. Header with "Dashboard" title and New Vendor / New Couple buttons.

Two-tier grid layout:

1. **Top section:** `grid-cols-5` — Stats + Revenue Chart (left 3 cols) | Calendar Widget (right 2 cols)
2. **Bottom section:** `grid-cols-3` — Leads (left) | Lead Sources (center) | Outstanding Tasks (right)

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
- Values show "—" when 0

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

- **Fast loading:** Limit queries — 10 for tasks, calendar scoped to selected month.
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
- No icons on cards — date and venue shown as plain gray text
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

Opens as a slide-over panel from the right (640px width), not a full page navigation. Keeps the couple list visible in the background for context.

**Profile header:**

- Couple name (text-xl font-semibold)
- Email, Phone below (text-sm text-gray-500)
- Status badge
- Quick actions right-aligned: Call, Email, Edit (opens edit modal)

**Tabs:** Overview, Events, Vendors, Tasks

**Overview tab (default):**

- Key details: Email, Phone, Status
- Notes section: rendered text. If empty: "No notes yet." in italic gray. Edit button opens edit modal.

**Events tab:**

- List of events (weddings) for this couple
- Each row: event date (formatted), venue, status badge.
- "+ Add Event" button to create a new event for this couple
- Empty state: "No events yet."
- Events belong to a couple (one couple can have multiple events)

**Vendors tab:**

- List of vendors assigned to this couple
- Each row: vendor name, category, status. Can remove vendor from here.
- "+ Add Vendor" button to attach vendors to this couple

**Tasks tab:**

- List of tasks related to this couple
- Each row: task title, due date, status badge. Checkbox for inline completion.
- "+ Add Task" button pre-filled with this couple
- Empty state: "No tasks yet."

## Add/Edit Couple Modal

Title: "Add Couple" or "Edit Couple"

Form fields:

- Name (text, required)
- Email (email, optional)
- Phone (tel, optional)
- Status (select, required)
- Lead Source (select, optional — referral, website, social_media, word_of_mouth, wedding_expo, venue_partner)
- Notes (textarea, optional)

Note: Event Date and Venue fields are managed exclusively via the Events tab. The couple modal does not expose these fields for editing.

---

# Vendors Page

Route: `/vendors`

Route group: `(dashboard)`

Purpose: The MC's vendor directory — a trusted rolodex of every wedding professional they work with. Find a DJ's phone number at 4pm on a Saturday, remember the celebrant always runs long, or pull up a photographer to recommend to a couple.

Header: Title "Vendors" + total count. Same compact Notion-style toolbar as Couples: expandable search icon, sort dropdown (ArrowUpDown icon), filter dropdown (SlidersHorizontal icon), small black "New" button. No List/Board tabs — vendors is list-only (active/inactive is not a workflow).

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

Sorting: Via sort dropdown — Name A-Z, Name Z-A, Newest first (default), Oldest first. No clickable sort on table headers.

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
- Notes are the most valuable field — where MCs record things like "DJ prefers to be introduced as DJ Mike", "Photographer needs 20 min for portraits", "AV tech: ask for lapel mic, not handheld".

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

Purpose: Unified settings page with horizontal tab navigation.

Header shows "Settings" title with user name and email below.

## Tab Navigation

Horizontal underline tabs (Vercel/Beyond.so style). Active tab driven by `?tab=` search param, default `personal-info`.

Tabs:

### Personal Info (`?tab=personal-info`)

Fields: Display Name, Business Name, Phone, Avatar URL

Action: Save Changes (updates user_metadata)

### Account (`?tab=account`)

Fields: New Password, Confirm Password

Action: Change Password

### Plans & Billing (`?tab=billing`)

Shows state-specific messaging and CTAs based on subscription_status.

See `.claude/payments.md` for the full subscription UI table.

| Status          | Message                          | CTA              |
| --------------- | -------------------------------- | ---------------- |
| No subscription | "Start your 14-day free trial"   | Start Free Trial |
| trialing        | "Your trial ends on {date}"      | Manage Billing   |
| active          | "You're subscribed to Zebri Pro" | Manage Billing   |
| cancelled       | "Your access ends on {date}"     | Resubscribe      |
| past_due        | "Payment failed"                 | Update Payment   |
| expired         | "Your subscription has expired"  | Subscribe        |

### Packages (`?tab=packages`)

Placeholder empty state. Coming soon.

### Notifications (`?tab=notifications`)

Placeholder empty state. Coming soon.
