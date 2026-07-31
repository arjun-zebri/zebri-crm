# Remove proposals

**Date:** 2026-07-30
**Status:** Approved, ready for planning
**Owner:** Arjun

## Goal

Delete the proposal feature from Zebri in full. Payments becomes invoicing
only. The product keeps a lean surface while the rest of the
production-readiness work continues.

This is a removal, not a migration. Nothing about proposals is preserved,
archived, or reshaped into another feature.

## Motivation

Proposals replaced quotes on 2026-07-10 and carry a large surface: three
tables, a public accept/decline page, a dedicated branding surface with six
bespoke block types, five automation triggers, two automation actions, an
email type, and a builder modal family. Nobody is using the feature. Cutting
it removes roughly 2,500 references across 207 files and shrinks the area that
has to reach the per-page Definition of Done.

## What stays

Explicitly untouched, so the implementation has a clear boundary:

- **Invoices** in full, including payment schedules and stages, Stripe
  Connect payment, and the public `/invoice/[token]` page.
- **Contracts**, minus the proposal link (see §3).
- **Packages and templates.** Packages remain a source of invoice line items
  via the existing "Start from a package or template" picker in the invoice
  builder. Only the accepted-proposal source comes out.
- **Portal**, minus its proposals list.
- **Couples, events, tasks, contacts, questionnaires, run sheets,
  automations** other than the proposal-scoped pieces named in §5.

## Decisions

Locked during brainstorming on 2026-07-30. Numbered so the plan can cite them.

| # | Decision |
|---|----------|
| D1 | Invoices become fully manual. Signing a contract no longer creates one. |
| D2 | `invoices.proposal_id` and `contracts.proposal_id` are dropped. |
| D3 | Packages survive, as a source of invoice line items. |
| D4 | Every proposal-scoped automation trigger, action, and variable is deleted. |
| D5 | The Proposal branding surface is deleted. The onboarding wizard's documents step previews the invoice instead. |
| D6 | A dev-only sidebar button re-triggers the branding onboarding wizard. |
| D7 | The public proposal page and the portal's proposals list are deleted. |
| D8 | No production data is preserved. Nobody is using proposals. |
| D9 | The contract-to-proposal link is removed entirely, rather than repointed at an invoice. |
| D10 | `/payments` keeps Invoices and Contracts tabs, and loses Proposals. |

## 1. Database

One migration, `supabase/migrations/<ts>_remove_proposals.sql`, carrying an
`-- @ALLOW_DESTRUCTIVE: proposals feature removed; no production usage
(owner-approved 2026-07-30)` marker so `scripts/check-migrations.sh` accepts
it. Deployed through the CI `supabase db push` flow. Never the web SQL editor.

### 1.1 Drops

Tables, in FK order:

- `proposal_option_items`
- `proposal_options`
- `proposals`

Columns:

- `invoices.proposal_id` (D2)
- `contracts.proposal_id` (D2)

Functions:

- `get_public_proposal(uuid)`, including its `anon` grant
- `accept_proposal(...)`
- `decline_proposal(uuid)`
- `generate_proposal_number(uuid)`

### 1.2 Rewrites

**`sign_contract`.** The current version (latest in
`20260730000100_drop_legacy_deposit_columns.sql`) branches on
`v_contract.proposal_id`, and when the linked proposal is accepted it inserts
an invoice plus its payment stages from the MC's default schedule. That whole
branch goes (D1). The function keeps its signature-recording behaviour:
stamping the signature, the signed timestamp, and the contract status, and
returning its existing shape so callers do not change.

**`get_portal_data`.** Drops the `proposals` key from the returned payments
object. The remaining keys are unchanged, so `app/portal/[token]` only loses
one section.

### 1.3 Data cleanup, same migration

Two cleanups that must land with the drops rather than after them:

**Branding block trees.** `user_branding.branding_blocks` is a single JSON
column keyed by surface. The migration strips the `proposal` key from every
row. Leaving it would keep dead trees that `validate-blocks` no longer has a
schema for.

**Orphaned automations.** `automations.trigger_type` is free text. Rows whose
trigger type is one of `proposal_sent`, `proposal_accepted`,
`proposal_declined`, `proposal_due`, `proposal_overdue` are deleted, along
with rows whose `automation_actions` reference `send_proposal` or
`create_invoice_from_proposal`. Their `automation_runs`, `automation_waits`,
`automation_events`, and `automation_audit_log` children cascade.

Why this is not optional: the automations tick resolves `trigger_type` against
the registry in `lib/automations/triggers.ts`. Delete the registry entries and
leave the rows, and the cron tick throws on every pass.

### 1.4 Types

Regenerate `types/database.ts` with `supabase gen types` after the migration
applies locally. Do not hand-edit it.

## 2. Payments page

`/payments` keeps **Invoices | Contracts** (D10).

Delete:

- `app/(dashboard)/payments/proposals-list.tsx`
- `components/builders/proposal-builder-modal.tsx`
- `components/builders/parts/proposal-addons-editor.tsx`
- `components/builders/parts/proposal-option-card.tsx`
- `components/builders/parts/proposal-preview-pane.tsx`
- `components/builders/parts/use-proposal-detail.ts`
- `components/proposal/` in full, 13 files
- `lib/payments/proposal-view.ts`
- `lib/branding/proposal-labels.ts`

Edit:

- `app/(dashboard)/payments/page.tsx` loses the proposals tab state, the
  `useProposals` call, the proposal search memo, and the builder modal.
  Default tab becomes `invoices`.
- `payments-header.tsx`, `payments-footer.tsx`, `payments-table.tsx`, and
  `use-payments-shortcut.ts` lose their proposals branches. `PaymentsTab`
  narrows to `'invoices' | 'contracts'`.
- `use-payments-data.ts` loses `useProposals`.
- `app/(dashboard)/couples/couple-payments.tsx` loses its proposals section.
- `components/builders/parts/use-apply-sources.ts` loses the
  `includeAcceptedProposals` option, the `ApplyProposalMeta` type, and the
  proposals query. Packages and invoice templates are untouched (D3).
- `components/builders/parts/line-items-table.tsx`,
  `builder-preview-pane.tsx`, `preview-payment-page.tsx`, `preview-pdf.tsx`,
  and `share-and-send.tsx` lose their proposal document-kind branches.

## 3. Contracts

The contract builder's "Link to proposal" row is the only place contracts
touch proposals (D9).

Delete `components/builders/parts/contract-proposal-link.tsx`.

`components/builders/contract-builder-modal.tsx` loses the picker row at
~`:585`, the `couple-accepted-proposals` query at ~`:187`, the
`contract-linked-proposal` query at ~`:239`, the `linkedProposalId` state, and
`proposal_id` from its contract shape.

`lib/contracts/contract-variables.ts` loses `total_amount` and
`deposit_amount` from `CONTRACT_VARIABLES`, from `ContractVariableValues`, and
from the substitution table. `buildContractVariables` loses its `proposal` and
`firstStage` inputs. The surviving variables are `couple_name`,
`couple_email`, `event_date`, `venue`, `mc_business_name`,
`mc_signature_name`, `today`.

**Known consequence, accepted.** A contract template already saved with a
`{{total amount}}` or `{{deposit amount}}` mention renders a dash where the
figure was. That is what a contract with no linked proposal does today, so
this is not a new failure mode. Existing saved templates are not rewritten.

## 4. Branding

### 4.1 Surface removal

Surfaces become **Invoice | Contract | Portal | Run sheet | Questionnaire**
(D5).

Edit `surface-tabs.tsx` (drop the `proposal` entry), `blocks-by-surface.ts`
(drop the `proposal` key), `blocks/defaults.ts`, `blocks/policy.ts`,
`blocks/types.ts`, `blocks/render.tsx`, `blocks/block-renderer.tsx`,
`blocks/block-toolbar.tsx`, `blocks/add-block-palette.tsx`,
`blocks/sample-doc.ts`, `branding-editor.tsx`, `canvas-scope-bar.tsx`,
`documents-section.tsx`, `editor-branding.ts`, `lib/branding/readiness.ts`,
`lib/branding/validate-blocks.ts`, `lib/branding/public-renderer.tsx`,
`lib/branding/public-branding.ts`, `lib/branding/document-variables.ts`,
`lib/branding/use-current-branding.ts`, and
`app/branding/preview/[surface]/page.tsx`.

The five block types that only ever rendered on the proposal surface come out
with it: `packageHeader`, `packageDetails`, `packageLineItems`,
`packageInclusions`, and `packageTotals`. `blocks-by-surface.ts` confirms they
are proposal-only today; verify that again before deleting.

The `action` block is **shared** with the invoice and contract surfaces and
stays. Only its proposal-specific configuration and labelling come out. This
is the one place in the branding removal where a careless delete breaks a
surviving surface.

`lib/branding/public-blocks/` loses its proposal-scoped branches in
`image.tsx`, `line-items.tsx`, `spacer.tsx`, and `variable-values.ts`.

### 4.2 Onboarding wizard

`onboarding/step-documents.tsx` previews the invoice rather than the proposal,
and its surface list drops `proposal`. `onboarding-wizard.tsx`,
`wizard-preview.tsx`, `demo-doc.tsx`, and `editor-demo-tabs.tsx` lose their
proposal entries. The first document tab becomes Invoice.

### 4.3 Dev-only onboarding trigger (D6)

A sidebar entry in `app/components/sidebar.tsx`, rendered only when
`process.env.NODE_ENV === 'development'`, that clears the localStorage
onboarding cache key and force-opens the branding wizard.

It deliberately does **not** clear `user_branding.onboarded_at`. The point is
to open the wizard repeatedly on an existing account without creating a new
user, and without destroying the account's completed-onboarding state.
Completing the wizard writes branding through the normal path.

Carries a `// TEMPORARY:` comment naming its removal condition. It never
reaches production because the environment check strips it from the build.

## 5. Automations

Delete from `lib/automations/triggers.ts`: `proposalSent`,
`proposalAccepted`, `proposalDeclined`, `proposalDue`, `proposalOverdue`,
`proposalOverdueThresholdDays`, and their five registry entries.

Delete `lib/automations/time-emitters/proposal-due.ts` and
`proposal-overdue.ts`, and their entries in `time-emitters/index.ts`.

Delete the `send_proposal` and `create_invoice_from_proposal` actions from
`actions/documents.ts` and `actions/extended.ts`, and their labels in
`actions/ui.ts`.

Delete `{{proposal.link}}`, `{{proposal.number}}`, and `{{proposal.total}}`
from `lib/automations/variables.ts`, the proposal cases from
`audit-log/narrate.ts`, the proposal entries from `launch-catalogue.ts`, and
the proposal branch from `lib/automations/context.ts`.

`app/(dashboard)/automations/[id]/inspector-panel.tsx` and
`inspector-extended.tsx` lose their proposal config editors.
`app/api/cron/automations-tick/route.ts` loses its proposal emitter calls.

## 6. Public surface and email

Delete `app/proposal/` in full, 4 files. Delete `/api/email/send-proposal/`.

Remove the `"/proposal"` entry from `PUBLIC_ROUTES` in `middleware.ts`, and
the `/proposal/[token]` reference from `lib/api/public-token-limiter.ts`.

`lib/email/`: delete `proposalHtml` from `html.ts` and its re-export from
`index.ts`, delete `sendProposalEmail` and its options type, delete the
proposal starter templates from `starter-templates.ts`, delete the proposal
branch and the `proposal_link` / `proposal_number` payload keys from
`send-context.ts`, and the proposal tokens from `template-variables.ts`.

`app/api/email/send-contract/route.ts` loses its proposal reference.

`app/portal/[token]/payments-section.tsx` and `portal-shell.tsx` lose the
proposals list (D7). `app/(dashboard)/settings/public-page-section.tsx` and
`questionnaire-send-preview.tsx` lose their proposal mentions.

## 7. Copy

User-facing strings that name proposals get rewritten, not just deleted:

- `app/(dashboard)/settings/billing/plans.ts:37` and `:106` describe plans as
  "CRM, proposals, invoices". Becomes "CRM, invoices, contracts".
- `app/(dashboard)/onboarding/steps/step-details.tsx:51` says "This appears on
  the proposals, invoices and contracts you send." Drops proposals.

## 8. Tests

Delete outright:

- `tests/e2e/proposals.spec.ts`
- `tests/e2e/proposal-blocks.spec.ts`
- `tests/integration/payments/invoice-from-proposal.test.ts`
- `tests/integration/payments/public-proposal-rpcs.test.ts`
- `tests/integration/payments/save-proposal-action.test.ts`
- `tests/unit/app/api/email/send-proposal.test.ts`
- `tests/unit/lib/automations/time-emitters/proposal-due.test.ts`
- `tests/unit/lib/automations/time-emitters/proposal-overdue.test.ts`
- `tests/unit/lib/branding/proposal-labels.test.ts`
- `tests/unit/branding/proposal-section-label-colour.test.tsx`

Prune proposal cases from the ~47 shared suites that also cover surviving
behaviour, notably the branding block suites, `payments-header/footer/table`,
`sign-contract-stages.test.ts`, `rls/payments-tables.test.ts`,
`packages-v2.test.ts`, and the e2e branding specs.

`sign-contract-stages.test.ts` needs the most thought: it currently asserts
that signing creates a staged invoice. Under D1 it should assert the opposite,
that signing records the signature and creates nothing.

New coverage to add:

- Integration: `sign_contract` on a contract with a signature creates no
  invoice rows.
- Integration: `get_portal_data` returns no `proposals` key.
- Unit: the contract variable picker offers exactly the seven surviving
  variables.
- Unit: `useApplySources` returns packages and invoice templates only.

## 9. Gates and docs

Ratchet down after the deletion lands, once the real numbers are known:

- `scripts/lint-gate.mjs`: `ERROR_BUDGET` is 63, `WARNING_BUDGET` is 265.
- `scripts/typecheck-strict-gate.mjs`: `STRICT_BUDGET` is 281.
- `scripts/check-public-surface-styling.mjs` loses its proposal surface entry.

Docs to delete: `.claude/docs/proposals.md`, and `.claude/docs/quotes.md`
which has been stale since the 2026-07-10 quote drop.

Docs to correct: `database-schema.md`, `page-specs.md`, `security.md`,
`testing.md`, `branding.md`, `document-blocks.md`, `component-library.md`,
`frontend-design.md`, `cicd.md`, `production-readiness.md`,
`phase-2-payments.md`, `branding-editor-redesign.md`,
`branding-editor-redesign-plan.md`.

Superseded specs, to be marked obsolete rather than deleted so the history
reads correctly:

- `docs/superpowers/specs/2026-07-28-proposal-single-multi-package-views.md`
- The proposal-facing half of `2026-07-28-custom-payment-schedules-design.md`

## 10. Sequencing

One branch off `main`, merging to `staging` per the current staging-only batch
rule. Five commits so a bisect stays readable:

1. **App surface.** Payments page, couple payments, portal, public proposal
   page, middleware, copy.
2. **Builders and branding.** Builder modals and parts, `components/proposal/`,
   branding surface, blocks, onboarding step, dev-only sidebar trigger.
3. **Automations and email.** Triggers, emitters, actions, variables, email
   module, send route.
4. **Migration.** Drops, rewrites, data cleanup, regenerated types.
5. **Tests, gates, docs.** Deletions, prunes, new coverage, ratchets, doc
   updates.

Commits 1 through 3 will not typecheck in isolation, since they precede the
type regeneration. That is acceptable for a bisect aid. CI runs on the branch
head.

## 11. Risks

**The automations tick.** Registry entries and stored rows must go in the same
deploy. If the code ships before the migration, the tick throws on the first
proposal-triggered row it meets. Mitigated by §1.3, and by the fact that the
cleanup and the drops are one migration.

**Branding block validation.** Stored trees carrying `proposal` keys or
`package*` blocks fail `validate-blocks` once the schemas are gone. Mitigated
by the JSON strip in §1.3. The repair sweep should be run against local
Supabase after the migration to confirm no tree is left invalid.

**Contract money variables.** Covered in §3. Accepted.

**Scale.** 207 files. The risk is a missed reference rather than a wrong
decision. The completion check is a clean `rg -i proposal` over `app`,
`components`, `lib`, `types`, `middleware.ts`, and `scripts`, with the only
survivors being historical migration files, which are immutable by
convention.

## Definition of Done

- [ ] `rg -i proposal` over app, components, lib, types, scripts, and
      middleware returns nothing outside historical migrations.
- [ ] `npm run typecheck` at 0.
- [ ] `npm run typecheck:strict` and `npm run lint:gate` pass with ratcheted
      budgets.
- [ ] Unit, integration, and e2e suites green.
- [ ] Migration replays from zero against local Supabase.
- [ ] `supabase gen types` output committed.
- [ ] Payments, contracts, branding, portal, and automations verified by hand
      in a running app.
- [ ] The dev-only sidebar button opens the branding wizard, and is absent
      from a production build.
- [ ] Listed docs updated in the same PR.
