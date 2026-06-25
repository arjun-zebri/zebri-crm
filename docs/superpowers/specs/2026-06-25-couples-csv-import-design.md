# Couples CSV Import — Design

**Date:** 2026-06-25
**Branch:** `feature/couples-csv-import`
**Status:** Approved design, pre-implementation

## Problem

MCs and celebrants onboard to Zebri with an existing book of business —
a spreadsheet of couples and leads. Today the only way in is the
one-at-a-time **New couple** modal. We need a bulk path: upload a CSV
and create many couples at once, the way a real CRM importer works
(template, preview, per-row validation, partial import).

## Goals

- Let an MC import many couples from a CSV in one pass.
- Match Zebri's existing look and feel exactly (tokens + primitives,
  calm and minimal, mirror the existing couple modal).
- Behave like a real CRM importer: downloadable template, two-step
  upload → preview, per-row validation with reasons, duplicate
  flagging, partial import, clear summary.
- Respect the Starter-plan couple cap without dead-ending the user.

## Non-goals (YAGNI)

- No column-mapping UI. The template defines fixed headers; we map by
  header name. (A custom-mapping step can come later if real uploads
  show messy headers.)
- No import of Events, Contacts, Quotes, or any related rows. Couples
  only — they are standalone (Events/Contacts are separate entities).
- No background/async job queue. Import is synchronous; the 500-row
  cap keeps it well within a single request.
- No undo. Imported couples are deleted via existing bulk delete.

## User flow

1. On the Couples page, the header **New couple** control becomes a
   small dropdown with two items: **Add manually** (the existing
   modal) and **Import from CSV** (new).
2. **Import from CSV** opens a two-step modal.

   **Step 1 — Upload**
   - A drag-and-drop / click-to-select file area (`.csv` only).
   - A **Download template** link — an empty CSV with the exact
     expected headers, generated via the existing `downloadCsv()`
     util.
   - The expected columns listed as helper text.

   **Step 2 — Preview**
   - A table of parsed rows. Each row carries a status badge:
     - **Valid** — checked by default, will import.
     - **Invalid** — unchecked and non-selectable, shows the reason
       (e.g. "Missing couple name", "Invalid email", "Unreadable
       date").
     - **Possible duplicate** — matches an existing couple by primary
       email (case-insensitive) or couple name; unchecked by default
       but the user can re-check it to import anyway.
   - A summary line: "N of M rows will be imported."
   - Primary action **Import N couples**; secondary **Back** / cancel.
3. On import: the couples react-query cache invalidates, the list
   refreshes, the modal closes, and a toast summarizes the result
   ("12 couples imported, 3 skipped").
4. If the file pushed the MC past the Starter couple cap, the first N
   rows that fit the remaining quota import, the overflow is reported
   as skipped, and the existing upgrade surface
   (`StarterCapLockModal`) is shown for the overflow.

## CSV format (the template)

Fixed headers, mapped by name (order-independent, case-insensitive
header match):

| Header            | Required | Notes                                        |
|-------------------|----------|----------------------------------------------|
| `couple_name`     | Yes      | Non-empty, max 200 chars.                    |
| `primary_name`    | Yes      |                                              |
| `primary_email`   | No       | Validated as email when present.             |
| `primary_phone`   | No       |                                              |
| `secondary_name`  | No       |                                              |
| `secondary_email` | No       | Validated as email when present.             |
| `secondary_phone` | No       |                                              |
| `event_date`      | No       | Accepts `YYYY-MM-DD` or `DD/MM/YYYY` (AU),   |
|                   |          | normalized to ISO. Unparseable → row invalid.|
| `venue`           | No       | Max 300 chars.                               |
| `status`          | No       | Falls back to the user's default status when |
|                   |          | blank or not one of their `couple_statuses`. |

Empty cells are allowed for everything except `couple_name`. Unknown
extra columns in the uploaded file are ignored.

## Architecture & components

### New files

- **`app/(dashboard)/couples/couples-import-modal.tsx`** — the two-step
  modal UI. Orchestrator only; ≤ ~150 lines. The preview table is a
  small co-located child (`couples-import-preview.tsx`) if the file
  grows.
- **`lib/utils/csv-import.ts`** — pure, React-free, unit-testable
  helpers (sits beside the existing `csv.ts` exporter):
  - `parseCouplesCsv(text): RawRow[]` — parse via PapaParse, map
    headers to the known fields.
  - `validateRow(row): { value: CoupleInput } | { errors: string[] }`
    — coerce + validate one row (email format, date normalization,
    required couple name).
  - `findDuplicates(rows, existing): Set<rowIndex>` — flag rows whose
    primary email or couple name matches an existing couple.
  - `buildTemplateCsv(): string` — the empty template content.

### Changed files

- **`app/(dashboard)/couples/couples-header.tsx`** — turn **New
  couple** into a dropdown (Radix Popover, matching the existing
  status/lead-source dropdown pattern) exposing **Add manually** and
  **Import from CSV**.
- **`app/(dashboard)/couples/page.tsx`** — own the import modal's
  open/close state alongside the existing `CoupleModal`, wire the
  success callback to the couples query invalidation already used by
  the manual create.
- **`app/(dashboard)/couples/actions.ts`** — add
  `bulkCreateCouplesAction` (see below).
- **`.claude/docs/page-specs.md`** — document the import behaviour.

### New dependency

- **PapaParse** for CSV parsing — small, battle-tested, handles
  quoted fields / embedded commas / escaping correctly. Preferred over
  hand-rolling a parser. Added to `package.json` (+ `@types/papaparse`
  if not bundled).

## Server action (the trust boundary)

`bulkCreateCouplesAction(rows: CoupleInput[]): ActionResult<BulkImportSummary>`
in `couples/actions.ts`:

1. **Auth** — resolve the session user; reject if unauthenticated.
2. **Cap** — reject payloads over 500 rows.
3. **Re-validate every row server-side** with the existing
   `coupleInputSchema`. The client-side preview is convenience only and
   is never trusted. Rows failing server validation are reported back,
   not inserted.
4. **Plan limit** — read the MC's current couple count and plan cap via
   the entitlements helper, compute remaining quota, and slice the
   insert to fit. Overflow rows are returned as `skippedForLimit`.
5. **Insert** the sliced, validated rows in a single `.insert([...])`
   with `user_id` injected from the session (RLS enforces tenancy).
   The existing `STARTER_COUPLE_LIMIT` trigger is a backstop; the
   pre-slice means we don't rely on catching it mid-batch.
6. **Return** `{ created: number, skippedForLimit: number,
   invalidRows: { index: number; reason: string }[] }`.
7. On unexpected DB failure, fire `sendAlert()` and return a tagged
   error result.

## UI / UX styling brief

This must look and behave like it has always been part of Zebri.

- **Primitives only** — `Modal`, `Input`, `Button`, `Loading`,
  `Empty`, `ErrorState` from `components/ui/`. No native `<button>`,
  `<select>`, `<input>` (except the necessary `type="file"`, wrapped
  and visually hidden behind a styled dropzone).
- **Tokens only** — `bg-surface` / `bg-card` / `bg-surface-muted`,
  `text-text` / `text-text-muted` / `text-text-subtle`,
  `border-border`. No raw hex, no arbitrary-value colour utilities.
- **Calm, no boxes-in-boxes** — mirror the spacing and rhythm of the
  existing `couple-modal.tsx` and `couple-overview.tsx`. The preview
  table should read like the existing couples list, not a bordered
  grid stacked inside the modal.
- **Status badges** reuse the same pill styling as couple status chips
  (valid = subtle/positive, invalid = subtle danger, duplicate =
  muted/warning) in semantic tokens.
- **Buttons** `rounded-xl`, Lucide icons `strokeWidth={1.5}`
  (`Upload`, `FileSpreadsheet`, `Download`), interactive elements get
  `cursor-pointer`.
- **States** — explicit loading (parsing / importing), empty (no rows
  parsed → friendly `Empty`), and error (parse failure / server error
  → `ErrorState`). No console errors.
- **Responsive** — works on desktop and mobile (Pixel 5 + iPhone 12).
  The preview collapses to a readable stacked layout on narrow
  screens; the dropzone and template link stay usable on mobile.
- **Modal size** — the wide (`xl`) modal size, matching other
  multi-field couple flows.

## Edge cases

- **Empty file / headers only** → friendly empty state, no rows to
  import.
- **Missing `couple_name` header entirely** → top-level error telling
  the user the file is missing the required column; offer the
  template.
- **Whitespace-only cells** → trimmed; treated as empty.
- **Duplicate rows within the same file** (not just vs existing) →
  flagged as possible duplicates against each other.
- **All rows invalid** → preview shows them with reasons; the import
  button is disabled (nothing checked).
- **Quota already full** → every row reported as skipped-for-limit;
  upgrade surface shown immediately.

## Testing & Definition of Done

Ships as its own PR through `staging` (per the staging-only batch),
meeting the §5 Definition of Done:

- **Unit** (`tests/unit/`): `parseCouplesCsv`, `validateRow`
  (email/date/required cases, AU date format), `findDuplicates`,
  `buildTemplateCsv`.
- **Integration** (`tests/integration/`, local Supabase, real RLS):
  `bulkCreateCouplesAction` — successful batch insert, **cross-tenant
  RLS denial** (a user cannot import couples under another `user_id`),
  Starter-limit slicing (overflow reported, not inserted), 500-row cap
  rejection, server-side re-validation rejects a bad row the client
  would have caught. Tick the couples row in `security.md`'s RLS
  matrix.
- **E2E** (`tests/e2e/`, Pixel 5 + iPhone 12 + desktop): download
  template → upload a CSV → preview shows valid/invalid/duplicate →
  import → couples appear in the list → toast summary.
- No `any`; generated DB types end to end. TSDoc on every exported
  function/type; why-comments on the date-normalization and
  duplicate-detection logic. Components ≤ ~150 lines. Design-system
  compliant. `sendAlert()` wired on unexpected failure.
- **Security checklist**: Zod (`coupleInputSchema`) on server input,
  `user_id` from session, RLS test, 500-row cap as a basic
  abuse guard, no service-role key in any client file.
  Rate-limiting via `@/lib/api/rate-limit` is optional for this
  authenticated mutation; add it if bulk insert proves abusable.

## Open decisions (resolved)

- Field scope: **core contact set** (couple + primary/secondary
  contact, event date, venue, status).
- Invalid rows: **preview + skip bad rows**.
- Duplicates: **flag in preview, user chooses**.
- Entry point: **inside the New couple dropdown**.
- Template: **downloadable**.
- Plan limit: **import up to limit, then prompt upgrade**.
- Parser: **PapaParse**. Row cap: **500**.
