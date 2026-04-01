# Quotes & Proposals

## Problem

After an MC meets a couple, they need to send a formal quote before a booking is confirmed. Currently this happens outside Zebri — via email, Google Docs, or a PDF template. The quote amount is never recorded, there's no visibility into which quotes are pending, and the link between a quote acceptance and a couple's status change is manual and easy to miss.

## Solution

A lightweight quote builder inside the couple's profile. The MC adds line items, sets an expiry date, and notes, then generates a shareable link. The couple opens the link without logging in, reviews the quote, and clicks Accept or Decline. On acceptance, the couple's status automatically updates to "confirmed" and a follow-up task is created for the MC. No back-and-forth email required.

## Access Points

1. **Couple Profile → Quotes tab** — lists all quotes for this couple; "+ New Quote" button; click any quote row to open the builder page
2. **`/quotes/[id]` route** — dedicated full-page quote builder; bookmarkable, accessible directly

---

## Non-Goals for MVP

- PDF export or download (browser print is sufficient)
- Quote templates or package presets
- Email delivery of the link from within the app
- Digital signatures or legally binding acceptance
- Multi-currency
- Tax / GST calculation
- Versioned quote history (editing a draft replaces the current version)
- Automatic expiry enforcement server-side (client-side display check only)

---

## User Stories

1. As an MC, I can create a quote attached to a couple with line items and a total so the couple has a clear pricing breakdown.
2. As an MC, I can enable a shareable link and copy it to send via WhatsApp or email.
3. As an MC, I can track whether a quote is draft, sent, accepted, or declined from the couple's profile.
4. As a couple (unauthenticated), I can open the link and accept or decline the quote.
5. As an MC, when a couple accepts a quote, the couple's status automatically updates to "confirmed".
6. As an MC, I can create an invoice directly from an accepted quote (see `invoicing.md`).

---

## MC Workflow

1. Open Couples → click couple → Quotes tab → click "+ New Quote".
2. Fill in the quote title (e.g. "Wedding MC Package — The Smiths"), add line items (description + amount), set an expiry date (optional), and add notes (terms, inclusions, exclusions).
3. Save. Quote is created as "draft" — not yet visible to the couple.
4. Click "Enable link" → copy URL → send via WhatsApp, email, or SMS.
   - Status updates from "draft" to "sent" automatically when the link is enabled.
5. Couple opens the link, reviews the quote, clicks "Accept" or "Decline".
   - On Accept: quote status → "accepted", couple status → "confirmed", a follow-up task is created: "Quote accepted — confirm booking for [couple name]".
   - On Decline: quote status → "declined". No automatic couple status change.
6. MC returns to couple profile — Quotes tab shows updated status, Overview tab shows updated couple status.
7. From an accepted quote, MC clicks "Create Invoice" to generate an invoice pre-filled with the same line items (see `invoicing.md`).

---

## Data Model

See `database-schema.md` for the authoritative schema. Summary:

**New table `quotes`:**

- `couple_id` → FK to couples (not null, cascade delete)
- `title` (text, required) — e.g. "Wedding MC Package — Smith Wedding"
- `quote_number` (text, not null) — auto-generated on insert as "QT-001" format (sequential per user)
- `status` (text, default 'draft') — draft | sent | accepted | declined | expired
- `subtotal` (numeric(10,2), default 0) — sum of quote_items.amount; updated on item save
- `notes` (text, optional) — terms, inclusions, exclusions, any other context for the couple
- `expires_at` (date, nullable)
- `share_token` (uuid, default gen_random_uuid())
- `share_token_enabled` (boolean, default false)
- `accepted_at` (timestamp with time zone, nullable)
- `user_id` (uuid, not null)
- `created_at` (timestamp)

**New table `quote_items`:**

- `quote_id` → FK to quotes (cascade delete)
- `description` (text, required) — e.g. "Wedding ceremony MC (2 hrs)", "Reception MC (5 hrs)"
- `amount` (numeric(10,2), required)
- `position` (integer, not null) — ordering, stored as multiples of 1000
- `user_id` (uuid, not null)
- `created_at` (timestamp)

---

## Quote Status Lifecycle

| State    | Condition                                         | Behaviour                                                                          |
|----------|---------------------------------------------------|------------------------------------------------------------------------------------|
| draft    | Newly created, or link disabled after send        | Invisible to couple. MC can edit freely.                                           |
| sent     | MC enables share link                             | `share_token_enabled = true`. Link live. Couple can accept or decline.             |
| accepted | Couple clicks Accept on public page               | `accepted_at` set. Couple status → "confirmed". Follow-up task created for MC.    |
| declined | Couple clicks Decline on public page              | No couple status change. MC can follow up or create a new quote.                   |
| expired  | `expires_at` < today and status is 'sent'         | Public page shows expired state. Accept/Decline buttons hidden.                    |

Note: status updates to 'sent' when `share_token_enabled` is toggled on. Disabling the link does not revert status to 'draft' — it remains 'sent' but the link returns not-found.

---

## Anon Access / RLS Design

Follows the same pattern as the timeline share link. See `database-schema.md` for RLS policy conventions.

**`get_public_quote(token uuid)`** — `SECURITY DEFINER`.

- Checks `share_token_enabled = true` before returning any data
- Returns only safe fields: quote title, quote_number, items, subtotal, notes, expires_at, status, couple name, MC business_name
- Does not return user_id or any internal MC fields
- Returns null if token not found or link is disabled → public page renders "not available" state

**`accept_quote(token uuid)`** — `SECURITY DEFINER`.

- Validates token is enabled and not expired
- Sets `quotes.status = 'accepted'`, `quotes.accepted_at = now()`
- Updates `couples.status` to "confirmed" (only if current status is a pre-confirmed step)
- Inserts a task: title "Quote accepted — confirm booking for [couple name]", due_date = today, related_couple_id = couple.id
- Returns `{ success: true }` or `{ error: 'expired' | 'already_actioned' | 'not_found' }`

**`decline_quote(token uuid)`** — `SECURITY DEFINER`.

- Validates token is enabled
- Sets `quotes.status = 'declined'`
- Returns `{ success: true }` or `{ error: 'already_actioned' | 'not_found' }`

Why functions rather than direct anon table mutations:
- Anon clients must not have INSERT/UPDATE on CRM tables
- `accept_quote` touches multiple tables atomically (quotes, couples, tasks)
- Functions are the single choke point — they validate state before writing

---

## Public Quote Page States

Route: `/quote/[token]`

| Page state | Condition                            | What the couple sees                                                                    |
|------------|--------------------------------------|-----------------------------------------------------------------------------------------|
| Active     | status = 'sent', not expired         | Quote title, quote number, line items, total, expiry date, notes, Accept + Decline buttons |
| Expired    | `expires_at` < today                 | Line items visible. Buttons replaced with "This quote expired on [date]. Please contact [business_name]." |
| Accepted   | status = 'accepted'                  | "Quote accepted." confirmation message. Line items still visible for reference.         |
| Declined   | status = 'declined'                  | "You declined this quote." Line items visible. No action buttons.                       |
| Disabled   | `share_token_enabled = false`        | "This quote is no longer available."                                                    |
| Not found  | Token doesn't match any quote        | "This quote is no longer available."                                                    |

---

## Edge Cases

| Scenario                                                          | Behaviour                                                                                                         |
|-------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------|
| MC edits line items after link is enabled                         | Changes live immediately — same URL shows updated amounts. Status stays 'sent'.                                   |
| MC disables link after couple has already accepted                | Link returns not-found but quote status remains 'accepted'. Couple status remains 'confirmed'.                    |
| Couple tries to accept an expired quote                           | `accept_quote` checks expiry → returns `{ error: 'expired' }`. Public page shows expired state.                  |
| Couple accepts but couple status is already 'confirmed' or later  | `accept_quote` does not downgrade status. Couple status only advances, never regresses.                           |
| MC deletes a couple with pending quotes                           | Quotes cascade-delete with the couple (FK on delete cascade).                                                     |
| MC regenerates share token                                        | Old URL immediately returns not-found. New URL live if `share_token_enabled = true`.                              |
| Quote has no expiry date                                          | Quote never auto-expires. Stays 'sent' until manually disabled or accepted/declined.                              |
| Quote has 0 line items                                            | Subtotal shows $0.00. Link can still be enabled — no validation prevents it.                                      |

---

## Migration

Filename: `20260329000000_add_quotes_feature.sql`

Covers:

- Create `quotes` table with all columns and FK constraints
- Create `quote_items` table with FK to quotes (cascade delete)
- RLS: standard `user_id = auth.uid()` CRUD for authenticated users on both tables
- `get_public_quote(token uuid)` SECURITY DEFINER function
- `accept_quote(token uuid)` SECURITY DEFINER function (updates quotes + couples + inserts task)
- `decline_quote(token uuid)` SECURITY DEFINER function
- Index on `quotes.share_token` for fast public-page lookups
- Index on `quotes.couple_id` for fast couple profile queries

---

## Testing

Test file: `tests/e2e/quotes.spec.ts`

Key test cases:

1. Create a quote — assert it appears in the Quotes tab with "Draft" status and correct total
2. Add, edit, and remove line items — assert subtotal updates correctly after each change
3. Enable share link — assert status updates to "Sent" and Copy button becomes active
4. Open share link unauthenticated — assert quote title, line items, total, and expiry visible
5. Accept quote via public link — assert Quotes tab shows "Accepted" status
6. Accept quote via public link — assert couple status updates to "Confirmed" in Overview tab
7. Accept quote via public link — assert a follow-up task appears in the couple's Tasks tab
8. Decline quote via public link — assert Quotes tab shows "Declined"; couple status unchanged
9. View expired quote link — assert Accept/Decline buttons are hidden; expiry message shown
10. MC edits line items after link is enabled — assert public page reflects updated amounts immediately
11. Disable link — assert public URL shows "This quote is no longer available."
12. Regenerate share token — assert old URL returns not-found; new URL shows the quote correctly

**Mobile tests (Pixel 5 + iPhone 12):**

- Quotes tab scrolls correctly in the couple profile slide-over at 375px
- Quote builder page is fully usable on mobile — line items, total, and share section accessible
- Public quote page renders cleanly at 375px — Accept and Decline buttons have full touch targets

See `.claude/docs/testing.md` for selector and viewport conventions.
