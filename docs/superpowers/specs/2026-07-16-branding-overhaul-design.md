# Branding Overhaul — Design Spec

**Date:** 2026-07-16
**Branch / PR:** `feature/proposals-phase-a` (single PR, per founder decision)
**Status:** Approved by Arjun (2026-07-16)

## Goal

Take the branding editor from "in preview, rough" to production-quality:
highly customisable, easy for non-designers (wedding MCs), safe (users cannot
break functional documents like invoices), honest previews (phone preview and
live pages render identically), and branding that actually reaches every
customer-facing surface (proposals, invoices, contracts, portal, vendor
timeline, questionnaires, emails, PDFs).

Origin: full five-track audit on 2026-07-16 (block library, propagation,
hydration, mobile overflow, UX/lock model). Findings summarised inline below.

## Locked decisions (from founder)

1. **Preview reset:** wipe saved brand kits AND all per-surface block layouts
   for every user via migration. Keep scalars (colors, fonts, logo, business
   info). Everyone re-onboards.
2. **Disabled surface semantics:** editor hides the tab; the live public page
   uses the existing fallback layout still tinted with scalar branding.
   Re-enable any time from the brand panel.
3. **Scope: everything in this one PR** — all audit fixes, onboarding,
   vendor timeline and questionnaire as new editable surfaces (six total),
   3 templates per surface, and editor/public renderer unification. No
   follow-up PRs.
4. **Questionnaire display modes:** the typeform/form mode stays a
   per-questionnaire choice in the questionnaire builder. One block tree
   brands both modes: form mode renders pre/post-marker blocks as page
   chrome; typeform mode renders pre-marker blocks on the welcome screen
   and post-marker blocks on the thank-you screen.

## 1. Data layer and migration

One new migration (deployed only via CI `supabase db push`):

- `user_branding.enabled_surfaces jsonb not null default
  '["proposal","invoice","contract","portal","vendorTimeline","questionnaire"]'`
- `user_branding.onboarded_at timestamptz` — null means show onboarding.
- Data reset: `update user_branding set brand_kits = '[]'::jsonb,
  branding_blocks = null;` (preview-phase reset; scalars retained).
- `get_vendor_timeline` additionally returns `branding`
  (`_user_branding(user_id)`) and `branding_blocks`
  (`_user_branding_blocks(user_id, 'vendorTimeline')`).
- The public questionnaire RPC additionally returns `branding_blocks`
  (`_user_branding_blocks(user_id, 'questionnaire')`); it already merges
  scalar branding via `_user_branding`.

No other RPC changes. Disabling a surface clears that surface's key in
`branding_blocks`; public pages already fall back when the block tree is
empty, and scalars still flow.

## 2. Renderer unification

Public block components in `lib/branding/public-blocks/` become the single
source of truth. The editor renders the same components and injects editing
behaviour:

- Each block component accepts optional `slots` (text regions; default =
  static sanitized render, editor passes `InlineText`-backed editors) and
  `chrome` (resize handles, upload overlays; default = none).
- `block-frame.tsx` (selection outline, drag handle, toolbar anchor) stays
  editor-only and wraps the shared component.
- `app/(dashboard)/branding/blocks/render.tsx`'s per-block markup is deleted
  as each block migrates; style derivation already shared via
  `block-outer-style.ts` / `shared.ts` stays in `lib/branding`.

Outcome: preview cannot drift from production; every overflow fix lands once.

## 3. Vendor timeline surface

- New `SurfaceTab` value `vendorTimeline`, fifth editor tab.
- Palette: headerBanner, businessName, tagline, text, divider, spacer, image,
  footer around a new locked `vendorTimelineBody` marker block that renders
  the live timeline (sample data in editor).
- Public page `app/portal/[token]/vendor/page.tsx` renders the block tree
  split at the marker (same pattern as portal) with scalar tinting replacing
  today's hardcoded white/gray.

## 3b. Questionnaire surface

- New `SurfaceTab` value `questionnaire`, sixth editor tab.
- Palette: headerBanner, businessName, tagline, text, divider, spacer, image,
  footer around a new locked `questionnaireBody` marker block that renders
  sample questions in the editor.
- One block tree brands both display modes. Form mode: pre-marker blocks are
  page chrome above the questions, post-marker blocks render beneath submit.
  Typeform mode: pre-marker blocks form the welcome screen, post-marker
  blocks the thank-you screen; mid-flow branding stays scalar-driven via the
  existing `QuestionnaireTheme` resolver (`components/questionnaires/theme.ts`),
  which the fill page, builder preview, and send preview already share.
- The editor canvas gets a Form / One-at-a-time preview toggle for this
  surface only.
- Display mode remains a per-questionnaire choice in the questionnaire
  builder (`QuestionnaireDisplayMode` in `lib/questionnaires/question-schema.ts`).
- Out of scope: per-question styling (fonts/colors per question). Question
  styling stays derived from brand scalars.

## 4. Templates

Three distinct templates per surface (Classic, Minimal, Bold) x 6 surfaces =
18 templates in `app/(dashboard)/branding/templates/`. Templates set blocks
only, never brand tokens. Classic is the onboarding seed.

## 5. Onboarding wizard

Trigger: visiting `/branding` while `onboarded_at is null`. Three steps, each
skippable ("Skip, use defaults"):

1. **Your business** — name, tagline, logo upload (prefilled from existing
   scalar data).
2. **Your look** — brand color (extract-from-logo suggestion via
   `lib/branding/extract-colors.ts`), font pairing, density preset.
3. **What do you send couples?** — toggle cards: Proposals, Invoices,
   Contracts, Client Portal, Vendor Timeline, Questionnaires. Enabled
   surfaces get the Classic template seeded; disabled tabs hidden.

Finish → set `onboarded_at`, persist `enabled_surfaces`, land in the editor
on the first enabled surface. Brand panel gains a **Documents** section
(same toggles, changeable any time) and a per-surface **Reset to template**
button.

## 6. Lock model and safety

- `required` flag per (block type, surface): invoice = lineItems, totals,
  paymentDetails; all marker blocks (proposalBody, paymentSchedule,
  contractBody, couplePortal, vendorTimelineBody, questionnaireBody)
  everywhere they appear.
  Whether `action` is required on invoice/proposal/contract is finalized
  during planning after verifying which block actually carries the
  accept/pay/sign path on each live page (the marker blocks may already
  embed it).
- Required blocks: lock chip in UI, delete disabled with tooltip; delete
  guard in state logic covers ALL locked/required types (closes the
  proposalBody/contractBody deletion hole).
- Data-bound blocks (paymentSchedule, lineItems) show a "Live data" chip.
- Server-side tree validation in `lib/branding/sanitize.ts` on save:
  required blocks present per surface, markers exactly once; repair by
  re-inserting missing required blocks from defaults.
- Deleting a block shows a toast with Undo (no confirm dialog; history
  already supports undo).
- Autosave failure state gets a Retry button.

## 7. Correctness fixes

- Hydration: `app/branding/preview/[surface]/page.tsx` reads the route param
  from Next params, not `window.location`.
- `sanitizeHtml`: single deterministic pure-JS implementation on server and
  client (remove the DOMParser/regex fork).
- `fmtDate` in `public-blocks/shared.ts`: format in UTC.
- Image block default height 240 → 160 (min already lowered to 24 in
  working tree; empty-image click-trap fix also folds in).
- Inline text edits on first click.
- paymentSchedule gets the standard locked treatment (dashed border + badge).

## 8. Mobile overflow (container queries)

Editor canvas and public document cards get `container-type: inline-size`;
block-level responsive styles use Tailwind 4 container queries (`@sm:` etc.)
so the 380px phone preview matches real phones. Specific fixes: responsive
density padding (px-4 → @sm:px-6 …), payment-details labels stack on narrow
widths, line-items always justify-between, `break-words` on text blocks,
footer contact wraps, action buttons stack, portal nav collapses, tighter
title meta gaps, totals `min-w-0`.

## 9. Email and PDF wiring

- Email send routes (proposal, invoice, contract, contract reminder,
  questionnaire) fetch sender scalar branding and pass it through to
  `wrapTemplateHtml()` (already branding-capable).
- `generateAndPrintPdf()` passes branding into `buildPdfHtml()`; contract
  PDFs stop bypassing branding.

## 10. Testing and docs

- Unit: sanitize determinism (server path === client path), required-block
  repair, template registry shape, fmtDate UTC.
- Integration (local Supabase): migration replay, vendor RPC returns
  branding + blocks, user_branding RLS still denies cross-tenant.
- E2E (desktop + Pixel 5 + iPhone 12): onboarding end-to-end, lock
  enforcement (required block cannot be deleted), no horizontal scroll on
  public proposal/invoice at mobile width.
- Docs updated same PR: `database-schema.md`, `page-specs.md`,
  `component-library.md`, `branding.md`, `production-readiness.md`.

## Sequencing (commits inside the one PR)

1. Correctness fixes (hydration, sanitize, fmtDate, image defaults,
   one-click edit, lock-badge consistency) — small, independently green.
2. Lock model + server validation + delete guards + undo toast + autosave
   retry.
3. Renderer unification block-by-block (public-blocks grow slots/chrome;
   editor render.tsx shrinks).
4. Container queries + overflow fixes (lands in unified renderers).
5. Migration (schema + reset + vendor RPC) + enabled-surfaces plumbing.
6. Vendor timeline surface (editor + public page).
6b. Questionnaire surface (editor + fill page welcome/thank-you mapping).
7. Templates (18).
8. Onboarding wizard + brand panel Documents section + per-surface reset.
9. Email/PDF wiring.
10. Tests + docs + gate ratchets.

## Risks

- Renderer unification touches all 17 block types; mitigated by migrating
  one block per commit with the editor kept green throughout.
- Reset migration reaches remote only via CI deploy; local verification via
  the isolated local-Supabase dev-server recipe.
- Single large PR is chunky to review; commits are phase-ordered and
  independently revertible.
