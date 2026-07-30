# Custom payment schedules

Status: approved for planning
Date: 2026-07-28
Revised: 2026-07-30
Owner: Arjun
Supersedes: the fixed deposit + final balance model on invoices

## 1. Problem

Every invoice in Zebri is locked to at most two payment stages: a deposit and a
final balance. The shape is hardcoded in five places, so an MC who wants
"25% now, 50% at ninety days, 25% before the day" has no way to express it.

The two-stage assumption currently lives in:

| Layer | Where |
|---|---|
| Schema | `invoices.deposit_percent`, `deposit_due_date`, `deposit_paid_at`, `final_due_date`, `final_paid_at` |
| Payments | `app/api/stripe/invoice-payment/route.ts` (`paymentType: 'full' \| 'deposit' \| 'final'`) |
| Payments | `app/api/stripe/webhook/route.ts` `processInvoicePayment()` |
| Public page | `app/invoice/[token]/_components/invoice-payment-schedule.tsx` (two hardcoded rows) |
| Builder | `components/builders/invoice-builder-modal.tsx` + `components/builders/parts/payment-schedule.tsx` |
| Branding | the `paymentSchedule` block, its toolbar controls, and its preview sample data |
| Upstream | `packages.deposit_percent` to `proposal_options.deposit_percent` to the `sign_contract` RPC |
| Settings | `default_deposit_percent` on the user |
| Automations | the `has_paid_deposit` condition |

A second, independent problem surfaced while scoping this work, and it is
already live in production. Both invoice reminder emitters filter on
`status = 'sent'` (`lib/automations/time-emitters/invoice-due.ts:186`,
`invoice-overdue.ts:191`). The moment a couple pays a deposit the invoice moves
to `deposit_paid`, so neither emitter matches it again and the outstanding
balance is never chased. With two stages that costs the MC one reminder. With
four stages it would leave three payments unchaseable, which would gut the value
of this feature. Fixing it is therefore in scope. See section 6.

## 2. Goal

An MC can define named, reusable payment schedules of any number of stages,
apply one to an invoice, and have the couple pay each stage in turn on the
public invoice page. Creating a schedule costs no detour: it falls out of
building an invoice once.

Locked decisions from the design conversations:

1. **Reusable saved schedules, no page of their own.** A schedule is a global
   record, authored entirely from inside the invoice builder. There is no
   Schedules tab and no standalone editor.
2. **Creation is a byproduct.** The MC builds stages inline on an invoice and a
   "Save this as a schedule" action stamps it into the library. There is no
   "create a schedule" form anywhere in the app.
3. **Invoices only.** Proposals and packages carry no payment terms at all.
   `packages.deposit_percent` and `proposal_options.deposit_percent` are both
   dropped, and nothing replaces them.
4. **One default schedule** (a flag on a saved schedule) is the single upstream
   source of terms. It seeds a fresh invoice in the builder and the invoice
   `sign_contract` spawns. It replaces the `default_deposit_percent` user
   setting.
5. **Due dates are relative to the invoice date.** A template stage stores an
   offset in days from issue; it does not anchor to the event date.
6. **Amounts are percent, fixed, or remainder.** Mixed within one schedule.
7. **Couples pay the next unpaid stage in order, or pay the full remaining
   balance in one go.** No arbitrary out-of-order stage payment.
8. **Applying is a stamp.** Template rows are copied onto the invoice, and later
   edits to invoice stages never write back to the saved schedule unless the MC
   explicitly asks.
9. **The old columns are backfilled into stage rows and then dropped.** One code
   path afterwards, no dual-read branches.
10. **Reminders re-anchor on stages.** The existing `invoice_due` and
    `invoice_overdue` triggers fire per unpaid stage rather than per invoice.

### Non-goals

Explicitly out of scope, so they are not assumed:

- **Partial payment against a single stage.** The Stripe route builds
  fixed-amount Checkout sessions; a couple pays a stage in full or not at all.
- Refunds and reversals.
- Event-date-anchored offsets. See the risk in section 12.
- Payment terms on proposals or packages. Deliberately removed, not deferred.

## 3. Data model

Three new tables. Template rows are copied onto the invoice at apply time, so
editing a saved schedule never rewrites an invoice that has already been issued.
This mirrors the existing `packages` to `proposal_options` snapshot pattern,
where the option owns its data and `source_package_id` only records provenance.

```
payment_schedules
  id            uuid pk
  user_id       uuid not null references auth.users(id) on delete cascade
  name          text not null
  is_default    boolean not null default false
  created_at    timestamptz not null default now()

payment_schedule_stages
  id                uuid pk
  user_id           uuid not null references auth.users(id) on delete cascade
  schedule_id       uuid not null references payment_schedules(id) on delete cascade
  position          integer not null
  label             text not null
  amount_type       text not null check (amount_type in ('percent','fixed','remainder'))
  amount_value      numeric null
  due_offset_days   integer not null default 0

invoice_payment_stages
  id                        uuid pk
  user_id                   uuid not null references auth.users(id) on delete cascade
  invoice_id                uuid not null references invoices(id) on delete cascade
  position                  integer not null
  label                     text not null
  amount_type               text not null check (amount_type in ('percent','fixed','remainder'))
  amount_value              numeric null
  amount_cents              integer not null
  due_date                  date null
  paid_at                   timestamptz null
  stripe_payment_intent_id  text null
```

`amount_value` is null when `amount_type = 'remainder'`, and non-null otherwise.
`amount_cents` is the resolved figure, stored rather than recomputed on read so
a paid stage cannot shift when the MC later edits a line item.

No table gains a `payment_schedule_id` foreign key. Packages, proposals and
proposal options carry no terms, and an invoice's stages are copied rows rather
than a reference, so provenance is not tracked. If "which schedule did this come
from" is ever wanted, adding a nullable `source_schedule_id` later is additive.

At most one `payment_schedules` row per user may have `is_default = true`,
enforced by a partial unique index on `(user_id) where is_default`.

RLS is enabled on all three with the standard `auth.uid() = user_id` policy for
SELECT, INSERT, UPDATE and DELETE. Indexes on `payment_schedule_stages.schedule_id`,
`invoice_payment_stages.invoice_id`, and `invoice_payment_stages.due_date`. The
`due_date` index carries the reminder emitters in section 6.

### Alternatives rejected

- **One polymorphic `payment_stages` table** with `parent_type` + `parent_id`.
  Fewer tables, but polymorphic parents cannot carry real foreign keys, and
  every RLS policy has to re-derive ownership through a branch. That fights the
  grain of a codebase with RLS on every owned table.
- **JSONB `invoices.payment_stages`.** No joins, but the webhook marking one
  stage paid becomes a read-modify-write of the whole array, which races when a
  couple pays two stages in quick succession, and due dates cannot be indexed
  for the reminder emitters.
- **A schedule per proposal option.** Considered and dropped. A proposal has one
  set of terms at most, and options sourced from different packages would each
  claim it, so any resolution rule is a rule the MC has to learn. Proposals
  carrying nothing at all is simpler and was the final decision.

## 4. Resolving a schedule onto an invoice

One pure module, `lib/payments/resolve-stages.ts`, used by the builder preview
and the server action, so the preview and the persisted result cannot disagree.

```ts
resolveStages(templateStages, invoiceTotalCents, issueDate) => InvoiceStage[]
toTemplateStages(invoiceStages, issueDate) => TemplateStage[]
```

`resolveStages` is the apply direction:

- `due_date` = issue date + `due_offset_days`. Issue date is the invoice's
  `created_at`, or the date it was first sent if that is later. Editable per
  stage afterwards.
- `percent` resolves against the invoice total: subtotal plus tax, after
  discount, matching what `invoice-payment/route.ts` already computes.
- `fixed` is taken literally.
- `remainder` absorbs whatever is left after all other stages.

`toTemplateStages` is the save direction, needed because "Save this as a
schedule" turns concrete invoice stages into a portable template. Each stage's
`due_date` becomes `due_offset_days` as a whole-day difference from the issue
date; amount type and value carry across unchanged. A stage with a null
`due_date` saves as offset `0`.

### Validation rules

Enforced in the same module, surfaced in the builder rather than clamped
silently:

1. Zero or one `remainder` stage. If present it must be last.
2. Without a `remainder` stage, percents plus fixed amounts must equal the total
   exactly.
3. Rounding: amounts resolve to integer cents and the last stage takes the
   remainder, so stages always sum to the invoice total to the cent.
4. A `fixed` stage exceeding the total remaining is a validation error, not a
   clamp. This is the "$500 fixed on a $400 invoice" case.
5. Zero stages is valid: the invoice behaves as a single-payment invoice, which
   is today's behaviour when `depositEnabled` is false.
6. A one-stage schedule is rejected on save, because it is equivalent to no
   schedule. "Pay in full" is the absence of a schedule, and appears as a
   "No schedule (single payment)" entry at the top of the picker rather than as
   a saved record.

### Re-resolution

When the invoice total changes after stages exist:

- `percent` and `remainder` stages re-resolve.
- `fixed` stages are left alone.
- Stages with a non-null `paid_at` are never touched.
- If the change makes the schedule invalid (for example, paid stages now exceed
  the new total), the builder warns and blocks save until the MC fixes it.

## 5. Payment flow

### Stripe route

`app/api/stripe/invoice-payment/route.ts` changes `paymentType` from
`'full' | 'deposit' | 'final'` to `'stage' | 'remaining'`:

- `stage` carries a `stageId`. The route asserts it is the earliest unpaid stage
  on the invoice, which generalises the current "final is blocked until deposit
  is paid" check at line 106.
- `remaining` settles every unpaid stage in one charge.
- Session metadata gains `stage_ids`, a comma-separated list, so the webhook
  knows exactly which stages the payment closes out.

The Zod body schema, rate limit, share-token check, and Connect account lookup
are unchanged.

### Webhook

`processInvoicePayment()` in `app/api/stripe/webhook/route.ts` stamps `paid_at`
and `stripe_payment_intent_id` on each stage id in the metadata, then derives
the invoice status rather than hardcoding it:

| Stages paid | Invoice status |
|---|---|
| none | unchanged |
| some | `deposit_paid` |
| all | `paid`, with `paid_at` set and the event price mirrored, as today |

If a `stage_ids` entry does not resolve to a stage row on the invoice, the
webhook stamps the stages it can and raises a Slack alert via `sendAlert()`
rather than failing silently. Money has already moved at that point, so a
mismatch between session metadata and the stage rows needs a human.

The stored status value `deposit_paid` is kept rather than renamed to
`partially_paid`. It is a slight misnomer under multi-stage, but renaming it
would touch the badge maps in `app/(dashboard)/payments/invoices-list.tsx`, the
automations conditions, and any saved filters. It is relabelled to "Part paid"
in the UI instead.

## 6. Reminders

Both reminder emitters re-anchor on stage rows. This repairs the live bug in
section 1 and makes each payment chaseable on its own date.

### Candidate selection

`invoice_due` and `invoice_overdue` select unpaid stages rather than invoices:

```
select stage.id, stage.label, stage.position, stage.amount_cents, stage.due_date
from invoice_payment_stages stage
join invoices i on i.id = stage.invoice_id
where stage.paid_at is null
  and stage.due_date = <today + lead>          -- invoice_due
  and i.status in ('sent', 'deposit_paid')     -- was: = 'sent'
```

`invoice_overdue` uses its existing overdue comparison against `stage.due_date`
instead of `i.due_date`. Draft, paid and cancelled invoices remain excluded.

### Dedupe

Today the dedupe key is `(source_id, event_type, days_until_due)`, checked in
`alreadyEmittedToday()` at `invoice-due.ts:142`. Two stages falling due on the
same day would collapse into a single event under that key. The payload check
gains `stage_id`. `source_table` and `source_id` stay on the invoice so the
couple's automations feed and the `emit_automation_event` couple linkage keep
working unchanged.

### Payload

The event payload gains `stage_id`, `stage_label`, `stage_position`,
`stage_count` and `stage_amount_cents`, so reminder email copy can read "your
second payment of $2,800 is due in 3 days" rather than only naming the invoice.
Existing payload fields are untouched, so templates that reference them keep
rendering.

### `isFinalBalance`

`lib/automations/triggers.ts:112` already accepts an `isFinalBalance` config
field on both triggers. No emitter reads it and no inspector exposes it, so it
is dead config today. With per-stage firing it becomes meaningful: it narrows to
`stage_position === stage_count`, and gets a checkbox in the trigger inspector
labelled "Only the final payment".

### Invoices with no stages

A single-payment invoice has no stage rows to anchor on, so it keeps firing off
the invoice's own `due_date` exactly as today. Both paths stay live and the
emitters run each in turn.

### `has_paid_deposit`

The condition at `lib/automations/conditions.ts:175` is redefined as "the first
stage is paid". Note that it currently reads `ctx.couple.deposit_paid_at` and the
`couples` table has no such column, so the condition appears to always evaluate
false today. This is to be verified during implementation and fixed as part of
this work rather than ported forward.

## 7. Authoring surface

There is no Schedules tab and no standalone editor. Everything happens in the
invoice builder.

### The stage timeline

`components/builders/parts/payment-schedule.tsx` is already a vertical timeline
with per-stage dots, state pills, dates and Mark-paid buttons. It generalises to
N rows without a redesign:

```
Payment schedule                    [ Apply a saved schedule ▾ ]

● Deposit    25% · $1,400    Paid 12 Jun              ✓
┊
○ Progress   50% · $2,800    Due 10 Sep    [Mark paid]  ⋮ ✕
┊
○ Final      rem · $1,400    Due 09 Dec               ⋮ ✕

+ Add stage                    Save this as a schedule ↗
```

Each unpaid row edits inline: label, amount type (`%`, `$`, remainder), value,
and date. Paid rows lock, as they do today. A drag handle reorders, `✕` removes.

### The picker

Modelled directly on `app/(dashboard)/templates/category-picker-base.tsx`, whose
own docstring calls it "the Notion pattern": a Select-looking trigger, a popover
listing the saved schedules, click to apply, plus an Edit mode for rename,
delete, set-as-default and reorder. There is no create form inside the popover.

The list is topped by a "No schedule (single payment)" entry, which clears the
stages. An empty library reads "No saved schedules yet. Build one below and save
it", which is the whole cold-start answer now that the invoice builder is the
only authoring surface.

The default star lives in the picker's Edit mode, so setting a default never
requires a trip to Settings. The `default_deposit_percent` field is removed from
Settings.

### Saving

"Save this as a schedule" runs `toTemplateStages` and writes a
`payment_schedules` row plus its stages. When a saved schedule is currently
applied *and* has since been modified, the action offers two choices: "Update
`<name>`" and "Save as new". With nothing applied, or nothing changed, it is a
single "Save as new".

### Files

`invoice-builder-modal.tsx` is 986 lines and `payment-schedule.tsx` is 254, both
well past the ~150-line guidance before this change adds to them. The split,
targeted at the code this feature touches rather than a general refactor:

| File | Role |
|---|---|
| `lib/payments/resolve-stages.ts` | pure resolver, validation, and the save-direction inverse |
| `components/builders/parts/payment-schedule.tsx` | timeline shell |
| `components/builders/parts/payment-stage-row.tsx` | one editable row |
| `components/builders/parts/schedule-picker.tsx` | the popover |
| `components/builders/parts/use-invoice-stages.ts` | stage state, apply and save mutations |

`invoice-builder-modal.tsx` itself changes as follows:

- `depositEnabled`, `depositPercent`, `depositDueDate`, `finalDueDate` collapse
  into one `stages` array behind `use-invoice-stages.ts`.
- `hasDepositSchedule` becomes `stages.length > 0`.
- The auto-save-before-mark-paid workaround at lines 280 to 292 is removed.
  Stages are rows that exist independently of the Save button, so the
  "schedule is enabled if a payment was recorded before it was persisted" case
  cannot arise.

## 8. Rendering surfaces

### Public invoice page

`invoice-payment-schedule.tsx` maps over stages instead of rendering two
hardcoded blocks. Row markup, branding-driven typography and the paid check are
unchanged, just data-driven. `get_public_invoice` returns a `stages` array.

Buttons: one live Pay button on the earliest unpaid stage, a muted "available
once the previous payment clears" line on later ones, and a pay-in-full action
for the remaining balance.

### Branding block

The `paymentSchedule` block previews and styles exactly two rows today,
including the toolbar controls at `app/(dashboard)/branding/blocks/block-toolbar.tsx:1748`
which target the deposit and final rows individually. Changes:

- Row style controls become row-generic: one set applying to all rows.
- Preview sample data at `app/branding/preview/[surface]/page.tsx:106` grows to
  three stages so MCs see a realistic multi-stage layout.
- The block description in `app/(dashboard)/branding/blocks/types.ts:494`,
  currently "Deposit & final balance (live invoice data)", is updated.

### Contract and document variables

`{{deposit_amount}}` is a live merge field. The starter contract at
`lib/contracts/starter-contracts.ts:108` reads "A non-refundable deposit of
`{{deposit_amount}}` is payable within 7 days of signing this agreement", so it
cannot be allowed to render empty.

`lib/contracts/contract-variables.ts:66` currently resolves it as
`input.proposal?.depositPercent ?? input.depositPercent ?? 25`. All three sources
disappear. It is redefined as the first stage of the invoice's schedule, falling
back to the first stage of the user's default schedule when the contract has no
invoice yet, and to `-` when the user has no default schedule at all. The same
redefinition applies to `deposit_amount` and `deposit_due_date` in
`lib/branding/document-variables.ts:56`, whose descriptions are updated to say
"first stage".

## 9. Migration

A single migration, ordered so the destructive steps run after the backfill in
the same transaction. A failed backfill takes the drops down with it.

1. Create `payment_schedules`, `payment_schedule_stages`, `invoice_payment_stages`
   with RLS, policies and indexes as in section 3.
2. Backfill invoices: every invoice with a non-null `deposit_percent` or
   `deposit_paid_at` becomes two stage rows, a `percent` deposit and a
   `remainder` final, carrying existing due dates, paid timestamps and resolved
   `amount_cents`. Invoices without a schedule get no rows.
3. Backfill saved schedules: for each user with a `default_deposit_percent`,
   create one schedule named "Default" with `is_default = true`, holding that
   percentage plus a remainder stage.
4. Drop `deposit_percent` from `packages` and from `proposal_options`. Nothing
   replaces them.
5. Drop `deposit_percent`, `deposit_due_date`, `deposit_paid_at`,
   `final_due_date`, `final_paid_at` from `invoices`.
6. Replace `get_public_invoice` (returns `stages`), `get_public_proposal` (loses
   `deposit_percent`), and `sign_contract`, which currently computes
   `coalesce(v_proposal.option_deposit_percent, 25)` at
   `supabase/migrations/20260711000000_drop_quotes_feature.sql:108` and instead
   copies the user's default schedule onto the invoice it spawns. Where the user
   has no default schedule, the spawned invoice gets no stages and behaves as a
   single-payment invoice.

Steps 4 and 5 need an explicit marker or `scripts/check-migrations.sh` rejects
the deploy:

```sql
-- @ALLOW_DESTRUCTIVE: replaced by invoice_payment_stages, backfilled in step 2
```

Deployed through CI `supabase db push`, never the Supabase web SQL editor.

## 10. Application fallout

Dropping terms from packages and proposals widens the change beyond the payment
surfaces. The full list:

| File | Change |
|---|---|
| `lib/contracts/contract-variables.ts:66` | `deposit_amount` sources the first stage; `-` when no schedule |
| `app/api/email/send-contract/route.ts:113` | drop the `user_metadata.default_deposit_percent` read |
| `components/builders/contract-builder-modal.tsx:313` | drop the `user_metadata.default_deposit_percent` read |
| `lib/branding/document-variables.ts:56` | redefine `deposit_amount` / `deposit_due_date` as first stage |
| `lib/branding/public-blocks/shared.ts:66` | `schedule` shape becomes a stages array |
| `lib/branding/public-blocks/payment-schedule.tsx:46` | map over stages |
| `app/(dashboard)/branding/blocks/block-toolbar.tsx:1748` | row style controls become row-generic |
| `app/branding/preview/[surface]/page.tsx:106` | three sample stages |
| `app/(dashboard)/branding/blocks/types.ts:494` | block description |
| `lib/payments/proposal-view.ts:36` | drop `deposit_percent` |
| `components/builders/parts/proposal-option-card.tsx:72` | drop the deposit terms chip |
| `components/builders/parts/use-apply-sources.ts` | drop `depositPercent` from both sources |
| `app/(dashboard)/templates/package-edit-form.tsx:236` | remove the "Booking deposit" field |
| `app/(dashboard)/payments/invoices-list.tsx` | relabel `deposit_paid` to "Part paid" |
| Settings | remove the `default_deposit_percent` field |

The two `user_metadata` reads are worth calling out. A deposit percentage is not
a trust-level field, so this is not a §7.4 privilege hole, but `user_metadata` is
user-writable and moving the default onto a `payment_schedules` row removes both
reads for free.

One accepted consequence: the couple no longer sees payment terms on the
proposal, because `proposal-option-card.tsx:72` loses its "30% deposit" chip. The
contract's deposit clause and the invoice itself both still state the terms, so
this was judged acceptable.

## 11. Testing

### Unit

The resolver is a pure module and carries the bulk of the coverage:

- Percent-only schedule summing to 100.
- Mixed fixed plus remainder.
- Rounding, asserting stages always total the invoice to the cent.
- Fixed-exceeds-total raises a validation error.
- Remainder not last is rejected; two remainders rejected.
- One-stage schedule rejected on save.
- Re-resolution when the invoice total changes with some stages already paid.
- `toTemplateStages` round-trips: resolve, then save, then resolve again against
  a different issue date and assert the offsets held.

Plus extended coverage in `tests/unit/lib/payments/webhook-events.test.ts` for
the new `stage` and `remaining` metadata shapes, and in the emitter tests:

- A paid first stage still yields events for the later stages, which is the
  regression that exists today.
- Two stages due the same day produce two events, not one.
- `isFinalBalance` fires only on the last stage.
- An invoice with no stage rows still fires off its own `due_date`.

### Integration (local Supabase, real schema, real RLS)

- Cross-tenant RLS denial on all three new tables, ticked into the coverage
  matrix in `.claude/docs/security.md`.
- The partial unique index rejects a second default schedule for one user.
- The backfill migration replayed from zero against seeded legacy invoices,
  asserting the resulting stage rows match the old column values.
- `sign_contract` copying the user's default schedule onto the spawned invoice,
  and spawning a stageless invoice when the user has no default.

### E2E (Playwright, desktop + Pixel 5 + iPhone 12)

Build a three-stage invoice from scratch, save it as a schedule, apply that
schedule to a second invoice, send it, pay stage one on the public page, confirm
stage two unlocks and stage three stays locked, then pay in full to close it out.

## 12. Risks

**Invoice-anchored offsets versus long lead times.** `sign_contract` spawns the
first invoice at contract signing, often 12 to 18 months before the wedding. A
stage at "+60 days" therefore falls due roughly a year before the event. This is
workable if MCs issue a later invoice closer to the date, and per-stage dates
stay editable on every invoice, but if MCs in practice want a single invoice
covering the whole engagement, event-date anchoring becomes necessary. Adding an
`anchor` column to the stage tables later is additive and does not require
revisiting this design.

**Destructive migration.** Seven columns dropped across three tables. Mitigated
by same-transaction ordering, the replay-from-zero integration test, and the fact
that the backfill is a pure function of columns that are not written during the
migration.

**Reminder behaviour changes for existing automations.** An MC with a live
`invoice_due` automation will start receiving events for stages that previously
emitted nothing. That is the intended repair, but it is a behaviour change on
production automations rather than a new opt-in trigger, so it belongs in release
notes.

**Authoring is discoverable only from the invoice builder.** Removing the
Schedules tab is what makes this feature cheap to use, but it also means an MC
who wants to tidy their library has to open an invoice to do it. Accepted: the
picker's Edit mode covers rename, delete, reorder and default, which is the whole
management surface, and the library is small by nature.

## 13. Definition of done

Per `.claude/docs/production-readiness.md` §5, plus:

- No `any`; generated `Database` types end to end.
- TSDoc on every exported function and type; why-comments on the resolver's
  rounding and validation rules, and on the emitter dedupe change.
- Loading, empty and error states on the picker popover.
- Works on desktop and mobile. The stage rows and the popover both have to hold
  up at Pixel 5 width, which is the tightest constraint on the row editor.
- `.claude/docs/database-schema.md`, `page-specs.md`, `payments.md`,
  `alerts.md`, `testing.md` and `security.md` updated in the same PR.
- Ships as its own PR onto `staging`.
