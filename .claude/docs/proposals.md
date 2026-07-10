# Proposals — packages → send → accept → invoice

Status: **build in progress** (replaces Quotes; quotes stay functional
until Phase G/H of the rollout). Owner decision 2026-07-10: quotes are
removed entirely, legacy quote data is dropped (no migration of old
quotes; old `/quote/[token]` links die at the final phase).

## Why

Quotes duplicated what packages do better. The selling workflow is now:

1. MC maintains **packages** in Templates (items with quantities,
   optional add-ons, deposit %, GST flag, weekend loading, categories,
   archive — see `database-schema.md` §packages).
2. MC composes a **proposal** for a couple offering **1–N package
   options**. Adding a package **snapshots** its items and commercial
   terms into the proposal; the MC edits the copy per couple (tweak
   prices, add custom or discount lines, pre-tick add-ons). Later
   package edits never change sent proposals.
3. The proposal is sent (email + tokenised public page). The couple
   picks an option (single-option proposals skip the chooser), adjusts
   add-on ticks with a live total, and accepts or declines.
4. Acceptance records the chosen option + final add-on selection,
   advances the couple to `confirmed` (never regresses), creates a
   follow-up task, and fires `proposal_accepted` automation events.
5. The MC generates an invoice from the accepted proposal — items are
   the accepted option's base items + ticked add-ons; the option's
   `deposit_percent` pre-fills the payment schedule and `gst_inclusive`
   sets the tax treatment. This is the fix for the old quote→invoice
   conversion losing package terms.

Naming: **Proposal**, route `/proposal/[token]`, numbering `PR-001`.
Payments tabs: Proposals | Invoices | Contracts.

## Data model

Three owned tables (RLS `user_id = auth.uid()` on each):

- `proposals` — id, user_id, couple_id (FK couples cascade), title,
  proposal_number (`generate_proposal_number`), status
  `draft|sent|accepted|declined` (expired is display-only, derived from
  `expires_at`), notes, expires_at, share_token (uuid, default
  gen_random_uuid), share_token_enabled (default false; enabling = the
  send action's job), accepted_option_id (FK proposal_options set
  null), accepted_addon_selection jsonb (`{option_item_id: bool}` for
  the chosen option's add-ons), accepted_at, email_sent_at, subtotal
  (denormalised for lists: primary option total pre-acceptance, the
  accepted selection total after), created_at/updated_at (touch
  trigger).
- `proposal_options` — id, proposal_id (FK cascade), user_id, position,
  title (pre-filled from the package name, editable), description,
  source_package_id (FK packages set null — provenance only, never
  feeds rendering), **deposit_percent, gst_inclusive,
  weekend_loading_percent** (snapshot of the package's commercial
  terms at apply time), subtotal (base items only).
- `proposal_option_items` — id, option_id (FK cascade), user_id,
  description (quantities pre-flattened via
  `lib/payments/package-math.ts` `flattenItem`, e.g. "2 × Extra hour"),
  amount, is_addon bool, default_included bool (MC's pre-tick; only
  meaningful when is_addon), position.

There are **no proposal-level discount/tax columns**: per-couple
discounts are edited item prices or a negative line in the snapshot;
GST treatment comes from each option's `gst_inclusive`.

Cross-references: `invoices.proposal_id` (FK set null) and
`contracts.proposal_id` (FK set null) record provenance; documents
always snapshot their own items.

## Public RPC surface (SECURITY DEFINER, granted to anon)

Field selection follows `security.md`: never expose user_id or
share_token in payloads; branding merges via `_user_branding(uuid)`
(see 20260514000000).

- `get_public_proposal(token)` → proposal fields + options (with items
  ordered by position) + couple_name + business_name + branding keys.
  Gated on `share_token = token AND share_token_enabled`.
- `accept_proposal(token, chosen_option_id, addon_selection jsonb)` →
  validates: token enabled, not already actioned, not expired,
  `chosen_option_id` belongs to this proposal, every key in
  `addon_selection` is an `is_addon` item of that option. Atomically:
  sets status/accepted_* fields, recomputes `proposals.subtotal` to the
  accepted selection total, advances `couples.status` to 'confirmed'
  unless already confirmed/paid/complete, inserts the follow-up task
  ("Proposal accepted — confirm booking for <couple>"), and the status
  flip fires the automation DB trigger (`proposal_accepted`).
- `decline_proposal(token)` → same guards; sets status declined
  (`proposal_declined` event via trigger).
- `generate_proposal_number(p_user_id)` → `PR-NNN` sequential per user.

The public page route must be in middleware PUBLIC_ROUTES and covered
by the public-token rate limiter.

## Automation surface (Phase F)

Triggers `proposal_sent | proposal_accepted | proposal_declined |
proposal_due | proposal_overdue` (due/overdue via time emitters on the
automations-tick cron, keyed off `expires_at` on `sent` proposals).
Actions `send_proposal`, `create_invoice_from_proposal`. Variables
`{{proposal.link|number|total}}` and, once accepted,
`{{proposal.chosen_option.title|total}}`.

When quotes are removed (Phase G), existing user automations that
reference quote triggers/actions are **deactivated with a visible
banner**, never silently broken.

## Rollout phases

A schema+RPCs (**done**) → B server actions+email (**done**:
`saveProposalAction` / `deleteProposalAction` /
`duplicateProposalAction` in `app/(dashboard)/payments/actions.ts`;
`POST /api/email/send-proposal` + `sendProposalEmail`/`proposalHtml`;
accepted/declined proposals are locked against edits and re-sends) →
C composer+payments tab (**done**: `proposal-builder-modal` over the
shared builder parts with an options stack — each option card owns
title/description, base items via LineItemsTable, add-ons with MC
pre-ticks, and a display-only terms line; Proposals tab on /payments
(first tab) + couple-profile section; two-tab live preview [couple
page summary + real cover email]; e2e `tests/e2e/proposals.spec.ts`,
validated on the isolated local-Supabase server desktop + iPhone 12
via `playwright.iso.config.ts`) → D public page+branding surface →
E invoice generation+contract link → F automations+portal+docs →
G delete quote code → H destructive drop migration
(`-- @ALLOW_DESTRUCTIVE`). Owner direction 2026-07-10: build the
remaining phases in one continuous push (no per-phase pause); quotes
keep working until G. Full plan of record:
`~/.claude/plans/theres-too-much-white-parsed-mango.md` (2026-07-10).
