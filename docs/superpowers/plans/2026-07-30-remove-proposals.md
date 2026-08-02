# Remove Proposals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the proposal feature from Zebri in full so Payments becomes invoicing-only, removing ~2,500 references across ~207 files without touching invoices, contracts, packages, portal, or automations beyond the proposal-scoped pieces.

**Architecture:** A removal, not a migration. Work proceeds as one branch off `main`, in five commits ordered so a bisect stays readable: (1) app surface, (2) builders + branding, (3) automations + email, (4) database migration + regenerated types, (5) tests + gates + docs. One destructive SQL migration drops three tables, two FK columns, four functions, rewrites `sign_contract`, `get_portal_data`, and strips dead branding-block trees and orphaned automation rows. Type safety is the completion oracle: removing `SurfaceTab`'s and `PaymentsTab`'s `'proposal'` member turns the compiler into a checklist for every `Record<SurfaceTab, …>` site.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript (strict + ratcheted strict tsc) · Tailwind 4 · Supabase (Postgres + RLS, migrations via CI `supabase db push`) · Vitest 3 (unit + integration) · Playwright (e2e) · `@tanstack/react-query`, `zod`.

## Global Constraints

- **Branch:** one branch off `main` (e.g. `feature/remove-proposals`), merging to `staging` per the current staging-only batch rule. Do NOT branch off `feature/custom-payment-schedules`; start from a clean `main`. The staging-only batch rule (feedback: no per-phase `main` promotion) applies.
- **Commit structure:** exactly five commits, in the order in §Phases. Commits 1-3 are NOT expected to `npm run typecheck` clean in isolation (they precede the type regeneration in commit 4). That is an accepted bisect aid. The authoritative green gate — `typecheck` at 0, `typecheck:strict`, `lint:gate`, and the full test suite — is required only at the **branch head** (end of Phase 5).
- **Destructive SQL:** the migration MUST carry `-- @ALLOW_DESTRUCTIVE: proposals feature removed; no production usage (owner-approved 2026-07-30)` directly above each destructive statement (`DROP TABLE`, `DROP COLUMN`, and any `DELETE FROM <table>;`), or `scripts/check-migrations.sh` rejects the deploy. `DROP FUNCTION` and `DROP INDEX` are NOT flagged by the gate but include the marker on the table/column drops.
- **Migrations are source of truth:** deployed through CI `supabase db push`. NEVER the Supabase web SQL editor. Regenerate `types/database.ts` with `supabase gen types` after applying locally — never hand-edit it.
- **Comment style (locked):** TSDoc on every exported API + why-comments on non-obvious logic. Keep this on the code that survives edits.
- **No em dashes** in copy, comments, or prose. Rewrite with natural punctuation.
- **Design system:** tokens + `components/ui/` primitives only; no raw HTML form controls, no off-token colours, `strokeWidth={1.5}` on Lucide icons, `rounded-xl` not `rounded-full`, `cursor-pointer` on interactive elements.
- **Locked decisions (cited as D1-D10 in tasks):** D1 invoices fully manual, signing a contract creates no invoice. D2 drop `invoices.proposal_id` and `contracts.proposal_id`. D3 packages survive as an invoice line-item source. D4 delete every proposal automation trigger/action/variable. D5 delete the Proposal branding surface; onboarding documents step previews the invoice. D6 dev-only sidebar button re-triggers the branding wizard. D7 delete the public proposal page and the portal proposals list. D8 no production data preserved. D9 remove the contract-to-proposal link entirely. D10 `/payments` keeps Invoices + Contracts, loses Proposals.
- **Completion oracle:** a clean `rg -i proposal` over `app`, `components`, `lib`, `types`, `middleware.ts`, and `scripts`, with the only survivors being historical migration files (immutable by convention).

---

## File Structure

Grouped by disposition. Every path is repo-relative.

### Files DELETED (whole file)

**Payments / builders (Phase 1-2):**
- `app/(dashboard)/payments/proposals-list.tsx`
- `components/builders/proposal-builder-modal.tsx`
- `components/builders/parts/proposal-addons-editor.tsx`
- `components/builders/parts/proposal-option-card.tsx`
- `components/builders/parts/proposal-preview-pane.tsx`
- `components/builders/parts/use-proposal-detail.ts`
- `components/builders/parts/contract-proposal-link.tsx`
- `lib/payments/proposal-view.ts`
- `lib/branding/proposal-labels.ts`
- `components/proposal/` (13 files: `editable-label.tsx`, `option-chooser.tsx`, `option-selection.tsx`, `package-details.tsx`, `package-header.tsx`, `package-inclusions.tsx`, `package-line-items.tsx`, `package-totals.tsx`, `proposal-block-context.tsx`, `proposal-blocks-renderer.tsx`, `proposal-document-body.tsx`, `proposal-page-view.tsx`, `proposal-sample-data.ts`)

**Automations / email / public (Phase 3):**
- `lib/automations/time-emitters/proposal-due.ts`
- `lib/automations/time-emitters/proposal-overdue.ts`
- `app/api/email/send-proposal/route.ts` (and the now-empty `app/api/email/send-proposal/` dir)
- `app/proposal/[token]/page.tsx`
- `app/proposal/[token]/_components/proposal-accept-actions.tsx`
- `app/proposal/[token]/_components/proposal-state-cards.tsx`
- `app/proposal/[token]/_components/public-proposal.ts`

**Tests (Phase 5):**
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
- `tests/unit/proposal/proposal-blocks-renderer.test.tsx`
- `tests/unit/proposal/proposal-document-body.test.tsx`

**Docs (Phase 5):**
- `.claude/docs/proposals.md`
- `.claude/docs/quotes.md`

### Files CREATED

- `supabase/migrations/<ts>_remove_proposals.sql` (Phase 4)
- Regenerated `types/database.ts` (Phase 4, via `supabase gen types`)

### Files EDITED (surgical removal of proposal branches)

Payments: `app/(dashboard)/payments/page.tsx`, `payments-header.tsx`, `payments-footer.tsx`, `payments-table.tsx`, `use-payments-shortcut.ts`, `use-payments-data.ts`; `app/(dashboard)/couples/couple-payments.tsx`.
Builders: `components/builders/contract-builder-modal.tsx`, `components/builders/invoice-builder-modal.tsx`, `components/builders/parts/use-apply-sources.ts`, `builder-preview-pane.tsx`, `preview-pdf.tsx` (plus comment-only cleanup in `line-items-table.tsx`, `preview-payment-page.tsx`, `share-and-send.tsx`).
Contracts: `lib/contracts/contract-variables.ts`; `app/(dashboard)/payments/actions.ts` (contract save input).
Branding: `types/branding-preview.ts`, `app/(dashboard)/branding/surface-tabs.tsx`, `blocks-by-surface.ts`, `blocks/types.ts`, `blocks/defaults.ts`, `blocks/policy.ts`, `blocks/render.tsx`, `blocks/block-renderer.tsx`, `blocks/block-toolbar.tsx`, `blocks/add-block-palette.tsx`, `blocks/sample-doc.ts`, `branding-editor.tsx`, `canvas-scope-bar.tsx`, `documents-section.tsx`, `editor-branding.ts`, `app/branding/preview/[surface]/page.tsx`; `lib/branding/validate-blocks.ts`, `public-renderer.tsx`, `public-branding.ts`, `document-variables.ts`, `use-current-branding.ts` (plus optional cleanup in `public-blocks/variable-values.ts`).
Onboarding: `app/(dashboard)/branding/onboarding/step-documents.tsx`, `onboarding-wizard.tsx`, `wizard-preview.tsx`, `demo-doc.tsx`, `editor-demo-tabs.tsx`; `app/(dashboard)/branding/page.tsx`; `app/components/sidebar.tsx`.
Automations: `lib/automations/triggers.ts`, `time-emitters/index.ts`, `actions/documents.ts`, `actions/extended.ts`, `actions/ui.ts`, `variables.ts`, `audit-log/narrate.ts`, `launch-catalogue.ts`; `app/(dashboard)/automations/[id]/inspector-panel.tsx`, `inspector-extended.tsx`.
Email: `lib/email/html.ts`, `index.ts`, `starter-templates.ts`, `send-context.ts`, `template-variables.ts`; `app/api/email/send-contract/route.ts`.
Public / portal / copy: `middleware.ts`, `lib/api/public-token-limiter.ts` (comment only), `app/portal/[token]/page.tsx`, `payments-section.tsx`, `portal-shell.tsx`, `app/(dashboard)/settings/public-page-section.tsx`, `app/(dashboard)/couples/questionnaire-send-preview.tsx`, `app/(dashboard)/settings/billing/plans.ts`, `app/(dashboard)/onboarding/steps/step-details.tsx`.
Migration DB: `sign_contract`, `get_portal_data` (rewritten in the new migration).
Gates: `scripts/lint-gate.mjs`, `scripts/typecheck-strict-gate.mjs`, `scripts/check-public-surface-styling.mjs`.
Tests pruned (not deleted): `tests/integration/payments/sign-contract-stages.test.ts`, `tests/integration/rls/payments-tables.test.ts`, `tests/integration/templates/packages-v2.test.ts`, `tests/unit/app/(dashboard)/payments/payments-table.test.tsx`, `payments-footer.test.tsx`, `payments-header.test.tsx`, `tests/unit/lib/contracts/contract-variables.test.ts`, `tests/unit/components/builders/contract-builder-new-draft.test.tsx`, `tests/unit/lib/automations/variables.test.ts`, `launch-catalogue.test.ts`, `home-payload.test.ts`, `actions/send-email.test.ts`.
Docs corrected: `database-schema.md`, `page-specs.md`, `security.md`, `testing.md`, `branding.md`, `document-blocks.md`, `component-library.md`, `frontend-design.md`, `cicd.md`, `production-readiness.md`, `phase-2-payments.md`, `branding-editor-redesign.md`, `branding-editor-redesign-plan.md`; and the two superseded specs marked obsolete.

---

## PHASE 1 — App surface

**Commit 1.** Payments page, couple payments, portal, public proposal page, middleware, copy. Delete the proposal-facing app surface and narrow the shared `PaymentsTab` union.

### Task 1.1: Narrow the `PaymentsTab` type and payments data hooks

**Files:**
- Modify: `app/(dashboard)/payments/use-payments-shortcut.ts:17`
- Modify: `app/(dashboard)/payments/use-payments-data.ts` (remove `Proposal` interface L21-31, `useProposals` hook L54-73)

- [ ] **Step 1: Narrow `PaymentsTab`.** In `use-payments-shortcut.ts:17`, change:
  ```ts
  export type PaymentsTab = 'proposals' | 'invoices' | 'contracts';
  ```
  to:
  ```ts
  export type PaymentsTab = 'invoices' | 'contracts';
  ```

- [ ] **Step 2: Remove the proposals data hook.** In `use-payments-data.ts`, delete the `export interface Proposal { … }` block (~L21-31) and the entire `export function useProposals() { … }` (~L54-73, the React Query keyed `['all-proposals']`). Keep `useInvoices` and `useContracts` untouched.

- [ ] **Step 3: Verify no local re-break.** Run:
  ```bash
  rg -n "useProposals|interface Proposal\b|PaymentsTab" "app/(dashboard)/payments"
  ```
  Expected: no `useProposals` definition remains; `PaymentsTab` union no longer lists `'proposals'`. Importers (page/header/footer) are fixed in the next tasks — dangling refs there are expected until then.

- [ ] **Step 4: Commit is deferred** — this task commits together with 1.2-1.5 as Commit 1.

### Task 1.2: Strip proposals from the payments page orchestrator

**Files:**
- Modify: `app/(dashboard)/payments/page.tsx`

**Interfaces:**
- Consumes: `PaymentsTab` (now `'invoices' | 'contracts'`), `useInvoices`, `useContracts` from Task 1.1.

- [ ] **Step 1: Remove proposal imports.** Delete `import { ProposalBuilderModal } from '@/components/builders/proposal-builder-modal';` (L22) and `import { displayStatus, ProposalsList } from './proposals-list';` (L28). In the `use-payments-data` import (L29) drop `useProposals`, leaving `import { useContracts, useInvoices } from './use-payments-data';`.

- [ ] **Step 2: Change default tab.** L35: `useState<PaymentsTab>('proposals')` becomes `useState<PaymentsTab>('invoices')` (D10).

- [ ] **Step 3: Remove proposal state and data.** Delete `activeProposalId` state (L36), `proposalSearch` state (L45), the `setProposalSearch('')` line in `onClearSearch` (L58), the `useProposals()` call (L63), and the `filteredProposals` useMemo (L67-78).

- [ ] **Step 4: Remove the `activeTab === 'proposals'` branches.** In `currentSearch`, `setCurrentSearch`, `count`, `total`, `isLoading` (L106-138) drop each proposals branch. In `handleNew` (L141) remove the `if (activeTab === 'proposals') setActiveProposalId('new')` line.

- [ ] **Step 5: Remove proposal render + modal.** Delete the `{activeTab === 'proposals' && (<ProposalsList … />)}` block (L160-167) and the `{!!activeProposalId && (<ProposalBuilderModal … />)}` block (L189-200).

- [ ] **Step 6: Verify.** Run:
  ```bash
  rg -ni proposal "app/(dashboard)/payments/page.tsx"
  ```
  Expected: no matches.

### Task 1.3: Strip proposals from payments header/footer/table

**Files:**
- Modify: `app/(dashboard)/payments/payments-header.tsx` (L14 icon import, L40-45 `newLabel` ternary, L112-117 TabButton)
- Modify: `app/(dashboard)/payments/payments-footer.tsx` (L5-6 doc comment, L26-31 `singular` ternary)
- Modify: `app/(dashboard)/payments/payments-table.tsx` (L19 import, L48 `PaymentsTableItem` union)

- [ ] **Step 1: Header.** Remove the `PackageOpen` icon import (L14) if now unused; remove the proposals branch of the `newLabel` ternary (L40-45) so it covers only invoices/contracts; delete the Proposals `<TabButton …/>` (L112-117). Leave the `Search ${activeTab}...` placeholder (L91) as-is (generic).

- [ ] **Step 2: Footer.** Remove the proposals mention in the doc comment (L5-6) and the `tab === 'proposals' ? 'proposal' :` branch of the `singular` ternary (L26-31).

- [ ] **Step 3: Table.** In `payments-table.tsx` L19 drop `Proposal` from the type import; L48 change `export type PaymentsTableItem = Proposal | Invoice | Contract;` to `export type PaymentsTableItem = Invoice | Contract;`.

- [ ] **Step 4: Verify.** Run:
  ```bash
  rg -ni proposal "app/(dashboard)/payments/payments-header.tsx" "app/(dashboard)/payments/payments-footer.tsx" "app/(dashboard)/payments/payments-table.tsx"
  ```
  Expected: no matches.

### Task 1.4: Delete `proposals-list.tsx` and strip couple payments

**Files:**
- Delete: `app/(dashboard)/payments/proposals-list.tsx`
- Modify: `app/(dashboard)/couples/couple-payments.tsx`

- [ ] **Step 1: Delete the list file.** `git rm "app/(dashboard)/payments/proposals-list.tsx"`. (Its only consumer, `page.tsx`, was cleaned in Task 1.2.)

- [ ] **Step 2: Strip proposals from couple-payments.** In `couple-payments.tsx` remove: the `ProposalBuilderModal` import (L9); the `PackageOpen` icon import (L5) if now unused; the `interface Proposal` (L22-29); `activeProposalId` state (L74); the `useQuery(['couple-proposals', coupleId])` block (L77-93); `allProposals` (L151); the `allProposals.length === 0` term in `isEmpty` (L159-160); `acceptedCount` and the proposals stats push (L163-168); the "New proposal" popover button (L188-193); the entire Proposals column render block (L216-262); and the `{!!activeProposalId && (<ProposalBuilderModal … />)}` usage (L332-344). Rewrite the intro copy at L214-216 so it names invoices only (e.g. "Create an invoice to bill this couple."). Leave `STATUS_STYLES` (L40-49) as-is; extra status keys are harmless.

- [ ] **Step 3: Verify.** Run:
  ```bash
  rg -ni proposal "app/(dashboard)/couples/couple-payments.tsx"
  ```
  Expected: no matches. The couple payments view now shows a single Invoices section.

### Task 1.5: Delete the public proposal page, portal proposals list, middleware + copy

**Files:**
- Delete: `app/proposal/[token]/page.tsx`, `_components/proposal-accept-actions.tsx`, `_components/proposal-state-cards.tsx`, `_components/public-proposal.ts`
- Modify: `middleware.ts:21-22`
- Modify: `lib/api/public-token-limiter.ts:3` (comment)
- Modify: `app/portal/[token]/page.tsx`, `payments-section.tsx`, `portal-shell.tsx`
- Modify: `app/(dashboard)/settings/public-page-section.tsx`
- Modify: `app/(dashboard)/couples/questionnaire-send-preview.tsx:32`
- Modify: `app/(dashboard)/settings/billing/plans.ts:37,106`
- Modify: `app/(dashboard)/onboarding/steps/step-details.tsx:51`

- [ ] **Step 1: Delete the public page (D7).** `git rm -r app/proposal`.

- [ ] **Step 2: Middleware.** In `middleware.ts` remove the comment line `// Couple-facing proposal accept page …` (L21) and the `"/proposal",` entry (L22) from `PUBLIC_ROUTES`.

- [ ] **Step 3: Token limiter comment.** In `lib/api/public-token-limiter.ts:3` drop the `/proposal/[token]` example from the doc comment. No functional code here.

- [ ] **Step 4: Portal (D7).** In `app/portal/[token]/page.tsx` remove the `PortalProposal` type and the `payments.proposals` loader/query field (find with `rg -n proposal "app/portal/[token]/page.tsx"`). In `payments-section.tsx` remove the `PortalProposal` import (L11), the `proposals?` prop (L15), `proposals`/`hasProposals` (L56-57), the proposals term in the empty-state gate (L62) and the "Your MC will send proposals and invoices here." copy (L80, rewrite to invoices only), `totalProposals` and the "Total proposals" card (L87-127), and the whole Proposals render block (L200-284). In `portal-shell.tsx:73` change the payments tab count to `initialData.payments.invoices.length` (drop the `proposals?.length` term).

- [ ] **Step 5: Settings public page section.** In `public-page-section.tsx` remove the `{ id: 'proposals', label: 'Proposals', … }` entry (L57) and the "proposals, and contracts" doc comment mention (L4).

- [ ] **Step 6: Questionnaire preview branding key.** In `questionnaire-send-preview.tsx:32` change `useCurrentBranding('proposal')` to `useCurrentBranding('questionnaire')` (a surviving surface; this preview is a questionnaire, so this is the correct key).

- [ ] **Step 7: Copy (§7).** `plans.ts:37` tagline `'For MCs getting started. CRM, proposals, invoices.'` becomes `'For MCs getting started. CRM, invoices, contracts.'`; `plans.ts:106` `'Up to 5 couples · CRM, proposals & invoices · Task management'` becomes `'Up to 5 couples · CRM, invoices & contracts · Task management'`. `step-details.tsx:51` `This appears on the proposals, invoices and contracts you send.` becomes `This appears on the invoices and contracts you send.`

- [ ] **Step 8: Verify + commit Phase 1.** Run:
  ```bash
  rg -ni proposal "app/(dashboard)/payments" "app/(dashboard)/couples/couple-payments.tsx" "app/portal" middleware.ts "app/(dashboard)/settings/public-page-section.tsx" "app/(dashboard)/settings/billing/plans.ts" "app/(dashboard)/onboarding/steps/step-details.tsx" "app/(dashboard)/couples/questionnaire-send-preview.tsx"
  ```
  Expected: no matches. Then commit:
  ```bash
  git add -A
  git commit -m "refactor(payments): remove proposal app surface, portal list, public page"
  ```
  (Full typecheck will still fail here because builders/branding/automations/DB still reference proposals — expected per Global Constraints.)

---

## PHASE 2 — Builders and branding

**Commit 2.** Builder modals and parts, `components/proposal/`, branding surface, blocks, onboarding step, dev-only sidebar trigger.

### Task 2.1: Remove the accepted-proposal source from `use-apply-sources` and invoice builder

**Files:**
- Modify: `components/builders/parts/use-apply-sources.ts`
- Modify: `components/builders/invoice-builder-modal.tsx`

- [ ] **Step 1: Remove the proposal apply-source (D3 keeps packages + invoice templates).** In `use-apply-sources.ts` delete: `export interface ApplyProposalMeta { … }` (L51-55); the `proposal?: ApplyProposalMeta | null` field on `ApplySource` (L67-69); the `includeAcceptedProposals?: boolean` option (L83-87); its destructure default (L99-102); the `includeAcceptedProposals` element of the `queryKey` (L105); and the entire `if (includeAcceptedProposals) { … }` proposals query block (L133-177). Leave the packages and invoice-template queries untouched.

- [ ] **Step 2: Update the invoice builder call site.** In `invoice-builder-modal.tsx` find `includeAcceptedProposals: true` (`rg -n includeAcceptedProposals components/builders/invoice-builder-modal.tsx`) and remove that option from the `useApplySources({ … })` call. Its "Start from a package or template" picker keeps packages + invoice templates.

- [ ] **Step 3: Verify.** Run:
  ```bash
  rg -ni "proposal|includeAcceptedProposals" components/builders/parts/use-apply-sources.ts components/builders/invoice-builder-modal.tsx
  ```
  Expected: no matches.

### Task 2.2: Remove the contract-to-proposal link (D9)

**Files:**
- Delete: `components/builders/parts/contract-proposal-link.tsx`
- Modify: `components/builders/contract-builder-modal.tsx`
- Modify: `app/(dashboard)/payments/actions.ts` (contract save path)

- [ ] **Step 1: Delete the picker component.** `git rm components/builders/parts/contract-proposal-link.tsx`.

- [ ] **Step 2: Gut the linking in the contract modal.** In `contract-builder-modal.tsx` remove: the `ContractProposalLink, type ContractProposalLinkOption` import (L52-55); `proposal_id?: string | null;` from the `Contract` interface (L81); `linkedProposalId` state (L180); the `useQuery(['couple-accepted-proposals', coupleId])` block (L219-241); the `useQuery(['contract-linked-proposal', linkedProposalId])` block (L273-290); `setLinkedProposalId(contract.proposal_id ?? null)` (L345) and `setLinkedProposalId(null)` (L373); and the `<ContractProposalLink … />` picker row and its wrapper `<div className="mt-3">` (L678-690).

- [ ] **Step 3: Fix the default-schedule stage query.** The `default-schedule-first-stage` query (L297-326) is keyed on `linkedProposal?.total` and `enabled: !!linkedProposal`. A contract now has no linked proposal, so this stage has no money source. Remove this query entirely and drop its result from the `buildContractVariables` call. (Under §3 the contract can no longer state a total/deposit figure; those variables are being removed in Task 2.3.)

- [ ] **Step 4: Fix `buildContractVariables` call + save input.** At L406-411 the modal calls `buildContractVariables({ …, proposal: linkedProposal ?? null, firstStage: … })`. After Task 2.3 the function no longer accepts `proposal` or `firstStage`, so remove both from this call and from its dependency array (L414). Remove `proposalId: linkedProposalId` from the `SaveContractInput` object (L426). In `app/(dashboard)/payments/actions.ts`, remove the `proposalId` field from the `SaveContractInput` type and stop writing `proposal_id` to the `contracts` insert/update (find with `rg -n proposal "app/(dashboard)/payments/actions.ts"`).

- [ ] **Step 5: Verify.** Run:
  ```bash
  rg -ni proposal components/builders/contract-builder-modal.tsx "app/(dashboard)/payments/actions.ts"
  ```
  Expected: no matches.

### Task 2.3: Trim contract variables to the seven survivors (§3)

**Files:**
- Modify: `lib/contracts/contract-variables.ts`

**Interfaces:**
- Produces: `buildContractVariables(input: { couple; firstEvent; userMeta })` (no `proposal`, no `firstStage`); `ContractVariableValues` with seven fields; `CONTRACT_VARIABLES` seven entries. Consumed by `contract-builder-modal.tsx` (Task 2.2) and `send-contract/route.ts` (Task 3.6).

- [ ] **Step 1: Write the failing test first (TDD).** In `tests/unit/lib/contracts/contract-variables.test.ts` add:
  ```ts
  import { describe, expect, it } from 'vitest'
  import { CONTRACT_VARIABLES, buildContractVariables } from '@/lib/contracts/contract-variables'

  describe('contract variables after proposal removal', () => {
    it('offers exactly the seven surviving variables', () => {
      expect(CONTRACT_VARIABLES.map((v) => v.id)).toEqual([
        'couple_name', 'couple_email', 'event_date', 'venue',
        'mc_business_name', 'mc_signature_name', 'today',
      ])
    })

    it('builds values without any proposal or money source', () => {
      const vars = buildContractVariables({
        couple: { name: 'Sam & Alex', email: 'sam@example.com' },
        firstEvent: { date: '2026-09-01', venue: 'The Grand' },
        userMeta: { business_name: 'MC Co', mc_signature_name: 'Jordan' },
      })
      expect(vars).not.toHaveProperty('total_amount')
      expect(vars).not.toHaveProperty('deposit_amount')
      expect(vars.couple_name).toBe('Sam & Alex')
    })
  })
  ```

- [ ] **Step 2: Run it, expect failure.**
  ```bash
  npx vitest run tests/unit/lib/contracts/contract-variables.test.ts
  ```
  Expected: FAIL (current `CONTRACT_VARIABLES` still lists `total_amount`/`deposit_amount`; `buildContractVariables` still requires `proposal`/`firstStage`).

- [ ] **Step 3: Remove the two money variables.** In `CONTRACT_VARIABLES` (L13-23) delete the `total_amount` (L18) and `deposit_amount` (L19) entries. In `ContractVariableValues` (L27-37) delete the `total_amount` (L32) and `deposit_amount` (L33) fields.

- [ ] **Step 4: Rewrite `buildContractVariables`.** Replace the function (L56-92) with:
  ```ts
  /**
   * Build the substitution values for a contract's mention variables.
   *
   * After the proposals removal a contract has no linked money source, so the
   * seven surviving variables are all derived from the couple, their first
   * event, and the MC's own settings.
   */
  export function buildContractVariables(input: {
    couple: { name: string; email: string | null }
    firstEvent: { date: string | null; venue: string | null } | null
    userMeta: Record<string, unknown>
  }): ContractVariableValues {
    return {
      couple_name: input.couple.name || '-',
      couple_email: input.couple.email || '-',
      event_date: formatDate(input.firstEvent?.date ?? null),
      venue: input.firstEvent?.venue || '-',
      mc_business_name: (input.userMeta.business_name as string) || '-',
      mc_signature_name:
        (input.userMeta.mc_signature_name as string) ||
        (input.userMeta.display_name as string) ||
        (input.userMeta.business_name as string) ||
        '-',
      today: formatDate(new Date().toISOString().slice(0, 10)),
    }
  }
  ```
  `formatCurrency` (L52-54) is now unused — delete it. `substituteMentions`/`renderContractHtml` are unchanged (id-agnostic). A saved template that still mentions `{{total amount}}`/`{{deposit amount}}` renders `{{total_amount}}`-style fallback text, which is the accepted known consequence (§3).

- [ ] **Step 5: Run the test, expect pass.**
  ```bash
  npx vitest run tests/unit/lib/contracts/contract-variables.test.ts
  ```
  Expected: PASS.

### Task 2.4: Remove proposal branches from builder preview parts + delete builder proposal files

**Files:**
- Delete: `components/builders/proposal-builder-modal.tsx`, `parts/proposal-addons-editor.tsx`, `parts/proposal-option-card.tsx`, `parts/proposal-preview-pane.tsx`, `parts/use-proposal-detail.ts`
- Delete: `lib/payments/proposal-view.ts`
- Modify: `components/builders/parts/builder-preview-pane.tsx:38`, `preview-pdf.tsx:40`
- Modify (comment-only): `components/builders/parts/line-items-table.tsx`, `preview-payment-page.tsx`, `share-and-send.tsx`

- [ ] **Step 1: Narrow the builder surface unions.** In `builder-preview-pane.tsx:38` change `surface: 'proposal' | 'invoice' | 'contract';` to `surface: 'invoice' | 'contract';`. In `preview-pdf.tsx:40` change the default `surface = 'proposal'` to `surface = 'invoice'` (the `BuilderSurface` type import is trimmed in Task 2.6).

- [ ] **Step 2: Clean comment-only references.** In `line-items-table.tsx` (L2, L43, L50, L53), `preview-payment-page.tsx` (L5, L133-135), and `share-and-send.tsx` (L182-184) rewrite the comments so they no longer mention proposals. No runtime branch exists in these three.

- [ ] **Step 3: Delete the builder proposal files.**
  ```bash
  git rm components/builders/proposal-builder-modal.tsx \
    components/builders/parts/proposal-addons-editor.tsx \
    components/builders/parts/proposal-option-card.tsx \
    components/builders/parts/proposal-preview-pane.tsx \
    components/builders/parts/use-proposal-detail.ts \
    lib/payments/proposal-view.ts
  ```

- [ ] **Step 4: Verify.** Run:
  ```bash
  rg -ni proposal components/builders
  ```
  Expected: no matches (all builder proposal code removed; `contract-builder-modal.tsx` was cleaned in 2.2).

### Task 2.5: Delete `components/proposal/` and the branding preview surface

**Files:**
- Delete: `components/proposal/` (13 files)
- Modify: `app/branding/preview/[surface]/page.tsx`

- [ ] **Step 1: Delete the proposal render components.** `git rm -r components/proposal`.

- [ ] **Step 2: Strip the preview page proposal branch.** In `app/branding/preview/[surface]/page.tsx` remove: the `@/components/proposal/...` imports (L18-19, L24 — `ProposalDocumentBody`, `StaticAcceptCta`, `PublicProposalOption`); the `sampleProposal()` helper (L36-~90); the `if (surface === 'proposal') return <ProposalPreview …>` branch (L180-181) and the whole `ProposalPreview` component (L208-~245); and `'proposal'` from the `isValidSurface` union (L29-30), the `PreviewContent` param union (L150), and the error copy listing valid surfaces (L436). The valid surfaces become `invoice | contract | portal | vendorTimeline | questionnaire`.

- [ ] **Step 3: Verify.** Run:
  ```bash
  rg -ni proposal "app/branding/preview"
  ```
  Expected: no matches.

### Task 2.6: Remove the Proposal branding surface and package block types (D5)

This is the compiler-driven task. Removing `'proposal'` from `SurfaceTab` surfaces every `Record<SurfaceTab, …>` site as a type error; fix each. The `action` block is **shared** and MUST stay — only its proposal-specific config/labelling comes out.

**Files:**
- Modify: `types/branding-preview.ts`, `app/(dashboard)/branding/blocks/types.ts`, `blocks-by-surface.ts`, `policy.ts`, `defaults.ts`, `render.tsx`, `block-renderer.tsx`, `block-toolbar.tsx`, `add-block-palette.tsx`, `sample-doc.ts`, `surface-tabs.tsx`, `canvas-scope-bar.tsx`, `documents-section.tsx`, `editor-branding.ts`, `branding-editor.tsx`; `lib/branding/validate-blocks.ts`, `public-renderer.tsx`, `public-branding.ts`, `document-variables.ts`, `use-current-branding.ts`, `public-blocks/variable-values.ts`

- [ ] **Step 1: Confirm the package blocks are proposal-only.** Run:
  ```bash
  rg -n "packageHeader|packageDetails|packageLineItems|packageInclusions|packageTotals" "app/(dashboard)/branding/blocks/blocks-by-surface.ts"
  ```
  Expected: they appear only inside the `proposal:` array (L20). If any appears on another surface, STOP and re-scope. Confirmed proposal-only during exploration.

- [ ] **Step 2: Remove `'proposal'` from `SurfaceTab` (the linchpin).** In `types/branding-preview.ts:96` drop `'proposal'` from `SurfaceTab`. Also remove `proposalLabels?` (L86) from `BrandPreviewState`, and the `proposal?`/legacy `quote?` keys from `BrandKit.blocks` (L130-141). In `blocks/types.ts` remove `'proposal'` from the `BlocksByDoc` union (L443).

- [ ] **Step 3: Delete the proposal-only block types.** In `blocks/types.ts` remove from the `BlockType` union: `proposalBody` (L44, deprecated marker) and `packageHeader`/`packageDetails`/`packageLineItems`/`packageInclusions`/`packageTotals` (L45-49). Delete the interfaces `ProposalBodyBlock` (L347-349), `PackageHeaderBlock` (L353-356), `PackageDetailsBlock` (L359-362), `PackageInclusionsBlock` (L365-369), `PackageLineItemsBlock` (L372-381), `PackageTotalsBlock` (L385-389); remove them from the `Block` union (L432-437); remove their `BLOCK_LABELS` (L460-465), the `BLOCK_LABEL_OVERRIDES` proposal entry (L478), and `BLOCK_DESCRIPTIONS` (L508-513). Keep every `action`-block definition.

- [ ] **Step 4: Surface maps and policy.** `blocks-by-surface.ts`: delete the `proposal:` line (L20). `policy.ts`: remove `packageLineItems`/`packageInclusions`/`packageTotals` from `DATA_BOUND` (L25) and the `proposal:` entry from `REQUIRED_BY_SURFACE` (L31). `sample-doc.ts`: remove the `proposal:` key from `SAMPLE_DOC_BY_SURFACE` (L99). `document-variables.ts`: delete the `PROPOSAL_DOC` array (L68-72) and the `proposal:` entry in `VARIABLES_BY_SURFACE` (L81).

- [ ] **Step 5: Defaults + migrations.** `defaults.ts`: remove the `surface === 'proposal'` branch in `actionDefaults` (L35-39); the `proposalBody`/`package*` cases in `blockTemplate` (L81-92); the `defaultBlocksFor` proposal branch (L113-124); the proposal action-wording migration (L233-241) and `expandProposalBody` + packageLineItems insertion in `migrateBlocks` (L305-328); and the whole `expandProposalBody` function (L395-407). Update the `defaultBlocksFor`/`migrateBlocks` surface-union signatures (L106, L188) to drop `'proposal'`.

- [ ] **Step 6: Renderers.** `render.tsx`: remove the `@/components/proposal/...` imports (L6-10), the package type imports (L54-58), and the "Package blocks" preview section (L1186-1265). `block-renderer.tsx`: remove the package `Render*` imports (L43-47), the `proposalBody` fixed-marker handling and `'Proposal (fixed)'` label (L234-250), and the `package*` switch cases (L509-518). `block-toolbar.tsx`: remove the package type imports (L37-40), the `package*` dispatch cases (L193-202), and the control components `PackageHeaderControls`/`PackageDetailsControls`/`PackageInclusionsControls`/`PackageTotalsControls` and their target types (L1808-1936+). `add-block-palette.tsx`: remove the `packageHeader`/`packageDetails`/`packageInclusions`/`packageTotals` icon map entries (L26-29) and drop any now-unused icon imports (`Package`, `ListChecks`, `Calculator`) at L4. `public-renderer.tsx`: remove the `case 'proposalBody': return null` (L124) and rewrite the L59-60 comment.

- [ ] **Step 7: Editor chrome.** `surface-tabs.tsx`: remove the `{ id: 'proposal', … }` TAB entry (L21). `canvas-scope-bar.tsx`: remove `proposal: 'Proposal'` from `SURFACE_LABEL` (L26) and the `surface === 'proposal'` explanatory `<p>` (L69-74). `documents-section.tsx`: remove the `{ id: 'proposal', … }` SURFACES entry (L16). `editor-branding.ts`: remove the `proposal_labels` save line (L48) and rewrite the L44 comment. `branding-editor.tsx`: remove the `ProposalLabels` import (L9); the `blocks.proposal` type/init/save (L73, L140, L1282, L387/391 in page-passed init is handled in Task 2.8); `proposalLabels` state/usage (L87, L144, L204, L965, L1173-1174) and `proposal_labels` save (L315); change the default surface from `'proposal'` to `'invoice'` at L229 (`useState<SurfaceTab>('invoice')`) and the fallback at L359 (`state.enabledSurfaces[0] || 'invoice'`); and remove the legacy `quote`→`proposal` normalisation (L630-638, L790) and the `docSurface` union types (L628, L1283).

- [ ] **Step 8: Shared lib validate/branding.** `validate-blocks.ts`: remove `proposal` from the `BlocksByDoc` interface (L33), the `repairAllSurfaces` seed (L67), and the `surfaces` array (L64); update the L4/L112 comments. `public-branding.ts`: remove the `resolveProposalLabels, ProposalLabels` import (L22), the `PublicBranding.proposal_labels` field (L79), the input `proposal_labels?` (L151), and the build line (L253). `use-current-branding.ts`: remove `'proposal'` from `BuilderSurface` (L54), the `proposal?`/legacy `quote` blocks-map keys (L66-68), and the `surface === 'proposal'` fallback (L128-132). `public-blocks/variable-values.ts`: optionally remove the `proposal_number` key (L55) — harmless but cleaner.

- [ ] **Step 9: Delete the proposal-labels module.** `git rm lib/branding/proposal-labels.ts` (its importers in `branding-editor.tsx`, `editor-branding.ts`, `public-branding.ts` were cleaned above).

- [ ] **Step 10: Verify.** Run:
  ```bash
  rg -ni proposal "app/(dashboard)/branding" "lib/branding" types/branding-preview.ts
  ```
  Expected: only `demo-doc.tsx`/`wizard-preview.tsx`/`step-documents.tsx`/`onboarding-wizard.tsx`/`editor-demo-tabs.tsx` (handled in 2.7) may still match; nothing else.

### Task 2.7: Retarget the onboarding wizard to Invoice (D5)

**Files:**
- Modify: `app/(dashboard)/branding/onboarding/step-documents.tsx`, `onboarding-wizard.tsx`, `wizard-preview.tsx`, `demo-doc.tsx`, `editor-demo-tabs.tsx`

- [ ] **Step 1: Surface lists drop proposal.** `step-documents.tsx`: remove the `proposal:` entry from the `SURFACES` record (L27-30) and `'proposal'` from `SURFACE_ORDER` (L57) so Invoice is first. `onboarding-wizard.tsx`: drop `'proposal'` from the default enabled-surfaces literal (L79) and the skip-handler literal (L128). `editor-demo-tabs.tsx`: remove the `{ label: 'Proposal', … active: true }` TAB entry (L18, and set another tab `active: true` e.g. Invoice) and drop `'Proposal'` from `DOC_ROWS` (L23).

- [ ] **Step 2: Retarget `wizard-preview.tsx` to an invoice.** Change `SAMPLE_DOC` (L57-68) `title: 'Wedding proposal'` → `title: 'Wedding invoice'`, `refNumber: 'PROP-0412'` → `refNumber: 'INV-0412'`. Change the `IDENTITY_BLOCKS` title (L76) if desired (keep neutral, e.g. `'Your wedding invoice'`). Change the `action` block (L82) `primary: 'Accept proposal'` → `primary: 'Pay now'`, `secondary: 'Ask a question'` (keep). Rewrite the L104-109 TSDoc so it says the preview renders a sample invoice, not "the exact code live proposals use".

- [ ] **Step 3: Retarget `demo-doc.tsx`.** Change `SAMPLE_DOC` (L27) title/ref to invoice values (`'Wedding invoice'`, `'INV-0412'`); the title block (L80) to `'Wedding invoice'`; the action block (L83) `primary: 'Pay now'`, `secondary` a neutral label; and the L61 comment to drop "proposal".

- [ ] **Step 4: Verify.** Run:
  ```bash
  rg -ni proposal "app/(dashboard)/branding/onboarding"
  ```
  Expected: no matches.

### Task 2.8: Add the dev-only branding-wizard re-trigger (D6)

**Files:**
- Modify: `app/components/sidebar.tsx`
- Modify: `app/(dashboard)/branding/page.tsx`

**Interfaces:**
- Consumes: the localStorage cache key `'zebri:branding-onboarded'` and the `?onboarding=1` query param convention introduced here.

- [ ] **Step 1: Force-open support on the branding page.** In `app/(dashboard)/branding/page.tsx`, add a `forceOnboarding` state read once post-hydration from the query param, and OR it into `showOnboarding`. After the existing cache-read effect (near L138) add:
  ```ts
  // TEMPORARY: dev-only re-trigger. The sidebar "Replay onboarding" button
  // (development builds only) navigates here with ?onboarding=1 to force the
  // wizard open without touching user_branding.onboarded_at. Remove together
  // with the sidebar button once onboarding QA has a permanent home.
  const [forceOnboarding, setForceOnboarding] = useState(false)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('onboarding') === '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForceOnboarding(true)
    }
  }, [])
  ```
  Then change the `showOnboarding` computation (L349-354) to:
  ```ts
  const showOnboarding =
    forceOnboarding ||
    shouldShowOnboarding({ loading, cacheSaysNeedsOnboarding: likelyNeedsOnboarding, onboardedAt })
  ```
  This deliberately does NOT clear `onboarded_at`; completing the wizard writes branding via the normal path.

- [ ] **Step 2: Add the dev-only sidebar button.** In `app/components/sidebar.tsx`, after the `bottomItems` render block (near L174), add a development-only entry. Match the existing nav `<Link>` styling; use a `<button>` with `cursor-pointer` and `strokeWidth={1.5}` on its Lucide icon:
  ```tsx
  {process.env.NODE_ENV === 'development' && (
    // TEMPORARY: dev-only branding-onboarding re-trigger. Clears the paint-hint
    // cache and force-opens the wizard via ?onboarding=1. Never ships to
    // production: the NODE_ENV check strips it from the build. Remove with the
    // page.tsx forceOnboarding branch once onboarding QA has a permanent home.
    <button
      type="button"
      onClick={() => {
        localStorage.removeItem('zebri:branding-onboarded')
        window.location.href = '/branding?onboarding=1'
      }}
      className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-text-muted hover:bg-surface-muted cursor-pointer"
    >
      <Sparkles strokeWidth={1.5} className="h-4 w-4" />
      Replay onboarding
    </button>
  )}
  ```
  Import `Sparkles` (or another unused `lucide-react` icon) at the top.

- [ ] **Step 3: Verify dev-only + commit Phase 2.** Run:
  ```bash
  rg -ni proposal components/proposal 2>/dev/null; echo "---"; rg -n "process.env.NODE_ENV === 'development'" app/components/sidebar.tsx
  ```
  Expected: `components/proposal` gone (first `rg` errors or empty); the dev guard present. Confirm a production build omits it (`NODE_ENV=production` dead-code-eliminates the branch). Then:
  ```bash
  git add -A
  git commit -m "refactor(branding): remove proposal surface + builders, add dev onboarding replay"
  ```

---

## PHASE 3 — Automations and email

**Commit 3.** Triggers, emitters, actions, variables, email module, send route. Registry entries and their stored rows must land in the same deploy as the migration (§11) — but the code changes go here; the row cleanup is in the Phase 4 migration.

### Task 3.1: Remove proposal triggers from the registry

**Files:**
- Modify: `lib/automations/triggers.ts`

- [ ] **Step 1: Delete the trigger specs.** Remove the definitions `proposalSent` (L345), `proposalAccepted` (L352), `proposalDeclined` (L359), `proposalDue` (L369-401), the exported helper `proposalOverdueThresholdDays` (L402-407), and `proposalOverdue` (L408-...). 

- [ ] **Step 2: Delete the registry entries.** In `triggerRegistry` (L1517+) remove the five keys (L1527-1531): `proposal_sent`, `proposal_accepted`, `proposal_declined`, `proposal_due`, `proposal_overdue`, and the `// Proposals` comment (L1526).

- [ ] **Step 3: Verify.** Run:
  ```bash
  rg -ni proposal lib/automations/triggers.ts
  ```
  Expected: no matches.

### Task 3.2: Remove the proposal time-emitters

**Files:**
- Delete: `lib/automations/time-emitters/proposal-due.ts`, `proposal-overdue.ts`
- Modify: `lib/automations/time-emitters/index.ts`

- [ ] **Step 1: Delete the emitter files.** `git rm lib/automations/time-emitters/proposal-due.ts lib/automations/time-emitters/proposal-overdue.ts`.

- [ ] **Step 2: Deregister.** In `time-emitters/index.ts` remove the imports (L51-52) and the `proposalDueEmitter`/`proposalOverdueEmitter` entries in the `registry` array (L79-80); rewrite the doc-comment examples (L9, L27, L37) that use `proposal_due`.

- [ ] **Step 3: Verify.** Run:
  ```bash
  rg -ni proposal lib/automations/time-emitters
  ```
  Expected: no matches. `app/api/cron/automations-tick/route.ts` calls `runTimeEmitters` generically (only a doc-comment mention at L15) — rewrite that comment too.

### Task 3.3: Remove the proposal automation actions

**Files:**
- Modify: `lib/automations/actions/documents.ts`, `actions/extended.ts`, `actions/ui.ts`, `audit-log/narrate.ts`

- [ ] **Step 1: `documents.ts` (`send_proposal`).** Remove `sendProposalEmail` from the `@/lib/email` import (L21), the `sendProposalSchema` (L58), the `sendProposal` ActionSpec (L69-...), the `pickProposal` helper (L295-...), and the `send_proposal: sendProposal` registry entry (L386).

- [ ] **Step 2: `extended.ts` (`create_invoice_from_proposal`).** Remove `createInvoiceFromProposalSchema` (L209), the `resolveProposalId` helper (L220), the `createInvoiceFromProposal` ActionSpec (L247-...), and the `create_invoice_from_proposal: createInvoiceFromProposal` registry entry (L673). Keep `apply_discount` and `add_line_item`, but narrow their `z.enum(['proposal','invoice'])` target to `z.enum(['invoice'])` (L398, L410) since proposals no longer exist.

- [ ] **Step 3: `ui.ts` labels.** Remove the `send_proposal` (L127-130) and `create_invoice_from_proposal` (L342-345) label entries; update the `apply_discount`/`add_line_item` descriptions (L372, L379) to drop "proposal or invoice", leaving "invoice".

- [ ] **Step 4: `narrate.ts`.** Remove the `send_proposal` (L76, L102) and `create_invoice_from_proposal` (L89) narration entries.

- [ ] **Step 5: Verify.** Run:
  ```bash
  rg -ni proposal lib/automations/actions lib/automations/audit-log
  ```
  Expected: no matches.

### Task 3.4: Remove proposal variables, launch catalogue, context comments

**Files:**
- Modify: `lib/automations/variables.ts`, `launch-catalogue.ts`, `context.ts`

- [ ] **Step 1: `variables.ts`.** Remove the `{{proposal.link}}` (L383), `{{proposal.number}}` (L392), `{{proposal.total}}` (L393) token-catalogue entries. Remove `'proposal'` from the namespace `case` at L148 (it shares a fall-through with invoice/contract/task — drop just the `case 'proposal':` label). Rewrite the L297 comment.

- [ ] **Step 2: `launch-catalogue.ts`.** Remove the `'proposal_sent'`/`'proposal_accepted'`/`'proposal_declined'`/`'proposal_due'`/`'proposal_overdue'` entries (L43-47) and the `// Quotes / proposals` comment (L42); remove `'send_proposal'` (L108) and `'create_invoice_from_proposal'` (L120); rewrite the L95 comment.

- [ ] **Step 3: `context.ts`.** Comment-only mentions (L86, L102). Rewrite so they no longer reference proposals/quotes. No functional branch here.

- [ ] **Step 4: Verify.** Run:
  ```bash
  rg -ni proposal lib/automations/variables.ts lib/automations/launch-catalogue.ts lib/automations/context.ts
  ```
  Expected: no matches.

### Task 3.5: Remove proposal editors from the automations inspector

**Files:**
- Modify: `app/(dashboard)/automations/[id]/inspector-panel.tsx`, `inspector-extended.tsx`

- [ ] **Step 1: `inspector-panel.tsx`.** Remove the `SendProposalExtraFields` import (L78); the `triggerType === 'proposal_sent' || … 'proposal_accepted' || … 'proposal_declined'` checks (L262-264); the `triggerType === 'proposal_due'` config block (L349); and the `case 'send_proposal':` rendering `<SendProposalExtraFields/>` (L1146-1153).

- [ ] **Step 2: `inspector-extended.tsx`.** Remove the `'proposal_sent'`/`'proposal_accepted'`/`'proposal_declined'` cases (L267-269), `case 'proposal_due':` (L274), `case 'proposal_overdue':` (L277), and the `SendProposalExtraFields` component (L1337-...).

- [ ] **Step 3: Verify.** Run:
  ```bash
  rg -ni proposal "app/(dashboard)/automations"
  ```
  Expected: no matches.

### Task 3.6: Remove proposal email and the send-contract proposal seeding

**Files:**
- Delete: `app/api/email/send-proposal/route.ts`
- Modify: `lib/email/html.ts`, `index.ts`, `starter-templates.ts`, `send-context.ts`, `template-variables.ts`
- Modify: `app/api/email/send-contract/route.ts`

- [ ] **Step 1: Delete the send-proposal route.** `git rm app/api/email/send-proposal/route.ts` (and remove the now-empty directory).

- [ ] **Step 2: `html.ts` + `index.ts`.** Delete `proposalHtml` (L123-...) from `html.ts`. In `index.ts` remove `proposalHtml` from the import (L8) and the re-export (L18), and delete `sendProposalEmail` and its inline options type (L53-...).

- [ ] **Step 3: `starter-templates.ts`.** Delete the "Proposal cover email" starter template (the L140-165 region).

- [ ] **Step 4: `send-context.ts`.** Remove `'proposals'` from the `latestShareLink` table union (L58); remove the `latestShareLink(supabase, 'proposals', …)` element from the `Promise.all` (L100-102) and the destructured `proposal` binding; delete the `if (proposal) { payload['proposal_link'] = …; payload['proposal_number'] = … }` branch (L112-114).

- [ ] **Step 5: `template-variables.ts`.** Remove the sample tokens `proposal_link` (L84), `proposal_number` (L85), `proposal_total` (L86).

- [ ] **Step 6: `send-contract/route.ts` (D1/D2 cross-dependency).** This route currently reads `contract.proposal_id` and the `proposals` table to seed a payment-schedule total. Remove: `proposal_id` from the select string (L73); `proposalTotal` declaration (L116); the `if (contract.proposal_id) { … }` proposal fetch (L118-135); the `proposalTotal` argument to `loadDefaultScheduleFirstStage` (L139-141) — pass `null`/omit per that helper's signature; and the `proposal: proposalTotal !== null ? { total: proposalTotal } : null` template payload key (L176). The contract email no longer computes a proposal-derived total.

- [ ] **Step 7: Verify + commit Phase 3.** Run:
  ```bash
  rg -ni proposal lib/email "app/api/email"
  ```
  Expected: no matches. Then:
  ```bash
  git add -A
  git commit -m "refactor(automations,email): remove proposal triggers, actions, variables, email"
  ```

---

## PHASE 4 — Migration and types

**Commit 4.** One destructive migration, then regenerated types.

### Task 4.1: Write the removal migration

**Files:**
- Create: `supabase/migrations/<ts>_remove_proposals.sql`

- [ ] **Step 1: Create the file with a timestamp after the latest migration.** Pick a `<ts>` greater than `20260730000100`. The file MUST open with the destructive marker and proceed in FK-safe order. Structure:
  ```sql
  -- @ALLOW_DESTRUCTIVE: proposals feature removed; no production usage (owner-approved 2026-07-30)
  -- Remove the proposal feature in full: tables, FK columns, RPCs, and the
  -- dead branding-block trees and orphaned automation rows that reference it.

  -- 1. Orphaned automations (delete rows before the registry code ships).
  -- @ALLOW_DESTRUCTIVE: proposals feature removed; no production usage (owner-approved 2026-07-30)
  delete from public.automations
  where trigger_type in (
    'proposal_sent','proposal_accepted','proposal_declined','proposal_due','proposal_overdue'
  )
  or id in (
    select automation_id from public.automation_actions
    where action_type in ('send_proposal','create_invoice_from_proposal')
  );
  -- automation_actions / automation_runs / automation_waits / automation_events
  -- / automation_audit_log cascade via ON DELETE CASCADE.

  -- 2. Strip the `proposal` key from every branding block tree.
  update public.user_branding
  set branding_blocks = branding_blocks - 'proposal'
  where branding_blocks ? 'proposal';

  -- 3. Drop the proposal RPCs (and their anon grants go with them).
  drop function if exists public.get_public_proposal(uuid);
  drop function if exists public.accept_proposal(uuid, uuid, jsonb);
  drop function if exists public.decline_proposal(uuid);
  drop function if exists public.generate_proposal_number(uuid);

  -- 4. Rewrite sign_contract without the proposal→invoice branch (D1).
  -- (full body in Step 2)

  -- 5. Rewrite get_portal_data without the payments.proposals key.
  -- (full body in Step 3)

  -- 6. Drop the FK columns (D2).
  -- @ALLOW_DESTRUCTIVE: proposals feature removed; no production usage (owner-approved 2026-07-30)
  alter table public.invoices drop column if exists proposal_id;
  -- @ALLOW_DESTRUCTIVE: proposals feature removed; no production usage (owner-approved 2026-07-30)
  alter table public.contracts drop column if exists proposal_id;

  -- 7. Drop the tables in FK order.
  -- @ALLOW_DESTRUCTIVE: proposals feature removed; no production usage (owner-approved 2026-07-30)
  drop table if exists public.proposal_option_items;
  -- @ALLOW_DESTRUCTIVE: proposals feature removed; no production usage (owner-approved 2026-07-30)
  drop table if exists public.proposal_options;
  -- @ALLOW_DESTRUCTIVE: proposals feature removed; no production usage (owner-approved 2026-07-30)
  drop table if exists public.proposals;
  ```
  Note: verify the exact `accept_proposal` signature `(uuid, uuid, jsonb)` and `automation_actions.action_type` column name against the migrations before finalizing (`rg -n "action_type|accept_proposal" supabase/migrations`).

- [ ] **Step 2: Rewrite `sign_contract` (drop the proposal branch, keep the signature and return shape).** Add to the migration:
  ```sql
  create or replace function public.sign_contract(
    token uuid,
    p_signer_name text,
    p_signer_ip text,
    p_signer_user_agent text
  )
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
  as $$
  declare
    v_contract record;
    v_now timestamptz := now();
  begin
    select * into v_contract
    from public.contracts
    where share_token = token
      and share_token_enabled = true
      and status = 'sent'
    for update;

    if v_contract is null then
      return jsonb_build_object('error', 'not_found_or_not_sent');
    end if;

    if v_contract.expires_at is not null and v_contract.expires_at < current_date then
      update public.contracts set status = 'expired' where id = v_contract.id;
      return jsonb_build_object('error', 'expired');
    end if;

    -- Audit row first — survives any later revoke.
    perform public.emit_contract_audit_event(
      p_contract_id := v_contract.id,
      p_event_type := 'signed',
      p_actor := 'couple',
      p_actor_ip := p_signer_ip,
      p_actor_user_agent := p_signer_user_agent,
      p_signer_name_typed := p_signer_name
    );

    update public.contracts
    set status = 'signed',
        signed_at = v_now,
        signer_name = p_signer_name,
        signer_ip = p_signer_ip,
        signer_user_agent = p_signer_user_agent
    where id = v_contract.id;

    -- Update couple status to 'confirmed' on first signed contract.
    update public.couples
    set status = 'confirmed'
    where id = v_contract.couple_id and status in ('lead', 'enquiry', 'quoted');

    -- No invoice is created on signing. Invoices are fully manual (D1).

    -- Follow-up task for the MC.
    insert into public.tasks (user_id, related_couple_id, title, status)
    values (
      v_contract.user_id, v_contract.couple_id,
      'Contract signed — follow up with couple',
      'todo'
    );

    return jsonb_build_object('ok', true, 'contract_id', v_contract.id);
  end;
  $$;
  ```
  (The `-- follow up` task title uses an em dash in the current DB string; leave the existing DB copy byte-identical to avoid churn, since it is data not prose.)

- [ ] **Step 3: Rewrite `get_portal_data`'s payments block.** Redefine the function (copy its current body from `20260711000000_drop_quotes_feature.sql` L145+) with the `payments` object's `'proposals'` key (L265-272) removed, keeping only `'invoices'`:
  ```sql
  'payments', jsonb_build_object(
    'invoices', coalesce(
      (select jsonb_agg(jsonb_build_object('id', inv.id, 'title', inv.title, 'invoice_number', inv.invoice_number,
          'status', inv.status, 'subtotal', inv.subtotal, 'due_date', inv.due_date::text,
          'share_token', inv.share_token, 'share_token_enabled', inv.share_token_enabled)
        order by inv.created_at desc)
        from invoices inv where inv.couple_id = v_couple_id),
      '[]'::jsonb
    )
  ),
  ```
  Copy the rest of the function verbatim (the `contracts`, `files`, `vows`, `timeline_items`, etc. keys are unchanged). Re-grant `to anon` if the original had it.

- [ ] **Step 4: Guard the migration.** Run:
  ```bash
  bash scripts/check-migrations.sh
  ```
  Expected: PASS (`+` on each destructive statement — every one carries the marker).

### Task 4.2: Replay from zero and regenerate types

- [ ] **Step 1: Reset local Supabase from zero.**
  ```bash
  supabase db reset
  ```
  Expected: all migrations replay clean, including the new one. If you hit the known local grant breakage after reset (`local_db_reset_grant_breakage` memory), run the documented repair SQL before proceeding.

- [ ] **Step 2: Confirm the schema is clean.**
  ```bash
  supabase db execute "select to_regclass('public.proposals'), to_regclass('public.proposal_options'); select column_name from information_schema.columns where table_name in ('invoices','contracts') and column_name='proposal_id';"
  ```
  Expected: tables are `NULL` (gone); no `proposal_id` rows.

- [ ] **Step 3: Regenerate types.**
  ```bash
  supabase gen types typescript --local > types/database.ts
  ```
  Then verify:
  ```bash
  rg -ni proposal types/database.ts
  ```
  Expected: no matches.

- [ ] **Step 4: Commit Phase 4.**
  ```bash
  git add -A
  git commit -m "feat(db): drop proposals tables, columns, RPCs; regenerate types"
  ```

---

## PHASE 5 — Tests, gates, docs

**Commit 5.** Deletions, prunes, new coverage, ratchets, doc updates. This is the branch head where all gates must be green.

### Task 5.1: Delete proposal-only test files

- [ ] **Step 1: Remove the 12 whole-file proposal suites.**
  ```bash
  git rm tests/e2e/proposals.spec.ts tests/e2e/proposal-blocks.spec.ts \
    tests/integration/payments/invoice-from-proposal.test.ts \
    tests/integration/payments/public-proposal-rpcs.test.ts \
    tests/integration/payments/save-proposal-action.test.ts \
    tests/unit/app/api/email/send-proposal.test.ts \
    tests/unit/lib/automations/time-emitters/proposal-due.test.ts \
    tests/unit/lib/automations/time-emitters/proposal-overdue.test.ts \
    tests/unit/lib/branding/proposal-labels.test.ts \
    tests/unit/branding/proposal-section-label-colour.test.tsx \
    tests/unit/proposal/proposal-blocks-renderer.test.tsx \
    tests/unit/proposal/proposal-document-body.test.tsx
  ```

### Task 5.2: Rewrite `sign-contract-stages.test.ts` for the no-invoice contract (§8)

**Files:**
- Modify: `tests/integration/payments/sign-contract-stages.test.ts`

- [ ] **Step 1: Rewrite the seed and the assertion.** The suite currently seeds an accepted proposal + a contract linked via `proposal_id`, then asserts signing spawns a staged invoice (L86 `it('spawns an invoice for the full proposal subtotal with stages')`). Replace the seed helper (L24-71) with a proposal-less path: a couple and a `sent` contract with no `proposal_id`. Replace the assertion with the opposite (D1):
  ```ts
  it('records the signature and creates no invoice', async () => {
    const before = await countInvoices(coupleId)
    const res = await signContract(shareToken)
    expect(res.ok).toBe(true)
    const after = await countInvoices(coupleId)
    expect(after).toBe(before) // signing creates nothing
    const contract = await getContract(contractId)
    expect(contract.status).toBe('signed')
    expect(contract.signer_name).toBeTruthy()
  })
  ```
  Adapt helper names to the suite's existing utilities.

- [ ] **Step 2: Run it against local Supabase.**
  ```bash
  npx vitest run --project integration tests/integration/payments/sign-contract-stages.test.ts
  ```
  Expected: PASS.

### Task 5.3: Prune proposal cases from shared suites

**Files:**
- Modify: `tests/integration/rls/payments-tables.test.ts` (comment block L18-20), `tests/integration/templates/packages-v2.test.ts`, `tests/unit/app/(dashboard)/payments/payments-table.test.tsx`, `payments-footer.test.tsx`, `payments-header.test.tsx`, `tests/unit/lib/contracts/contract-variables.test.ts`, `tests/unit/components/builders/contract-builder-new-draft.test.tsx`, `tests/unit/lib/automations/variables.test.ts`, `launch-catalogue.test.ts`, `home-payload.test.ts`, `actions/send-email.test.ts`

- [ ] **Step 1: Prune each.** Remove proposal-specific cases while keeping the surviving-behaviour assertions: `payments-tables.test.ts` (comment only, drop the proposal pointer); `packages-v2.test.ts` (remove the `proposal_options.source_package_id` provenance assertions L15/78-98/114-120/158-202, keep the package commercial-field coverage); the three `payments-*.test.tsx` files (drop the Proposal tab/`makeProposal`/"Search proposals" cases); `contract-variables.test.ts` (drop `total_amount`/`deposit_amount` assertions — Task 2.3 already added the replacement); `contract-builder-new-draft.test.tsx` (drop the single proposal ref); the automations unit tests (drop proposal token/entry cases).

- [ ] **Step 2: Run the pruned suites.**
  ```bash
  npx vitest run tests/unit/app/(dashboard)/payments tests/unit/lib/contracts tests/unit/lib/automations tests/unit/components/builders/contract-builder-new-draft.test.tsx
  npx vitest run --project integration tests/integration/templates/packages-v2.test.ts tests/integration/rls/payments-tables.test.ts
  ```
  Expected: PASS.

### Task 5.4: Add the new coverage (§8)

**Files:**
- Create/modify: an integration test for `get_portal_data` and a unit test for `useApplySources`

- [ ] **Step 1: Portal data has no proposals key (integration, TDD).** Add to the portal integration suite (find with `rg -l get_portal_data tests`):
  ```ts
  it('returns no proposals key in payments', async () => {
    const data = await callGetPortalData(token)
    expect(data.payments).not.toHaveProperty('proposals')
    expect(data.payments).toHaveProperty('invoices')
  })
  ```
  Run against local Supabase; expect PASS (migration already applied).

- [ ] **Step 2: `useApplySources` returns packages + invoice templates only (unit, TDD).** In `tests/unit/components/builders/parts/` add a test asserting the returned sources contain package and invoice-template groups and no `prop:`-prefixed / `proposal` entries. Mock the Supabase client as the existing part tests do. Run; expect PASS.

- [ ] **Step 3: Sign-contract no-invoice + contract-variable picker.** These are covered by Task 5.2 and Task 2.3 respectively — confirm both are green.

### Task 5.5: Ratchet gates and remove the proposal surface scan

**Files:**
- Modify: `scripts/check-public-surface-styling.mjs`, `scripts/lint-gate.mjs`, `scripts/typecheck-strict-gate.mjs`

- [ ] **Step 1: Remove the proposal surface from the styling scan.** In `check-public-surface-styling.mjs` remove `'components/proposal'` (L27) and `'app/proposal'` (L29) from the scanned dirs and the proposal mentions in the header comment (L5, L10).

- [ ] **Step 2: Measure the real budgets.** Run all three gates and read the actual counts:
  ```bash
  npm run typecheck && npm run lint:gate; npm run typecheck:strict
  ```
  `npm run typecheck` must be 0. For `lint:gate` and `typecheck:strict`, note the reported numbers.

- [ ] **Step 3: Ratchet DOWN to the measured values.** Set `ERROR_BUDGET`/`WARNING_BUDGET` in `scripts/lint-gate.mjs` (currently 63 / 261) and `STRICT_BUDGET` in `scripts/typecheck-strict-gate.mjs` (currently 278) to the new lower numbers from Step 2. Only ever decrease. (The spec's stated 63/265/281 were stale; use the real post-deletion measurements.)

- [ ] **Step 4: Confirm gates pass at the new budgets.**
  ```bash
  npm run lint:gate && npm run typecheck:strict
  ```
  Expected: PASS.

### Task 5.6: Update and delete docs

**Files:**
- Delete: `.claude/docs/proposals.md`, `.claude/docs/quotes.md`
- Modify: `database-schema.md`, `page-specs.md`, `security.md`, `testing.md`, `branding.md`, `document-blocks.md`, `component-library.md`, `frontend-design.md`, `cicd.md`, `production-readiness.md`, `phase-2-payments.md`, `branding-editor-redesign.md`, `branding-editor-redesign-plan.md`
- Modify: `docs/superpowers/specs/2026-07-28-proposal-single-multi-package-views.md`, `2026-07-28-custom-payment-schedules-design.md` (mark obsolete)

- [ ] **Step 1: Delete the dead docs.** `git rm .claude/docs/proposals.md .claude/docs/quotes.md`.

- [ ] **Step 2: Correct the surviving docs.** In each listed `.claude/docs/*` file, remove proposal sections and rewrite mentions so payments reads as invoices + contracts, branding surfaces read as Invoice/Contract/Portal/Run sheet/Questionnaire, and the RLS matrix / security tables drop the proposal tables. Update `database-schema.md` to reflect the dropped tables and columns. Use `rg -n proposal <file>` per file to find every mention.

- [ ] **Step 3: Mark the superseded specs obsolete (don't delete).** At the top of `2026-07-28-proposal-single-multi-package-views.md` and the proposal-facing half of `2026-07-28-custom-payment-schedules-design.md`, add a status banner: `> **OBSOLETE (2026-07-30):** superseded by the proposals removal (docs/superpowers/specs/2026-07-30-remove-proposals-design.md).`

### Task 5.7: Final sweep and branch-head verification

- [ ] **Step 1: Completion oracle.** Run:
  ```bash
  rg -i proposal app components lib types middleware.ts scripts
  ```
  Expected: NOTHING outside historical migration files. If any survivor remains, fix it before proceeding.

- [ ] **Step 2: Full gate + test run.**
  ```bash
  npm run typecheck && npm run typecheck:strict && npm run lint:gate && npm test
  ```
  Expected: typecheck 0; strict + lint gates pass at the ratcheted budgets; unit + integration suites green.

- [ ] **Step 3: E2E.**
  ```bash
  npx playwright test
  ```
  Expected: green (proposal specs deleted; branding/payments specs pruned).

- [ ] **Step 4: Manual verification in a running app.** Start the app and confirm by hand: Payments shows Invoices | Contracts (default Invoices), no Proposals tab; couple profile payments shows invoices only; the invoice builder's "Start from a package or template" still lists packages + invoice templates; the contract builder has no "Link to proposal" row; branding surfaces are Invoice/Contract/Portal/Run sheet/Questionnaire with no Proposal tab and no package blocks; the portal shows no proposals list; automations have no proposal triggers/actions; and the dev-only "Replay onboarding" sidebar button opens the branding wizard. Confirm a production build (`NODE_ENV=production`) omits that button.

- [ ] **Step 5: Commit Phase 5 and open the PR.**
  ```bash
  git add -A
  git commit -m "test,docs: remove proposal tests, ratchet gates, update docs"
  ```
  Open the PR to `staging` (staging-only batch rule). CI runs on the branch head.

---

## Self-Review Notes

- **Spec coverage:** §1 Database → Phase 4 (Task 4.1-4.2). §2 Payments page → Phase 1 (1.1-1.4). §3 Contracts → Phase 2 (2.2-2.3). §4 Branding → Phase 2 (2.5-2.8). §5 Automations → Phase 3 (3.1-3.5). §6 Public/email → Phase 1 (1.5) + Phase 3 (3.6). §7 Copy → Phase 1 (1.5 Step 7). §8 Tests → Phase 5 (5.1-5.4). §9 Gates/docs → Phase 5 (5.5-5.6). §10 Sequencing → the five phases map 1:1 to the five commits. §11 Risks → the automations-tick risk is handled by co-locating row cleanup with the migration (Task 4.1 Step 1); block-validation risk by the JSON strip (4.1 Step 1) + the `supabase db reset` replay (4.2).
- **Deviations from the spec worth flagging to the reviewer:** (a) gate budgets differ from the spec's stated numbers — measured values used (5.5). (b) `send-contract/route.ts` had a real proposal-schedule seeding branch beyond a bare "reference"; removed under D1/D2 (3.6 Step 6). (c) `contract-variables.ts` shipped nine variables, not seven; the two money variables are the removals (2.3). (d) two extra whole-file proposal test suites (`tests/unit/proposal/*`) were found and added to the delete list (5.1). (e) the dev-only sidebar trigger did not exist and is created fresh, wired through a `?onboarding=1` query param the branding page reads (2.8).
- **Type consistency:** `PaymentsTab` = `'invoices' | 'contracts'` everywhere; `SurfaceTab` and `BuilderSurface` both drop `'proposal'`; `buildContractVariables` loses `proposal`/`firstStage` in its definition (2.3) and every call site (2.2, 3.6).
