# Custom payment schedules

Status: draft for review
Date: 2026-07-28
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

## 2. Goal

An MC can define named, reusable payment schedules of any number of stages,
apply one to a package, a proposal option, or an invoice, and have the couple
pay each stage in turn on the public invoice page.

Locked decisions from the design conversation:

1. **Reusable saved schedules.** Defined once, applied anywhere. Not
   invoice-only, and not per-proposal-option only.
2. **Due dates are relative to the invoice date.** A stage stores an offset in
   days from issue; it does not anchor to the event date.
3. **Amounts are percent, fixed, or remainder.** Mixed within one schedule.
4. **Couples pay the next unpaid stage in order, or pay the full remaining
   balance in one go.** No arbitrary out-of-order stage payment.
5. **The old columns are backfilled into stage rows and then dropped.** One code
   path afterwards, no dual-read branches.

### Non-goals

Explicitly out of scope for this change, so they are not assumed:

- Per-stage email reminders. `invoice_due` and `invoice_overdue` continue to
  fire off the whole-invoice `due_date`.
- Partial payment against a single stage.
- Refunds and reversals.
- Event-date-anchored offsets. See the risk in section 10.

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

RLS is enabled on all three with the standard `auth.uid() = user_id` policy for
SELECT, INSERT, UPDATE and DELETE. Indexes on `payment_schedule_stages.schedule_id`,
`invoice_payment_stages.invoice_id`, and `invoice_payment_stages.due_date`.

### Alternatives rejected

- **One polymorphic `payment_stages` table** with `parent_type` + `parent_id`.
  Fewer tables, but polymorphic parents cannot carry real foreign keys, and
  every RLS policy has to re-derive ownership through a branch. That fights the
  grain of a codebase with RLS on every owned table.
- **JSONB `invoices.payment_stages`.** No joins, but the webhook marking one
  stage paid becomes a read-modify-write of the whole array, which races when a
  couple pays two stages in quick succession, and due dates cannot be indexed
  for future reminder work.

## 4. Resolving a schedule onto an invoice

One pure function, used by both the builder and the server action, so the
preview and the persisted result cannot disagree.

```ts
resolveStages(templateStages, invoiceTotalCents, issueDate) => InvoiceStage[]
```

- `due_date` = issue date + `due_offset_days`. Issue date is the invoice's
  `created_at`, or the date it was first sent if that is later. Editable per
  stage afterwards.
- `percent` resolves against the invoice total: subtotal plus tax, after
  discount, matching what `invoice-payment/route.ts` already computes.
- `fixed` is taken literally.
- `remainder` absorbs whatever is left after all other stages.

### Validation rules

Enforced in the same function, surfaced in the builder rather than clamped
silently:

1. Zero or one `remainder` stage. If present it must be last.
2. Without a `remainder` stage, percents plus fixed amounts must equal the total
   exactly.
3. Rounding: amounts resolve to integer cents and the last stage takes the
   remainder, so stages always sum to the invoice total to the cent.
4. A `fixed` stage exceeding the total remaining is a validation error, not a
   clamp. This is the "$500 fixed on a $400 invoice" case.
5. Zero stages is valid: the invoice behaves as a single-payment invoice, which
   is today's behaviour when `depositEnabled` is false. A schedule with exactly
   one stage is rejected in the builder as pointless, since it is equivalent to
   no schedule.

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

The stored status value `deposit_paid` is kept rather than renamed to
`partially_paid`. It is a slight misnomer under multi-stage, but renaming it
would touch the badge maps in `app/(dashboard)/payments/invoices-list.tsx`, the
automations conditions, and any saved filters. It is relabelled to "Part paid"
in the UI instead.

## 6. Authoring surfaces

### Saved schedules: new `Schedules` tab on `/templates`

Added to `TEMPLATE_TABS` in `app/(dashboard)/templates/templates-tabs.tsx`, at
tab level rather than nested inside the Invoices tab, because a schedule
attaches to packages and proposal options too.

Follows the existing two-pane manager pattern from `packages-manager.tsx`: list
on the left, edit form on the right, plus a live preview resolving against a
sample $5,000 total so the MC sees what the couple will get. One schedule can be
flagged default, which replaces the `default_deposit_percent` user setting.

### Invoice builder

`components/builders/parts/payment-schedule.tsx` is already a vertical timeline
with per-stage dots, state pills, dates and Mark-paid buttons. It generalises to
N stages without a redesign: map over stages instead of rendering deposit and
final explicitly.

`components/builders/invoice-builder-modal.tsx` changes:

- `depositEnabled`, `depositPercent`, `depositDueDate`, `finalDueDate` collapse
  into one `stages` array.
- `hasDepositSchedule` becomes `stages.length > 0`.
- A schedule picker is added at the top of the section ("Apply a saved
  schedule"), then add, remove and reorder controls per row, each row carrying
  label, amount type, value and date.
- The auto-save-before-mark-paid workaround at lines 280 to 292 is removed.
  Stages are rows that exist independently of the Save button, so the
  "schedule is enabled if a payment was recorded before it was persisted" case
  cannot arise.

`invoice-builder-modal.tsx` is 986 lines and `payment-schedule.tsx` is 254, both
well past the ~150-line guidance before this change adds to them. The stage row
editor and the schedule picker each become their own component under
`components/builders/parts/`, and the modal's stage state moves into a
`use-invoice-stages.ts` hook alongside the existing `use-proposal-detail.ts`
pattern. This is targeted at the code this feature touches, not a general
refactor of the modal.

### Packages and proposal options

`packages.deposit_percent` and `proposal_options.deposit_percent` are replaced by
a `payment_schedule_id` FK. `sign_contract` copies the accepted option's schedule
onto the invoice it spawns, instead of computing a single deposit percentage from
`option_deposit_percent` with a 25% fallback.

Where no schedule is set anywhere in the chain, the spawned invoice gets no
stages and behaves as a single-payment invoice.

## 7. Rendering surfaces

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

### Automations

`has_paid_deposit` in `lib/automations/conditions.ts:175` is redefined as "the
first stage is paid". Note that it currently reads `ctx.couple.deposit_paid_at`
and the `couples` table has no such column, so the condition appears to always
evaluate false today. This is to be verified during implementation and fixed as
part of this work rather than ported forward.

`invoice_due` and `invoice_overdue` emitters are unchanged and keep firing off
the whole-invoice `due_date`.

## 8. Migration

A single migration, ordered so the destructive steps run after the backfill in
the same transaction. A failed backfill takes the drops down with it.

1. Create `payment_schedules`, `payment_schedule_stages`, `invoice_payment_stages`
   with RLS, policies and indexes as in section 3.
2. Backfill invoices: every invoice with a non-null `deposit_percent` or
   `deposit_paid_at` becomes two stage rows, a `percent` deposit and a
   `remainder` final, carrying existing due dates, paid timestamps and resolved
   `amount_cents`. Invoices without a schedule get no rows.
3. Backfill saved schedules: for each user with a `default_deposit_percent`,
   create one schedule named "Default" holding that percentage plus a remainder
   stage.
4. Add `payment_schedule_id` to `packages` and `proposal_options`, point existing
   rows at the user's backfilled Default schedule where they had a
   `deposit_percent`, then drop `deposit_percent` from both.
5. Drop `deposit_percent`, `deposit_due_date`, `deposit_paid_at`,
   `final_due_date`, `final_paid_at` from `invoices`.
6. Replace `get_public_invoice`, `get_public_proposal` and `sign_contract`, all
   of which read the dropped columns.

Steps 4 and 5 need an explicit marker or `scripts/check-migrations.sh` rejects
the deploy:

```sql
-- @ALLOW_DESTRUCTIVE: replaced by invoice_payment_stages, backfilled in step 2
```

Deployed through CI `supabase db push`, never the Supabase web SQL editor.

## 9. Testing

### Unit

The resolver is a pure function and carries the bulk of the coverage:

- Percent-only schedule summing to 100.
- Mixed fixed plus remainder.
- Rounding, asserting stages always total the invoice to the cent.
- Fixed-exceeds-total raises a validation error.
- Remainder not last is rejected; two remainders rejected.
- Re-resolution when the invoice total changes with some stages already paid.

Plus extended coverage in `tests/unit/lib/payments/webhook-events.test.ts` for
the new `stage` and `remaining` metadata shapes.

### Integration (local Supabase, real schema, real RLS)

- Cross-tenant RLS denial on all three new tables, ticked into the coverage
  matrix in `.claude/docs/security.md`.
- The backfill migration replayed from zero against seeded legacy invoices,
  asserting the resulting stage rows match the old column values.
- `sign_contract` copying an accepted option's schedule onto the spawned invoice.

### E2E (Playwright, desktop + Pixel 5 + iPhone 12)

Build a three-stage invoice, send it, pay stage one on the public page, confirm
stage two unlocks and stage three stays locked, then pay in full to close it out.

## 10. Risks

**Invoice-anchored offsets versus long lead times.** `sign_contract` spawns the
deposit invoice at contract signing, often 12 to 18 months before the wedding. A
stage at "+60 days" therefore falls due roughly a year before the event. This is
workable if MCs issue a later invoice closer to the date, and per-stage dates
stay editable on every invoice, but if MCs in practice want a single invoice
covering the whole engagement, event-date anchoring becomes necessary. Adding an
`anchor` column to the stage tables later is additive and does not require
revisiting this design.

**Destructive migration.** Five columns dropped across three tables. Mitigated by
same-transaction ordering, the replay-from-zero integration test, and the fact
that the backfill is a pure function of columns that are not written during the
migration.

## 11. Definition of done

Per `.claude/docs/production-readiness.md` §5, plus:

- No `any`; generated `Database` types end to end.
- TSDoc on every exported function and type; why-comments on the resolver's
  rounding and validation rules.
- Loading, empty and error states on the Schedules tab.
- `.claude/docs/database-schema.md`, `page-specs.md`, `payments.md` and
  `security.md` updated in the same PR.
- Ships as its own PR onto `staging`.
