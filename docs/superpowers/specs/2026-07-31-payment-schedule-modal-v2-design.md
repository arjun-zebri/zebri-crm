# Payment schedule modal, redesign v2

Date: 2026-07-31
Status: approved, ready for an implementation plan
Surface: the Invoice builder, reached from the couple profile and from `/payments`
Supersedes the UI of: `docs/superpowers/specs/2026-07-30-payment-schedule-modal-design.md`

## Problem

The 2026-07-30 redesign shipped, and the authoring UI is still wrong:

- The invoice empty state leads with `Apply "Default"`, a summary line, and a
  "Choose another schedule" link. It is noisy and the primary action is not
  what the MC wants to reach for.
- Editing a schedule is a modal (the library) opened over the invoice builder
  (itself a modal), and inside it Edit swaps to a second view, and delete /
  unsaved-changes raise a third stacked confirm dialog. It reads as modal on
  modal on modal.
- The template stage row has two bare numeric inputs with spinner arrows and no
  labels, so the two numbers (percent value, offset days) have no visible
  meaning.
- Control sizes, corner radii, and text sizes are inconsistent; some inputs are
  too large.
- Timing is days-only. Celebrants think in weeks and months too.

This is a UI redesign plus one schema addition (a time-unit column). The
server actions, RLS, and the pure resolver stay in place and are extended, not
rewritten.

## Decisions

Five questions were settled before designing.

### 1. One modal, no stacking

Everything happens in a single modal over the invoice builder. There is no
list-vs-editor mode and no stacked confirm dialog. Choosing a saved schedule is
a dropdown at the top; deleting one is an inline action with an undo toast, not
a dialog. Cancel discards the draft (the invoice is untouched until Apply), so
there is no unsaved-changes guard to stack.

### 2. Apply to the invoice only; saving to the library is explicit

The modal edits this invoice's schedule. The Start-from dropdown loads a saved
schedule as a starting point. **Apply** resolves the draft against this
invoice's total and issue date and writes the invoice's stages; it never
touches saved templates. **Save to library** is a separate, optional action
that persists the current timeline as a new named template. Nothing reaches the
library unless the MC clicks it. This removes the two-scope ambiguity of v1:
there is no path where editing an invoice silently rewrites a reused template.

### 3. Flexible timing via a stored unit

Timing is expressed as `<value> <unit> after issue`, where unit is `day`,
`week`, or `month`. This is stored, not converted in the UI, so `1 month`
resolves to a real calendar month and reads back as `1 month`. It needs a
migration adding `due_offset_value` + `due_offset_unit`, a `resolveStages`
branch, and offset columns on the invoice stage rows so the chosen unit
round-trips when the MC reopens a part-built invoice.

Event-date anchoring ("4 weeks before the wedding") is still **out of scope** —
see below. This decision only makes the *issue-relative* offset flexible.

### 4. Keep editable per-stage labels

Each timeline row keeps a short editable label ("Deposit", "Final balance"),
which also shows on the couple's invoice. New rows default to `Payment N`.

### 5. Manage saved schedules inline; Save always creates new

- The Start-from dropdown lists saved schedules with the default starred. Each
  row has a set-default star and a delete (with an undo toast that re-creates
  the schedule). No separate management surface, no stacked dialog.
- **Save to library** always creates a new saved schedule. If the name already
  exists it appends " copy". It never overwrites, so a Save cannot quietly
  change a template the MC reuses.

## The invoice surface

### Empty

```
PAYMENT SCHEDULE

The couple pays this invoice in one payment.

[ Add schedule ]
```

One button. It opens the modal, pre-loaded with the MC's default schedule when
one exists (migration `20260730000000` seeds a "Default" per user), so the
common case is still open-and-Apply. No summary line, no second link.

### With a schedule applied

Unchanged from v1 in shape: the resolved timeline (label · value · resolved
dollars · due/paid date · state pill), drag-to-reorder on unpaid stages, an
always-visible running total that turns to a plain warning when the stages do
not sum to the invoice, and a paid stage with no remove control. The one route
back in is **Change**, which opens the modal loaded with this invoice's current
stages. Typography is normalised to `text-sm` with `text-caption` only for meta.

## The modal

A single scrolling surface, top to bottom:

```
Payment schedule                                          x

Start from  [ * Default · 25%, then remainder        v ]

Name        [ 50 / 50 split                             ]

  .  [ Deposit       ]  [ 25%      v ]  due [  7 ] [ days  v ] after issue   x
  |
  .  [ Final balance ]  [ Remaining v ]  due [  1 ] [ month v ] after issue   x

  + Add payment

                                        Stages total $5,000 of $5,000

[ Save to library ]                              [ Cancel ]  [ Apply ]
```

- **Start from** is a `Select` of saved schedules, default starred, each row
  carrying a set-default star and a delete (undo toast). Selecting one loads its
  stages into the timeline and its name into Name. There is also a blank "Build
  from scratch" entry.
- **Name** is the schedule's name, used only by Save to library.
- **Timeline rows** each expose: an editable label, an amount-type `Select`
  (`%` / `$` / `Remaining balance`) with a value input that hides for
  Remaining, then the literal word "due", a value input, a unit `Select`
  (`days` / `weeks` / `months`), and the words "after issue". Every number sits
  next to words, so its meaning is unambiguous. A remove control sits at the row
  end (hidden for a paid stage when editing an applied invoice). Adding and
  removing rows animates via the existing auto-animate wrapper.
- **Running total** states the sum of the stages against the invoice total and
  turns to a warning when they disagree.
- **Footer**: `Save to library` (secondary, left), `Cancel` and `Apply`
  (right). Apply is disabled with a stated reason when the draft is invalid
  (two remainders, remainder not last, percentages over 100, or a sum that
  cannot resolve).

## Data flow

The modal owns a draft of *template-shaped* stages:
`{ label, amountType, amountValue, offsetValue, offsetUnit }`. It is
presentational; the invoice builder passes data and callbacks.

- **Load** — opening the modal seeds the draft from either the current
  invoice's applied stages (reopening via Change; offsets read from the stored
  `due_offset_value`/`due_offset_unit` on the invoice stage rows) or the default
  schedule (opening from empty) or a dropdown selection.
- **Apply** — `resolveStages(draft, totalCents, issueDate)` produces resolved
  invoice stages (concrete `due_date`, integer cents, plus the offset value+unit
  carried through), and `replaceInvoiceStages` writes them. Paid stages are
  preserved, exactly as today.
- **Save to library** — `createSchedule({ name, stages: draft })`. Always
  creates; name-collision appends " copy". Then invalidate the
  `['payment-schedules']` query.
- **Set default / Delete** — `setDefaultSchedule(id)` /
  `deleteSchedule(id)` from the dropdown; delete shows an undo toast that
  re-creates the schedule from the in-memory copy via `createSchedule`.

The hook (`use-invoice-stages.ts`) already owns the invoice stages, the library
list, and resolver validation. It keeps exposing `defaultSchedule`, `schedules`,
`applySchedule`, `createSchedule`, `deleteSchedule`, `setDefaultSchedule`,
`markPaid`, `persist`, and gains nothing new beyond the type change for units.

## Schema and resolver

A new migration (`payment_schedule_stages` and `invoice_payment_stages`):

- `payment_schedule_stages`: add `due_offset_value integer not null default 0`
  and `due_offset_unit text not null default 'day'`
  (`check (due_offset_unit in ('day','week','month'))`). Backfill
  `due_offset_value = due_offset_days`, `due_offset_unit = 'day'`.
- `invoice_payment_stages`: add the same two columns, nullable (older rows have
  only a `due_date`). They let the modal round-trip the MC's chosen unit; the
  concrete `due_date` stays the source of truth for the public invoice and PDF.
- `due_offset_days` on `payment_schedule_stages` is **kept but deprecated**. The
  migration sets it `default 0` (today it is `not null` with no default) so new
  inserts can omit it, and it is backfilled once into `due_offset_value`. New
  code reads and writes only `due_offset_value`/`due_offset_unit`; the column is
  never written again and a later `@ALLOW_DESTRUCTIVE` migration drops it. No
  "day-equivalent" is computed on write, because a calendar `month` has no fixed
  day count. Every current reader of `due_offset_days` is ours and is migrated
  in this change (audit: `load-default-schedule.ts`, `schedule-actions.ts`; the
  public invoice RPC reads `invoice_payment_stages`, not the template table, so
  it is unaffected).

Because migration `20260730000000` is not yet deployed to the remote DB, this
migration ships alongside it in the same CI deploy.

`resolve-stages.ts` changes:

- `TemplateStage` gains `offsetValue: number` + `offsetUnit: 'day' | 'week' |
  'month'` (replacing `dueOffsetDays` at the type level; the DB day-equivalent
  is computed at the persistence boundary).
- `addOffset(issueDate, value, unit)` replaces `addDays`: `day` adds days,
  `week` adds `value * 7` days, `month` adds `value` calendar months in UTC
  (clamping to end-of-month, e.g. issue Jan 31 + 1 month = Feb 28/29).
- `toTemplateStages` maps a resolved stage's stored offset value+unit straight
  through; when only a `due_date` is present (legacy invoice rows) it falls back
  to `day` with `daysBetween`.

## Components and files

Collapse the v1 four-part library (`schedule-library-modal`,
`schedule-library-list`, `schedule-editor`, `schedule-template-row`) into:

| File | Responsibility |
|---|---|
| `components/builders/parts/schedule-modal.tsx` | The single modal: Start-from dropdown (with inline set-default / delete), Name, the draft timeline, running total, Save to library, Cancel, Apply. Owns the draft and validation. |
| `components/builders/parts/schedule-stage-row.tsx` | One draft timeline row: label, amount-type select + value, "due" value + unit select + "after issue", remove. Replaces `schedule-template-row.tsx`. |
| `components/builders/parts/payment-schedule.tsx` | Rewritten empty state ("Add schedule"), keeps the applied timeline + running total + "Change"; renders `ScheduleModal`. |
| `components/builders/parts/payment-stage-row.tsx` | Unchanged from v1 (applied invoice stage row). |
| `lib/payments/describe-schedule.ts` | Unchanged; still summarises a schedule for the dropdown rows. |

Deleted: `schedule-library-modal.tsx`, `schedule-library-list.tsx`,
`schedule-editor.tsx`, `schedule-template-row.tsx` (and their tests).

## States and error handling

- **Loading**: the modal shows skeleton dropdown + rows; the invoice section
  renders its applied timeline from already-loaded stages.
- **Empty library**: the Start-from dropdown shows only "Build from scratch".
- **Library load failure**: inline in the dropdown area, not a toast.
- **Invalid draft**: Apply (and Save to library) disabled with the reason
  stated, for two remainders, remainder not last, percentages over 100, or an
  unresolvable sum. The server still enforces via `assertSavable`.
- **Apply / Save failure**: a toast; the modal stays open with values intact.
- **Delete**: optimistic, with an undo toast that re-creates the schedule.

## Styling

- One modal over the builder (`Modal` with `nested`); dropdowns render in
  portals above it. No further modal layers.
- Every control is `h-9`, `rounded-xl` (or the shared control radius), `text-sm`.
  Number inputs drop the spinner (`[appearance:textfield]`). Amount type and
  time unit are `Select`, never bare inputs.
- Semantic tokens only; Lucide at `strokeWidth={1.5}`; `cursor-pointer` on
  interactives; no boxes inside boxes.
- Works on desktop, Pixel 5, iPhone 12 with Tailwind responsive prefixes; rows
  wrap gracefully on narrow widths.

## Testing

Unit, with React Testing Library and semantic selectors:

- `resolve-stages`: `addOffset` for day/week/month including month-end clamping;
  `resolveStages` unchanged validation still passes with the new offset shape.
- `describeSchedule`: unchanged.
- `schedule-stage-row`: label and offset-value edits fire; the value field hides
  for Remaining; Radix `Select` option-selection is asserted by render state
  (jsdom limitation, per `select.test.tsx`).
- `schedule-modal`: loading a saved schedule from the dropdown seeds the
  timeline; Add/remove payment; Apply fires with resolved stages and closes;
  Save to library creates; Apply disabled with a reason for an invalid draft;
  delete fires with an undo affordance.
- `payment-schedule`: empty state shows "Add schedule" and opens the modal;
  applied state shows the running total and "Change".

Integration: extend `tests/integration/payments/schedule-actions.test.ts` only
if the create/list round-trip needs the new columns asserted; the actions are
otherwise unchanged.

One Playwright flow (desktop + Pixel 5 + iPhone 12): open Add schedule, load the
default, change a stage to `2 weeks`, add a payment, Apply, confirm the invoice
reflects it; reopen via Change and confirm the unit round-trips. Deferred to CI
/ isolated local Supabase, as the migration is not on the remote dev DB.

## Out of scope

- **Event-date anchoring** ("4 weeks before the event"). Still deferred; needs a
  separate anchor concept and a defined behaviour for couples with no event date.
- **A schedules manager in Settings.** Management stays inline in the dropdown.
- **Reordering saved schedules** in the dropdown. Default first, then by name.
- **Dropping `due_offset_days`.** Kept for back-compat; a later destructive
  cleanup migration removes it once all readers use value+unit.
- **The stageless-invoice status question** in `lib/payments/invoice-status.ts`
  (treats "no stage rows" as paid). Unrelated; needs its own decision.
