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
shared builder parts with an options stack; Proposals tab on
/payments (first tab) + couple-profile section; two-tab live preview;
e2e `tests/e2e/proposals.spec.ts`, validated on the isolated
local-Supabase server desktop + iPhone 12 via
`playwright.iso.config.ts`) →
D public page (**done**: `/proposal/[token]` option chooser + add-on
ticks + two-step accept; accepted receipt view; scalar branding via
`_user_branding`; **block-tree layouts deliberately deferred** — a
block tree can't express the chooser; `/proposal` in middleware
PUBLIC_ROUTES) →
E invoice generation + contract link (**done**: invoice builder
offers accepted proposals as `prop:` apply sources [recorded
selection + deposit % + GST carried, `invoices.proposal_id`
provenance]; "Generate invoice" on accepted proposals; contracts link
to accepted proposals for {{total_amount}}/{{deposit_amount}} and
`sign_contract`'s proposal branch auto-creates the deposit invoice at
the accepted option's own deposit %; migration
`20260710000100_sign_contract_proposal_branch.sql`) →
F automations+portal+docs (**done**: `get_portal_data` returns
payments.proposals [`20260710000200_portal_proposals.sql`] + portal
UI section; proposal_sent/accepted/declined/due/overdue triggers,
send_proposal + create_invoice_from_proposal actions, proposal.*
variables, time emitters on automations-tick, launch catalogue +
starter cover email) →
G delete quote code (**done**: builder, public page, send route,
templates tab, automations specs, branding surface, PDF branch,
starter templates and all 13 quote test files removed; quote-trigger
automations archived with a "references retired Quotes" note) →
H destructive drop migration (**done**:
`20260711000000_drop_quotes_feature.sql`, `-- @ALLOW_DESTRUCTIVE` —
drops quotes / quote_items / quote_templates / quote_template_items,
the 4 quote RPCs, the quote lifecycle trigger, `invoices.quote_id` +
`contracts.quote_id`; quote-free `sign_contract` + `get_portal_data`;
replayed clean on local Supabase from zero, full pyramid green,
`types/database.ts` regenerated from the final schema).

**Status: complete.** All phases (A–H) built and verified locally on
2026-07-10. NOTE: the remote/production DB receives the proposals +
drop migrations only via the CI `supabase db push` deploy — until
that runs, the running app on the remote DB has neither surface.
Owner direction 2026-07-10: phases were built in one continuous push
(no per-phase pause). Full plan of record:
`~/.claude/plans/theres-too-much-white-parsed-mango.md` (2026-07-10).

## One shared page component (2026-07-11)

The couple-facing layout lives in `components/proposal/` —
`proposal-page-view.tsx` (+ `option-chooser`, `option-selection`) — and
is rendered by ALL THREE surfaces: the public page, the composer's
Page preview (fed the MC's live branding via `useCurrentBranding`), and
the branding editor's Proposal surface (sample data + the kit being
edited). Pure types/helpers moved to `lib/payments/proposal-view.ts`.
The Proposal branding surface is intentionally NOT block-editable —
scalar kit values are what ship, so the canvas shows exactly that.

## Editable Accept + Footer blocks; public page renders the tree

The Accept/Decline CTA and the ABN are no longer inside the fixed
core; they are standard editable blocks below it: an `action` block
(label + button colour/radius/width/alignment) and the `footer` block
(contact + ABN). `defaultBlocksFor('proposal')` seeds
[headerBanner, businessName, proposalBody, action, footer]; the fixed
`proposalBody` core renders `ProposalPageView` variant `blockCore`
(eyebrow + names + expiry, notes, chooser, priced selection only).

Migration `20260714000000_proposal_public_blocks.sql` makes
`get_public_proposal` return `branding_blocks` (via
`_user_branding_blocks`, like invoice/contract). The public page
(`app/proposal/[token]/page.tsx`) splits the tree at the `proposalBody`
marker (invoice branded-card model): pre-blocks (banner, business) then
the fixed core then the interactive Accept (`ProposalAcceptActions`,
styled + labelled from the `action` block via `findActionStyle`) then
post-blocks (footer + ABN). No saved blocks (or pre-migration DB) falls
back to the standalone `ProposalPageView`. Composer preview unchanged.

## Block-based branding surface (2026-07-12)

The proposal branding surface is now a BLOCK tree like invoice /
contract / portal — not a bespoke canvas. The interactive core (the
package chooser, the chosen option's priced detail, the accept block)
is a fixed `proposalBody` marker block (same pattern as `couplePortal`
/ `contractBody`): its structure/order can't be reordered, but the MC
drags chrome blocks (header banner, business name, text, divider,
footer, …) above and below it and retypes its section labels inline
directly on the canvas. The marker renders inside a dashed
"Fixed layout" frame with a single/multi package preview toggle
(`state.proposalPreviewMode`, preview-only) so the MC can see both the
one-package layout (no chooser) and the multi-package chooser.
`RenderProposalBody` (in `blocks/render.tsx`) renders the shared
`ProposalPageView` with sample data, so the canvas stays pixel-matched
to the sent page. `defaultBlocksFor('proposal')` seeds
[headerBanner, businessName, proposalBody, footer]; `migrateBlocks`
injects the marker into any pre-block-model proposal design.

## Full brand-kit control + editable wording (2026-07-12)

Migration `20260713000000_proposal_branding_tokens.sql` adds
`doc_padding` + `proposal_labels` to the `_user_branding` payload (so
they reach the public page, not just the in-app preview). The proposal
view now consumes the WHOLE kit: primary (eyebrows/checks/CTA/selected
state), **accent** (the "most popular" badge + that card's tint —
distinct from primary), **secondary + secondary-text** (the price
summary panel surface), surface/text/muted, fonts + heading weight,
corner radius, density, **font scale** (root `font-size: {scale}rem`;
all proposal text is `em`-based), **doc padding** (extra horizontal
inset), logo, header image, business name, **tagline** (appended to the
"A proposal from …" line) and **ABN** (footer). Every visible string is
editable via `lib/branding/proposal-labels.ts` (brand-level, stored in
`user_metadata.proposal_labels`, resolved with defaults) — the eyebrow,
note heading, chooser heading + hint, package heading, add-ons heading
+ hint, and the accept + decline wording. The branding editor's
Proposal surface edits the wording DIRECTLY on the canvas, Canva-style
(`components/proposal/editable-label.tsx`): click any heading/hint/
button on the live preview to retype it (select-all on focus, Enter/
blur commits, Escape reverts, clearing resets to default). A
portal-style bar (`ProposalBrandingBar`) above the canvas carries only
the locked-structure note, the logo/header uploads (unreachable
elsewhere on that surface) and a Reset-wording shortcut. The section ORDER + structure
stay fixed by design (the chooser can't be a block tree).

## Preview parity + surface-scope clarity (2026-07-12)

The couple page and the composer's Page preview now render through ONE
shared component, `components/proposal/proposal-document-body.tsx`
(`ProposalDocumentBody`), so they can't drift. It owns the
split-at-marker layout: pre-blocks, the fixed `proposalBody` core, the
`action` block slot (filled by the caller's accept UI), then post-blocks
(footer + ABN), with the standalone `ProposalPageView` kept only as the
no-blocks fallback. Each caller passes a `renderAccept({ style, view })`
seam: the public page returns the interactive `ProposalAcceptActions`,
the composer preview returns `StaticAcceptCta`. `StaticAcceptCta` gained
a `style` prop so the preview honours the `action` block's button
colour / radius / wording. This closes the gap where a customised
banner / footer / Accept style previewed as the plain standalone layout
while the couple actually received the block tree. Both
`app/proposal/[token]/page.tsx` and
`components/builders/parts/proposal-preview-pane.tsx` consume it; the
preview reads the saved tree from `useCurrentBranding('proposal')`
(which already returned `blocks`). Supersedes the earlier
"Composer preview unchanged." note.

Branding editor clarity: the left rail header now reads **"Applies to
every document"** (the brand tokens flow into proposal / invoice /
contract / portal), and the canvas gets a matching **scope bar**
(`app/(dashboard)/branding/canvas-scope-bar.tsx`) reading
"<Surface> layout · blocks & wording for this document only", so the
global-vs-per-surface split is explicit. The fixed-core helper text now
names the sample couple / note / pricing as sample-only (the real ones
are set in the composer), and the single/multi control is prefixed
"Preview" so it reads as a preview toggle, not a saved setting.

## Branding editor redesign (2026-07-15)

The branding editor is now a Canva-grade design tool:

- **40+ curated Google fonts** in a unified FONT_IDS catalogue (usable for heading or body).
- **Full per-role type controls:** font, explicit px size, weight, colour, alignment, text case (UPPERCASE/Capitalize/none), letter-spacing, line-height.
- **Stylable proposal section labels:** `proposal_labels` entries are now `{ text, style }` (back-compat reader accepts old strings); each label (eyebrow, note, chooser, selected, add-ons, accept, decline) can be restyled on the canvas.
- **Per-surface block model:** each surface (proposal, invoice, contract, portal) has a gated set of available blocks. New blocks: Image (with fit/focal/height/padding/background) and Spacer (adjustable height). Every block exposes full Canva-style controls (padding per side, background, border, width, alignment, spacing).
- **Functional document templates:** Wedding proposal, Deposit invoice, Standard e-sign contract, Couple portal. Applying a template replaces only the current surface's block tree in one undoable step (not destructive to other surfaces or brand colours). Themes + Starter-designs removed.
- **Global styles section:** corner radius, link colour, default button style (variant/size/radius), base line-height, section spacing, page background. Density control removed (stored density is honoured on render).
- **Customer preview page:** `/branding/preview/[surface]` opens in a new tab, rendering the surface exactly as the customer sees it via the shared renderers.
- **Sidebar restructure:** "Your business" section moved to the top; colour roles gain role descriptions (Primary, Accent, Surface, Text, Muted, Secondary); redundant circular swatches dropped.

Migration `20260715000000_branding_editor_redesign.sql` extended `_user_branding` with the new fields (heading/body size, case, letter-spacing, line-height, link_color, button_variant/size/radius, section_spacing, page_background) and `proposal_labels` styling. All new styles resolve inside public renderers so editor preview = public page.
