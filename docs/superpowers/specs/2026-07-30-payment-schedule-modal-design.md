# Payment schedule modal, design

Date: 2026-07-30
Status: approved, ready for an implementation plan
Surface: the Invoice builder modal, reached from the couple profile and from `/payments`

## Problem

The payment schedule feature shipped its authoring UI across three competing
affordances in one small block:

1. a header dropdown labelled "Apply a saved schedule", which also hid rename,
   set-default and delete icons behind each row plus a "Done" button,
2. inline stage rows with drag handles,
3. two footer text links, "Save this as a schedule" and "Update saved schedule".

Nothing told the MC which control changed this invoice and which changed a saved
schedule they reuse. The block also rendered almost entirely at
`text-caption` (0.75rem, equivalent to `text-xs`), while the rest of the app uses
14px for body content and reserves 12px for meta, so the section read as cramped
and secondary to everything around it.

The feature itself is sound. This is a UI redesign. No schema change, no new
server action.

## Decisions

Three questions were settled before designing.

### 1. Editing scope: the library is explicit, the invoice is local

The modal manages the reusable library of saved schedules. Applying one copies
its stages onto this invoice. Later tweaks on the invoice affect only that
invoice, and never propagate to the library unless the MC explicitly saves them
back as a new schedule.

Why: a saved schedule is shared across future invoices. Silently mutating it
because someone shifted one due date on one invoice is the kind of change nobody
notices until several couples have the wrong terms. The two surfaces having two
scopes is worth the extra concept.

### 2. Due date anchoring stays as it is, for now

Saved stages keep their single anchor of "N days after the invoice is issued"
(`payment_schedule_stages.due_offset_days`).

Celebrants generally think about the final payment relative to the wedding, for
example "four weeks before the event". That is a genuine gap and a likely next
piece of work, but it needs a migration, a `resolveStages` branch, and a decision
about couples with no event date yet. It is deliberately out of scope so the
redesign can ship. Recorded under Out of scope below.

### 3. Layout: a list you drill into

One column. Rows are schedules. Clicking a row applies it, which is the common
case in a single tap. A trailing overflow menu holds the management actions.
Editing slides to a focused editor for that schedule.

Rejected: a two-pane list-beside-editor, because the panes must stack on a
Pixel 5 and that means designing and testing two layouts. Also rejected: an
accordion expanding rows in place, because Apply and Save end up side by side
inside every row, which is precisely the ambiguity being removed.

## The invoice surface

### Empty

```
PAYMENT SCHEDULE

The couple pays this invoice in one payment.

[ Apply "Default" ]   25% deposit, then remainder
Choose another schedule
```

The primary button is pre-filled with the MC's default schedule, named, with its
shape summarised beside it. Most invoices use the default, so the common case is
one tap and requires no reading. "Choose another schedule" is a quiet text link
that opens the modal.

Every MC has a default: migration `20260730000000_create_payment_schedules.sql`
seeds one per user and an `auth.users` trigger covers new signups. If the default
is somehow absent, the primary button is replaced by "Add payment schedule",
which opens the modal directly.

### With a schedule applied

```
PAYMENT SCHEDULE                              Change

.  Deposit          25%   $1,400   Paid 12 Jun    v
.  Progress         25%   $1,400   Due 10 Sep   [Mark paid]
.  Final balance    rem   $2,800   Due 09 Dec       x

+ Add stage                          Stages total $5,600 of $5,600
```

Four deliberate properties:

- **"Change" is the only route back into the library.** One door, not three.
- **The resolved dollar amount sits beside the percentage.** That is the number
  the couple asks about, so it should not require arithmetic.
- **A running total, always visible.** It states the sum of the stages against
  the invoice total. When they disagree it becomes a plain warning rather than a
  small red line, because a schedule that does not add up is the single most
  consequential mistake available on this screen.
- **A paid stage has no remove control** and shows the date it was paid. Money
  that has landed cannot be quietly deleted.

Stage rows keep their existing drag-to-reorder, restricted to unpaid stages.

## The modal

### List

```
Payment schedule

  Default                          *    ...
  25% deposit, then remainder

  50 / 50                               ...
  Half up front, half on the day

  Three payments                        ...
  25%, 25%, then remainder

  + New schedule
```

Clicking a row applies that schedule to the invoice and closes the modal. The
overflow menu holds Edit, Duplicate, Set as default, and Delete. The default is
marked with a star.

Row summaries come from a pure helper, not from prose stored in the database, so
they cannot drift from the stages they describe.

### Editor

```
< Back

Name  [ Default                    ]

.  Deposit          [ 25 % ]   [  7 ] days    x
.  Final balance    [ rem  ]   [ 30 ] days    x

+ Add stage

                              Cancel    Save
```

Reached from Edit or from New schedule. Save writes to the library. It does not
touch the current invoice: the MC applies the schedule separately, which keeps
the two scopes visibly distinct.

Leaving with unsaved changes asks for confirmation.

Two consequences of that separation, stated so they are not left to
interpretation:

- **Editing the schedule currently applied to this invoice changes nothing on the
  invoice.** Save returns to the list. To adopt the new shape the MC clicks the
  row to re-apply it. This is the price of decision 1 and the correct trade: the
  alternative is an edit silently rewriting an invoice the MC was not looking at.
- **Re-applying over existing stages preserves paid ones.** `replaceInvoiceStages`
  already deletes only unpaid stages and keeps paid rows, so applying a different
  schedule to a part-paid invoice cannot erase a recorded payment. The modal
  states this when the invoice has at least one paid stage.

Duplicate names the copy by appending " copy" to the source name, and the copy is
never the default.

Deleting asks for confirmation and states that invoices already using the
schedule keep their stages, because invoice stages are copies rather than
references. Without saying so, nobody will risk the button.

## Components

All new files sit under the roughly 150 line ceiling.

| File | Responsibility |
|---|---|
| `components/builders/parts/schedule-library-modal.tsx` | Modal shell. Owns list-or-editor mode, the selected schedule, and the unsaved-changes guard. |
| `components/builders/parts/schedule-library-list.tsx` | Schedule rows, overflow menu, "New schedule". |
| `components/builders/parts/schedule-editor.tsx` | Name field, template stage list, Cancel and Save. |
| `components/builders/parts/schedule-template-row.tsx` | One template stage: label, amount type, value, offset in days, remove. |
| `components/builders/parts/payment-schedule.tsx` | Rewritten invoice section: empty state, timeline, running total, Change. |
| `components/builders/parts/payment-stage-row.tsx` | Restyled invoice stage row. Paid rows lose their remove control. |
| `lib/payments/describe-schedule.ts` | Pure helper turning stages into "25% deposit, then remainder". |

`components/builders/parts/schedule-picker.tsx` is deleted. It is the dropdown
this redesign replaces and nothing else should reference it.

The template row and the invoice stage row stay separate components on purpose.
A template stage carries an offset in days and has no payment state. An invoice
stage carries a real date, a resolved amount, and may be paid. Merging them would
mean a component with two personalities and a pile of conditionals.

## Data flow

`useInvoiceStages` already owns the invoice stages, the library list, and the
resolver validation, so the modal stays presentational and testable.

One addition: expose the default schedule so the empty state can name it.

Library writes call the existing server actions in
`app/(dashboard)/payments/schedule-actions.ts`, which already cover everything
needed, then invalidate the react-query key backing the list:

- `listSchedules()`
- `createSchedule({ name, stages })`
- `updateSchedule({ id, name?, stages? })` handles both rename and stage edits
- `deleteSchedule(id)`
- `setDefaultSchedule(id)`

Applying a schedule to the invoice continues to go through the existing
`onApplySchedule` path and `replaceInvoiceStages`.

## States and error handling

- **Loading:** skeleton rows inside the modal. The invoice section renders its
  timeline from already-loaded stages and does not block on the library.
- **Empty library:** a short line and "New schedule". Reachable only if the MC
  deletes every schedule.
- **Load failure:** shown inline in the modal, not as a toast. The modal is where
  the MC is looking, and a toast about content they cannot see is noise.
- **Save failure:** a toast, with the editor left open and values intact so
  nothing is retyped.
- **Invalid template:** Save is disabled with the reason stated, for two
  remainder stages or percentages exceeding 100. The server enforces this through
  `assertSavable`; saying so before the click is the difference between a form
  and a guess.
- **Resolver validation on the invoice:** unchanged. It still blocks saving the
  invoice, and now also drives the running total warning.

## Styling

- Content moves to `text-sm`. `text-caption` is kept only for true meta, such as
  "Paid 12 Jun" and the uppercase section label.
- Buttons `rounded-xl`. The modal inherits `rounded-2xl` from
  `components/ui/modal.tsx`.
- Semantic tokens only: `bg-surface`, `bg-card`, `text-text`, `text-text-muted`,
  `text-text-subtle`, `border-border`. No arbitrary colour values.
- Shared primitives only for form controls: `Button`, `Input`, `Select`,
  `DatePicker`, `ConfirmDialog`. No raw `button`, `input` or `select`.
- Lucide icons at `strokeWidth={1.5}`.
- Every interactive element gets `cursor-pointer`.
- No boxes inside boxes. Stage rows sit directly on the modal surface, separated
  by the existing dashed timeline, matching how the couple overview and events
  sections read.
- Works on desktop, Pixel 5 and iPhone 12 using Tailwind responsive prefixes.
  No raw CSS media queries.

## Testing

Unit, with React Testing Library and semantic selectors:

- `describeSchedule`: remainder stages, a single stage, fixed amounts, and
  percentage combinations.
- The running total: matching, short, and over.
- The empty state offers the default schedule by name.
- A paid stage renders no remove control.
- The modal: clicking a row applies and closes, overflow menu actions fire, the
  unsaved-changes guard prompts, Save is disabled with a reason for an invalid
  template.

No new integration tests. The server actions are unchanged and already covered by
`tests/integration/payments/schedule-actions.test.ts`. Adding integration tests
for an unchanged server surface would be theatre.

One Playwright flow, on desktop, Pixel 5 and iPhone 12: apply the default, change
to another schedule, edit a schedule, and confirm the invoice reflects it.

## Out of scope

- **Event-date anchoring** for saved stages, for example "four weeks before the
  event". Decided above. Needs a migration adding an anchor column, a
  `resolveStages` branch, and a defined behaviour for couples with no event date.
- **A schedules manager in Settings.** The library is managed where it is used.
  Adding a second editing surface would reintroduce the ambiguity this redesign
  removes.
- **Reordering saved schedules** in the list. They sort with the default first,
  then by name.
- **The stageless invoice status question** noted during Task 16, where
  `lib/payments/invoice-status.ts` treats "no stage rows" as paid. Unrelated to
  this surface and needs its own decision.
