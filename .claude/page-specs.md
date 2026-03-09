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
- Columns with bg-gray-50 rounded-xl background
- Colored text labels for status headers (amber/blue/purple/emerald/gray)
- Cards are borderless text-only; hover shows subtle bg-gray-50
- "+ New" button at bottom of each column with status-colored border
- No icons on cards — date and venue shown as plain gray text
- Scrollbar hidden on kanban container

List style: Notion-inspired clean table.
- No card wrapper (no border/rounded-xl around table)
- Lighter headers: white background, bottom border, sentence-case text
- Plain text pagination (Previous / Next) instead of bordered buttons
- Table scrollable within its container

------------------------------------------------------------------------

# Vendors Page

Purpose:

List vendors the MC liaises with for weddings.

Columns:

Vendor Name Contact Email Phone Category Status

Clicking a row opens the vendor profile.

------------------------------------------------------------------------

# Vendor Profile

Information:

Vendor name Contact person Email Phone Category Notes

Tabs:

Overview Events Tasks

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
