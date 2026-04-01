# Invoicing

## Problem

After a couple confirms a booking, the MC needs to request payment. Currently this means a separate PDF invoice, a bank transfer request via email, or an external tool. Payment status is untracked — the MC has to check their bank account and manually reconcile against bookings. Dashboard revenue only reflects events marked "completed", not what's actually been invoiced or paid.

## Solution

A lightweight invoicing system. MCs generate an invoice from an accepted quote (or from scratch), share a clean link with the couple, and mark it paid when the transfer clears. When paid, the linked event's price is updated automatically — making dashboard revenue accurate without extra data entry. No payment gateway is required; couples pay via their existing method.

## Access Points

1. **Couple Profile → Invoices tab** — lists all invoices for this couple; "+ New Invoice" button; click any invoice row to open the builder page
2. **Accepted quote → "Create Invoice" button** — pre-fills invoice with quote title and line items (see `quotes.md`)
3. **`/invoices/[id]` route** — dedicated full-page invoice builder

---

## Non-Goals for MVP

- Online payment collection via Stripe or similar (couples pay via bank transfer or existing method)
- Tax / GST line items
- Deposit + balance split (partial payments)
- Recurring invoices
- PDF export (browser print is sufficient)
- Automated overdue reminders to couple (email/SMS)
- Xero / MYOB / accounting software integration
- Multi-currency

---

## User Stories

1. As an MC, I can create an invoice from an accepted quote so I don't have to re-enter line items.
2. As an MC, I can create an invoice from scratch on any couple, even without a quote.
3. As an MC, I can share an invoice link so the couple has a clear, professional payment request.
4. As an MC, I can mark an invoice as paid when I confirm the transfer, keeping my revenue accurate.
5. As an MC, I can see all outstanding invoices at a glance so nothing slips through.
6. As a couple (unauthenticated), I can open the invoice link and see what I owe and how to pay.

---

## MC Workflow

**From an accepted quote:**

1. Open couple profile → Quotes tab → click accepted quote → click "Create Invoice".
2. Invoice is pre-filled with title, line items, and couple from the quote. Due date defaults to 7 days from today.
3. Review and adjust line items, set due date, add payment instructions to Notes (e.g. bank details, reference number to use).
4. Optionally link to an event (if the couple has events — used to update events.price on payment).
5. Save. Invoice created as "draft".
6. Enable share link → copy URL → send to couple via WhatsApp or email.
   - Status updates from "draft" to "sent" automatically when link is enabled.
7. Couple pays via bank transfer (outside Zebri).
8. MC confirms payment → clicks "Mark as Paid" on the invoice builder page.
   - Status → "paid", `paid_at` set.
   - If `event_id` is set, `events.price` is updated to match `invoices.subtotal`.

**From scratch:**

1. Couple Profile → Invoices tab → "+ New Invoice".
2. Fill in title, add line items (description, quantity, unit price), set due date, add payment notes.
3. Optionally link to an event.
4. Continue from step 5 above.

---

## Data Model

See `database-schema.md` for the authoritative schema. Summary:

**New table `invoices`:**

- `couple_id` → FK to couples (not null, cascade delete)
- `event_id` → nullable FK to events (set null on event delete) — links invoice to a specific wedding; used to sync events.price on payment
- `quote_id` → nullable FK to quotes (set null on quote delete) — preserved link if generated from a quote
- `invoice_number` (text, not null) — auto-generated as "INV-001" format (sequential per user)
- `title` (text, required) — e.g. "Wedding MC Services — Smith Wedding"
- `status` (text, default 'draft') — draft | sent | paid | overdue | cancelled
- `subtotal` (numeric(10,2), default 0) — sum of invoice_items.amount; updated on item save
- `due_date` (date, nullable) — defaults to 7 days from creation when generated from a quote
- `notes` (text, optional) — payment instructions, bank name, BSB, account number, reference request
- `share_token` (uuid, not null, default gen_random_uuid())
- `share_token_enabled` (boolean, not null, default false)
- `paid_at` (timestamp with time zone, nullable)
- `user_id` (uuid, not null)
- `created_at` (timestamp)

**New table `invoice_items`:**

- `invoice_id` → FK to invoices (cascade delete)
- `description` (text, required) — e.g. "Wedding ceremony MC (3 hrs)"
- `quantity` (numeric(8,2), not null, default 1.00)
- `unit_price` (numeric(10,2), not null)
- `amount` (numeric(10,2), not null) — stored as `quantity × unit_price`; recalculated on save
- `position` (integer, not null) — ordering, stored as multiples of 1000
- `user_id` (uuid, not null)
- `created_at` (timestamp)

---

## Invoice Status Lifecycle

| State     | Condition                                      | Behaviour                                                                   |
|-----------|------------------------------------------------|-----------------------------------------------------------------------------|
| draft     | Newly created, or link disabled                | Invisible to couple. MC can edit freely.                                    |
| sent      | MC enables share link                          | `share_token_enabled = true`. Link live. Couple can view payment details.   |
| paid      | MC clicks "Mark as Paid"                       | `paid_at` set. If `event_id` is set, `events.price` updated to subtotal.    |
| overdue   | `due_date` < today and status = 'sent'         | Shown with "Overdue" badge on MC's list. Due date shown in red on public page. |
| cancelled | MC explicitly cancels                          | Share link disabled. Invoice excluded from revenue calculations.             |

---

## Anon Access / RLS Design

Follows the timeline and quotes pattern. See `database-schema.md` for RLS conventions.

**`get_public_invoice(token uuid)`** — `SECURITY DEFINER`.

- Checks `share_token_enabled = true` before returning any data
- Returns: invoice_number, title, status, subtotal, due_date, notes, paid_at, items, couple name, MC business_name
- Does not return user_id, event_id, quote_id, or any internal fields
- Returns null if token not found or link is disabled → public page renders "not available" state

**No couple-side write functions.** Invoices are view-only for the couple. Only the MC can mark as paid. This avoids any unauthenticated write access to financial records.

---

## Public Invoice Page States

Route: `/invoice/[token]`

| Page state | Condition                           | What the couple sees                                                              |
|------------|-------------------------------------|-----------------------------------------------------------------------------------|
| Active     | status = 'sent', not overdue        | Invoice number, title, line items, subtotal, due date, notes (payment instructions) |
| Overdue    | status = 'overdue' or due_date past | Same as Active, but due date shown in red with "Overdue" label                    |
| Paid       | status = 'paid'                     | "This invoice has been paid. Thank you." — line items still visible for reference |
| Cancelled  | status = 'cancelled'                | "This invoice is no longer active."                                               |
| Disabled   | `share_token_enabled = false`       | "This invoice is no longer available."                                            |
| Not found  | Token doesn't match                 | "This invoice is no longer available."                                            |

---

## Dashboard Updates

**Outstanding Invoices widget** (bottom section, alongside Outstanding Tasks):

- Up to 10 unpaid invoices (status = 'sent' or 'overdue'), ordered by due_date asc
- Each row: invoice number + couple name + subtotal (right-aligned) + due date
- Overdue due dates shown in text-red-500
- Click row → opens couple profile slide-over
- Empty state: "No outstanding invoices."

**Revenue stat card update:**

Current calculation: `SUM(events.price) WHERE status = 'completed'`

New calculation:
- **Collected**: `SUM(invoices.subtotal) WHERE status = 'paid'` — money actually received
- **Invoiced**: `SUM(invoices.subtotal) WHERE status IN ('sent', 'overdue')` — money requested but not yet received

The dashboard Revenue card shows "Collected" as the primary figure. "Invoiced" shown as a secondary stat beneath it.

---

## Edge Cases

| Scenario                                                          | Behaviour                                                                                                       |
|-------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------|
| MC edits line items after link is enabled                         | Changes live immediately on public page. MC should notify the couple directly (WhatsApp/email).                 |
| MC marks invoice paid before couple opens the link               | Status → paid. Public link shows paid state. No issue.                                                          |
| Invoice linked to event; MC marks paid                            | `events.price` updated to `invoices.subtotal`. Overwrites any previous manually-set price.                      |
| Invoice created without linking to event                          | Revenue tracked via invoices only. `events.price` not touched.                                                  |
| Invoice generated from quote; quote line items changed later      | Invoice items are copied at creation time and are independent. Quote edits do not propagate to invoice.         |
| MC cancels an invoice the couple has already viewed               | Link shows "no longer active." MC should contact the couple directly.                                           |
| Invoice has no due date                                           | Never marked overdue. Due date column shows "—" on MC's invoices list.                                          |
| Multiple invoices linked to the same event                        | `events.price` is updated each time any of them is marked paid — last-paid wins. MC should avoid this scenario. |

---

## Migration

Filename: `20260329000001_add_invoicing_feature.sql`

Covers:

- Create `invoices` table with all columns and FK constraints
- Create `invoice_items` table with FK to invoices (cascade delete)
- RLS: standard `user_id = auth.uid()` CRUD for authenticated users on both tables
- `get_public_invoice(token uuid)` SECURITY DEFINER function
- Index on `invoices.share_token` for fast public-page lookups
- Index on `invoices.couple_id` for fast couple profile queries
- Index on `invoices.event_id` for the events.price update join

---

## Testing

Test file: `tests/e2e/invoicing.spec.ts`

Key test cases:

1. Create invoice from accepted quote — assert title and line items match the quote; subtotal correct
2. Create invoice from scratch — assert it appears in Invoices tab with "Draft" status
3. Add, edit, and remove line items — assert quantity × unit_price = amount; subtotal updates
4. Enable share link — assert status updates to "Sent"
5. Open invoice link unauthenticated — assert invoice number, line items, subtotal, due date, and notes visible
6. Mark invoice as paid — assert status updates to "Paid" and paid_at timestamp is set
7. Mark invoice as paid with event linked — assert events.price is updated to invoice subtotal
8. View overdue invoice (due date in past) — assert due date shown in red and "Overdue" badge visible
9. Disable share link — assert public URL shows "This invoice is no longer available."
10. Cancel invoice — assert status shows "Cancelled" in Invoices tab; excluded from outstanding list

**Mobile tests (Pixel 5 + iPhone 12):**

- Invoices tab scrolls correctly in the couple profile slide-over at 375px
- Invoice builder page is fully usable on mobile — line items, quantity/price fields, total accessible
- Public invoice page renders cleanly at 375px — line items and payment notes readable without horizontal scroll

See `.claude/docs/testing.md` for selector and viewport conventions.
