# Wedding Timeline Feature

## Problem

MCs manage the wedding running order in spreadsheets and email. Every time it changes they re-send. Vendors arrive uncertain of timing. Couples don't have a clear picture of the day. Communication is fragmented and prone to version drift.

## Solution

A structured timeline builder inside the event profile. The MC adds time-stamped items in order, assigns contacts from the event's vendor list, and generates a single shareable link. The link replaces the spreadsheet — when the MC updates the timeline, the link instantly reflects the change. No vendor or couple login required to view it.

## Access Points

The timeline is accessible from two places:

1. **Event Profile slide-over → Timeline tab** — when working within a couple's profile
2. **`/events/[id]/timeline` route** — dedicated full-page editor; bookmarkable, accessible directly, and linked from each event row in the couple's Events tab. Uses the same components as the slide-over tab.

---

## Non-Goals for MVP

- Vendor notifications (no push/email when timeline changes)
- Email delivery of the link from within the app
- Couple login to view or comment
- Comments or confirmation requests from vendors
- PDF generation (browser print is sufficient)
- Expiry timestamps on share links

---

## User Stories

1. As an MC, I can add time-stamped items to an event's running order so the full schedule lives in one place.
2. As an MC, I can assign a contact from the event's vendor list to each timeline item so everyone knows their cue.
3. As an MC, I can drag items to reorder them so I can adjust the sequence on the fly.
4. As an MC, I can enable a shareable link and copy it to send via WhatsApp or email.
5. As an MC, I can disable the link at any time so an outdated version isn't accessible.
6. As an MC, I can regenerate the link to permanently invalidate the previous URL.
7. As a vendor or couple (unauthenticated), I can open the link and see the full, up-to-date timeline without logging in.

---

## MC Workflow

1. Open Couples page → click couple → Events tab → click "Timeline" on an event row (or navigate directly to `/events/[id]/timeline`).
2. Click "Add item" — fill in Time (optional), Title (required), Description, Duration, Assigned contact (optional).
3. Save. Repeat for each agenda item.
4. Drag items by their handle to reorder if needed.
5. Scroll to "Share link" section → toggle on → click "Copy link".
6. Paste the link into WhatsApp, email, or wherever the MC communicates with the couple and vendors.
7. Edit items at any time — the link always shows the current version.

---

## Data Model

See `database-schema.md` for the authoritative schema. Summary:

**New columns on `events`:**

- `share_token` (uuid) — unique URL key; generated on event creation
- `share_token_enabled` (boolean, default false) — link is inactive until explicitly enabled

**New table `timeline_items`:**

- `event_id` → FK to events (cascade delete)
- `start_time` (`time` type, nullable) — stored as HH:MM, displayed as "5:30 PM". Nullable for untimed items. Items sorted by `start_time` ascending; untimed items fall below by `position`.
- `title` (text, required)
- `description` (text, optional)
- `duration_min` (integer, optional)
- `contact_id` → nullable FK to contacts (set null on contact delete)
- `position` (integer) — ordering, stored as multiples of 1000

---

## Share Token Lifecycle

| State       | Condition                       | Link behaviour                                                                                   |
| ----------- | ------------------------------- | ------------------------------------------------------------------------------------------------ |
| Created     | Event row inserted              | `share_token` generated, `share_token_enabled = false`. Link inactive.                           |
| Enabled     | MC toggles on                   | `share_token_enabled = true`. Link immediately live.                                             |
| Disabled    | MC toggles off                  | `share_token_enabled = false`. Token preserved. Link returns not-found.                          |
| Regenerated | MC clicks Regenerate + confirms | `share_token` updated to new UUID. Old URL permanently dead. `share_token_enabled` stays `true`. |

---

## Anon Access / RLS Design

All CRM tables use standard RLS (`user_id = auth.uid()`). The public timeline page is the only unauthenticated data access point.

**Approach:** A `SECURITY DEFINER` Supabase function `get_public_timeline(token uuid)`.

Why a function rather than an anon RLS policy:

- Avoids a complex anon SELECT policy that would require a subquery join on `events` to check `share_token_enabled`
- The function is the single choke point — it checks `share_token_enabled = true` before returning any data
- Returns only safe fields (no `price`, no `user_id`)
- Returns null if token not found or link disabled — consistent with the not-found UI state

**Function signature:**

```sql
get_public_timeline(token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
```

Returns: `{ event: { date, venue, couple: { name }, timeline_items: [...] } }` or null.

The public page calls this function via the Supabase anon client (no service role key needed client-side).

---

## Edge Cases

| Scenario                                               | Behaviour                                                                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Timeline item has no `start_time` set                  | Row renders with "—" in the time column; item sorts below all timed items                                                 |
| Contact deleted after being assigned to an item        | `contact_id` set to null via FK (on delete set null). Public view omits the contact row gracefully — no broken reference. |
| Event has 0 timeline items but link is enabled         | Public page shows event header + "No items added yet." — the link is valid, just empty                                    |
| `share_token_enabled = false`                          | Public page shows "This timeline is no longer available." — not a 403, not a redirect to login                            |
| MC regenerates link while someone has the old URL open | Old URL immediately returns the not-found state on next load                                                              |

---

## Migration

Filename: `20260327000000_add_timeline_feature.sql`

Covers:

- Add `share_token` (uuid, default `gen_random_uuid()`) to `events`
- Add `share_token_enabled` (boolean, not null, default false) to `events`
- Create `timeline_items` table with all columns, FK constraints, and cascade rules
- Create `get_public_timeline(token uuid)` function
- RLS policies for `timeline_items` (authenticated user CRUD)

---

## Testing

Test file: `tests/e2e/timeline.spec.ts`

Key test cases:

1. Add a timeline item — assert it appears in the list with correct time and title
2. Edit a timeline item — assert changes persist on reload
3. Delete a timeline item — assert it is removed
4. Reorder two items via drag — assert new position persists after page reload
5. Enable share link — assert toggle turns on and Copy button becomes active
6. Copy link — assert clipboard contains the correct `/timeline/[token]` URL
7. Open share link in a new incognito context — assert event header and all items are visible
8. Disable share link — assert the public URL now shows "This timeline is no longer available."
9. Regenerate link — assert old URL returns not-found state; new URL shows timeline
10. Assign a contact to an item — assert contact name appears on the public view

**Mobile tests (Pixel 5 + iPhone 12):**

- Timeline tab scrolls correctly within the slide-over panel (no overflow issues)
- Add/Edit modal is fully usable at 375px
- Public page renders cleanly at 375px — timeline rail and item text readable

See `.claude/docs/testing.md` for selector and viewport conventions.
