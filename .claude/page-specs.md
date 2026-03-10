# Zebri Page Specifications

This document defines every page in the CRM.

------------------------------------------------------------------------

# Login

Route: `/login`

Route group: `(auth)` — centered card layout, no sidebar.

Purpose: Sign in to Zebri.

Fields: Email, Password

Actions: Sign In, "Forgot password?" link to `/reset-password`, "Sign up" link to `/signup`

------------------------------------------------------------------------

# Sign Up

Route: `/signup`

Route group: `(auth)`

Purpose: Create a new vendor account.

Fields: Display Name, Business Name, Email, Password

Actions: Create Account, "Already have an account?" link to `/login`

On submit: creates account with `account_type: 'vendor'` in user_metadata.

------------------------------------------------------------------------

# Reset Password

Route: `/reset-password`

Route group: `(auth)`

Purpose: Request a password reset email.

Fields: Email

Actions: Send Reset Link

Shows confirmation message after submission.

------------------------------------------------------------------------

# Update Password

Route: `/update-password`

Route group: `(auth)`

Purpose: Set a new password after clicking the reset link.

Fields: New Password, Confirm Password

Actions: Update Password

Redirects to `/login` on success.

------------------------------------------------------------------------

# Dashboard

Purpose:

Quick overview of upcoming work.

Modules:

Upcoming Weddings Tasks Due Recent Couples

Avoid heavy analytics.

------------------------------------------------------------------------

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

Views: List (table) and Kanban (5 columns, drag-and-drop).

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

------------------------------------------------------------------------

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

**Tabs:** Overview, Events, Tasks (horizontal underline tabs, same style as Settings page)

**Overview tab (default):**
- Contact details: key-value layout (Phone, Email, Category, Status). Phone and Email clickable.
- Notes section: rendered text (not form field). If empty: "No notes yet." in italic gray. Edit button next to "Notes" title opens edit modal.
- Notes are the most valuable field — where MCs record things like "DJ prefers to be introduced as DJ Mike", "Photographer needs 20 min for portraits", "AV tech: ask for lapel mic, not handheld".

**Events tab:**
- Compact list of events where this vendor was involved (requires event_vendors join table).
- Each row: event date, couple name, venue. Sorted by date desc.
- Empty state: "No events linked yet. Events will appear here once this vendor is assigned to a wedding."

**Tasks tab:**
- Compact task list filtered to this vendor (requires related_vendor_id on tasks).
- Each row: task title, due date, status badge. Checkbox for inline completion.
- Empty state: "No tasks yet." with "+ Add Task" button pre-filled with this vendor.

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
  vendor-tasks.tsx
```

------------------------------------------------------------------------

# Events Page

Purpose:

List weddings.

Columns:

Date Couple Venue Status

Future improvement:

Calendar view.

------------------------------------------------------------------------

# Tasks Page

Purpose:

Track follow‑ups and reminders.

Columns:

Task Due Date Status Related Couple/Event

Actions:

Create Task Mark Complete Edit Task

------------------------------------------------------------------------

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

| Status | Message | CTA |
|---|---|---|
| No subscription | "Start your 14-day free trial" | Start Free Trial |
| trialing | "Your trial ends on {date}" | Manage Billing |
| active | "You're subscribed to Zebri Pro" | Manage Billing |
| cancelled | "Your access ends on {date}" | Resubscribe |
| past_due | "Payment failed" | Update Payment |
| expired | "Your subscription has expired" | Subscribe |

### Packages (`?tab=packages`)

Placeholder empty state. Coming soon.

### Notifications (`?tab=notifications`)

Placeholder empty state. Coming soon.
