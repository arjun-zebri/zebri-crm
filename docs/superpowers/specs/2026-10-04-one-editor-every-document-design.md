# One editor for every document

**Status:** building in the `/design-system/v2` preview first (founder,
2026-10-04): demo data in the account context, no RPCs or migrations.
The production wiring named below follows once the preview is judged.
**Date:** 2026-10-04
**Superseded in part (2026-10-09):** the two media (§2: web sections vs
free-form A4 paper) are replaced by one stack for every document, read
as a web page and printed from it; the scope switch is replaced by "the
place decides" (brand panel = everywhere, a picked element = this
document). The engine lives in
`app/design-system/v2/pages/dashboard/doc-builder/`; plan in
`~/.claude/plans/we-need-to-start-compiled-shannon.md`.
**Supersedes, in part:** the free-form canvas built 2026-10-03 in
`app/design-system/v2/pages/dashboard/canvas/` (see §8).
**Builds on:** `2026-09-12-proposals-engine-design.md`,
`2026-09-16-proposal-layout-v2-design.md`,
`2026-09-20-proposals-completion-roadmap-design.md` (R3 is the missing
production piece this spec depends on).

## 0. Why

Zebri sends seven kinds of document on an MC's behalf: proposals,
contracts, invoices, questionnaires, emails, run sheets and ceremony
scripts. Today each has its own editor and its own idea of branding.
The production proposal builder (`features/proposals/`) can compose a
rich page (video, tables, packages, accept) but styles it through
stacked popovers. The v2 canvas can style anything but cannot compose,
and does not know that a proposal becomes a contract becomes an invoice.

The founder's brief: production's composing power, the canvas's
styling, a premium feel, and incredible ease of use. The couple reads
on a phone; the MC is not a designer.

## 1. Principles

1. **Premium by default, flexible second.** A document with zero
   styling must look better than what most MCs would make. Styling is
   optional, never a step.
2. **Design is the look, a template is the words.** One look per kind
   of document. Templates vary content, never brand.
3. **The booking is the link.** A couple, a package and a payment
   schedule connect documents. Any document can be the first one.
4. **Records are frozen.** What was sent, signed or issued never
   changes under the couple's feet.
5. **Nothing silent.** Every save, failure and freeze is visible.

## 2. The editor

### 2.1 Two layers

**Content** is a vertical stack of sections, exactly production's model:
`features/proposals/model/layout.ts` section kinds (`content`,
`packages`, `gallery`, `video`, `testimonials`, `faq`, `accept`,
`pageBreak`), rich text per `model/rich-doc-spec.ts` (21 node types:
image, table, embed, audio, button, columns, variable with fallback,
and so on), packages per `model/packages.ts`. Nothing in the content
model changes.

**Style** is the canvas work: the brand kit (§3), one floating
toolbar that appears over whatever is clicked, and a scope switch
("This one" or "All headings") on every text change.

### 2.2 Two media

| Medium | Kinds | Layout | Why |
|---|---|---|---|
| **Web page** | proposal, email, questionnaire | Sections flow top to bottom; widths, columns and alignment, never absolute position | Read on phones; must reflow |
| **Paper** | invoice, contract, run sheet, ceremony script | A fixed A4 page; elements can be moved and resized freely; required parts are locked | Printed and attached as PDF; a page is a page |

Paper kinds keep the 2026-10-03 canvas engine (`canvas/model.ts`,
`use-canvas.ts`, `page-view.tsx`, `toolbar/`) and the per-kind layouts
in `canvas/docs/*`. Web kinds use production's section canvas
(`features/proposals/editor/`) with the new style layer on top.

### 2.3 Anatomy

```
┌ Top bar: title · Preview (phone / desktop) · primary action (Send to Sarah / Done) ┐
│ Rail │                                                                             │
│ Add  │        ┌──────── floating toolbar, over what is picked ────────┐           │
│ Media│        │ Heading ▾  Italiana ▾  44  A  B I U  ≡  spacing  ⋯  │ This one | All headings │
│ Data │        └──────────────────────────────────────────────────────┘           │
│ Brand│   ╔════════ section (web) or page (paper) ═════════╗  +                   │
└──────┴───────────────────────────────────────────────────────────────────────────┘
```

- **Rail.** Add (sections and nodes, browsable; `/` stays for keyboard
  users), Media (uploads, brand photos, video by URL), Data (merge
  fields with their current value), Brand (kit colours, logos, Edit
  brand kit). Folds away; on a phone it opens over the page.
- **Floating toolbar.** One bar, same place, showing only what applies
  to the pick: text tools for text, fill/outline/corners/shadow for
  shapes and pictures, background colour/image/video/overlay/height/
  padding for a section, borders and stripes for a table, the house
  style for a button, arrange and delete at the end. The production
  text bar, node bars and section toolbar collapse into it. A
  "Reset to brand" item appears whenever the pick carries an override.
- **Top bar.** Title, Preview, one primary action. Undo and redo live
  on the keyboard and in the Edit menu, not as buttons (founder ruling
  2026-09-18).

### 2.4 Composing a proposal

- **Never a blank page.** New proposal: pick the couple, pick a starter
  (`model/starters.ts`), open with their names, date, venue and your
  packages filled in.
- `/` in any text section inserts anything production supports today.
  `+` between sections adds a section. Drag to reorder.
- Sections and nodes are edited in place. Data sections (packages,
  FAQ, testimonials, accept) keep production's in-place editors
  (`editor/data/*`).

## 3. Brand kit and designs

### 3.1 The kit

One brand kit per account, opened from the sidebar name card and from
the editor's Brand tab. It holds logos (main, mark, on dark), named
palettes (Brand and Neutrals to start, more by hand), the four text
styles (heading, subheading, body, caption: face, size, weight, line
and letter spacing, case), house style (button shape, corner radius)
and brand photos. There is no branding page or tab.

The kit is the single source production's `branding` row becomes
(§7.3). `features/proposals/model/theme.ts` (`ProposalTheme`, four
`ThemeTextRole`s) is seeded from the kit and stays per-proposal only
for what the kit does not express (section gap, animation, page
background).

### 3.2 One design per kind

Each kind of document has exactly one design: the look every document
of that kind wears. For paper kinds the design is the whole layout
(where the logo sits, what the totals look like). For web kinds the
design is the kit plus section style defaults; the words come from
templates and starters. There is no templates list for paper kinds.
Two differently branded sets of invoices is out of scope (§9).

### 3.3 Propagation rules

| Document state | A kit or design change… |
|---|---|
| Template, starter, draft | applies at once |
| Proposal sent, not yet accepted | applies on the couple's next load (the proposal is live) |
| Proposal accepted or declined | never applies; frozen |
| Contract sent | never; frozen at send (today's `locked_content_html`) |
| Invoice issued | never; frozen at issue. A wrong invoice is reissued with a new number and a trail, as the Tax Office expects |
| Email sent, questionnaire sent | never; frozen at send |
| Run sheet, script shared | frozen per shared version; the MC's working copy stays live |

Freezing means a rendered snapshot (HTML plus the resolved kit values)
stored with the document, the pattern `publishContractSnapshot` uses,
extended to every kind. The public page renders the snapshot, never the
live design.

"This one" overrides persist through kit changes: a heading made gold
takes the new face but stays gold. Every override is reversible with
Reset to brand on the toolbar.

Locked fields (business name, ABN, bank details) read live from the
account into drafts and freeze with the document.

## 4. The booking is the link

### 4.1 The model

A **booking** is a couple, a chosen package (with add-ons and weekend
loading) and a payment schedule. Production already has its pieces:
`proposals.accepted_option_id`, `proposals.payment_schedule_id`,
`proposals.deposit_percent`, `proposals.contract_id`,
`proposals.invoice_id`, `invoices.proposal_id`, and the acceptance
chain (`accept_proposal` → `publishContractSnapshot` → couple signs →
`lib/contracts/after-sign.ts` → `finalize_proposal_acceptance` writes the
invoice, its lines via `lib/proposals/invoice-payload.ts`, and its
stages). What is new is that the chain can start anywhere.

### 4.2 Entry points

| First document | What it asks | What follows |
|---|---|---|
| Proposal | couple, starter | accept → contract → invoices, automatic |
| Contract, no proposal | couple, package, schedule | signing creates the invoices from the schedule |
| Invoice, nothing else | couple, package or one-off amount | stands alone; a contract can be added to the booking later |

"For whom, which package" is one small step at the top of New contract
and New invoice; it defaults to the couple's accepted proposal when
there is one, and to a suggestion from a declined one.

### 4.3 The Accept section is the money hub

On a proposal the Accept section's toolbar settings hold "what happens
when they say yes": the contract template (default: yours), the
payment schedule (deposit now and balance 14 days before, or a saved
schedule), and the deposit percent. Preview shows the couple's Choose →
Sign → Pay flow and the invoice they will get, in the invoice design.

### 4.4 Edge cases

| Case | Rule |
|---|---|
| MC never sends proposals | contracts and invoices work from the booking alone |
| Invoice only, no contract | allowed; the client shows "No contract" |
| Proposal declined, couple books anyway | New contract or invoice offers the declined package as a suggestion |
| Package changes after acceptance | editing the booking reissues unpaid invoices; paid ones stay as history |
| Deposit paid before the contract is signed | allowed; the booking shows the gap |
| Two proposals to one couple | the accepted one is the booking; the other is marked superseded |
| Couple accepts, then MC edits the proposal | refused; the accepted proposal is frozen (§3.3). Revert to draft stays the explicit way out, and says the couple's link will change |

### 4.5 What production lacks

- **R3** of the completion roadmap: creating a proposal from a template
  onto the v2 layout, so couples get the new page rather than the v1
  block tree.
- New contract and New invoice asking "for whom, which package" and
  writing the booking fields without a proposal.
- Snapshots for kinds that have none today (invoice, email,
  questionnaire, run sheet, script).

## 5. Guardrails and the reader

- **Phone first.** Every web section reflows at 390px; Preview opens
  on the phone frame by default. Columns stack; tables scroll; "Hide on
  phone" stays per node.
- **PDF parity.** A paper design renders to PDF from the same layout
  and the same fonts (embedded). What the MC sees at 100% is the PDF.
- **Email honesty.** Gmail and Outlook do not load brand fonts. The
  email design shows its fallback face in the editor, labelled, and
  limits itself to what email clients render (no video, no columns
  beyond two).
- **Contrast and size.** Light text on a pale fill, or body text under
  12px, gets a quiet warning on the toolbar, never a block.
- **Locked parts.** Tax invoice wording, ABN, number and dates, billed
  to, lines, totals with GST, how to pay; a contract's parties, terms,
  clauses and signatures; a run sheet's timeline; a questionnaire's
  questions; an email's footer and unsubscribe (Spam Act). They move
  and restyle, never delete, never typed over.
- **Left out of Canva on purpose:** free-form placement on web pages,
  animations beyond production's section reveal, stickers and
  clip-art, hundreds of fonts (the curated catalogue in
  `lib/branding/fonts.ts` stays), per-letter styling.

## 6. Failure modes

- Autosave with a visible state (Saved, Saving, Save failed with Retry)
  and one undo history per document, for every kind.
- Two tabs on one document: last write wins with a banner on the loser
  ("Changed in another tab. Reload or keep mine").
- A failed upload leaves no broken node; the insert is rolled back and
  named.
- A brand font that fails to load falls back to the catalogue's stack;
  the kit shows a warning next to the face.
- Escape, a closed tab or a backdrop click never loses work: the last
  edit is flushed before the editor unmounts; a tab close inside the
  autosave debounce is the one known gap (roadmap follow-up) and is
  covered by a `beforeunload` prompt until a beacon path exists.

## 7. Tiering, limits, migration

### 7.1 Tiering

Brand kit, starters, the editor and one design per kind for every
plan. Higher plans: custom font upload, removing "Sent with Zebri",
video upload (URL embeds for all), larger storage. Exact plan lines
are a billing decision outside this spec.

### 7.2 Limits

Production's layout limits stand (40 sections, 200 nodes, 2 MB per
layout; 50 MB per video upload, `proposal-media` bucket). Brand photos
and uploads count against a per-plan storage cap shown in the kit.

### 7.3 Migration

- Production `branding` (`lib/branding/public-branding.ts` fields:
  `brand_color`, `accent_color`, `heading_*`, `subheading_*`,
  `text_color`, `muted_color`, `logo_url`, `favicon_url`, `abn`, bank
  fields, socials) maps onto the kit automatically: colours into the
  Brand and Neutrals palettes, the heading and subheading settings
  into text styles, logo and favicon into logos, contact fields stay
  on the account. No MC sets anything up again.
- Existing proposal templates keep their layouts; their `ProposalTheme`
  is re-seeded from the kit once, with the MC's per-template settings
  kept as overrides.
- v1 proposals already sent keep rendering through the v1 renderer
  until R5 burns it down.
- The default designs for paper kinds reproduce today's
  `InvoicePreview`, `ContractPreview` and `RunSheetPage` layouts, so
  nothing an MC has sent looks different the day after.

## 8. From the 2026-10-03 canvas

**Kept:** brand kit (`brand/kit.ts`, `brand-kit-dialog.tsx`,
`kit-*.tsx`), floating toolbar and style writer (`canvas/toolbar/`),
"This one / All like it" scope, locked parts, paper layouts
(`canvas/docs/invoice.tsx`, `contract.tsx`, `night.tsx`), the
`Designed` renderer for paper kinds, primitives `Slider`,
`CornerRemove`, `RailTab`, `AddTile`.

**Retired:** free-form pages for proposal, email and questionnaire
(`canvas/docs/proposal.tsx`, `email.tsx`, `questionnaire.tsx`); the
per-kind `design-store.ts` for web kinds, replaced by production's
templates and theme; the playground route once the editor lives in the
real surfaces.

**Reworked:** the rail's Add tab inserts sections and nodes, not shapes
and frames, on web kinds; the Design tab lists pages only for paper
kinds.

## 9. Out of scope

Multiple brand kits (a second trading name), teams and permissions on
the kit, per-section analytics (R4), a public template marketplace,
per-letter rich styling, free-form layout on any web document.

## 10. Open questions

1. **Run sheet and script freezing.** Shared with suppliers as a PDF,
   or as a live link that follows the MC's edits? The table in §3.3
   assumes a frozen version per share.
2. **Reissuing an invoice.** Credit note plus new invoice (bookkeeping
   convention) or a new version under the same number (simpler for
   the couple)? Affects Payments and the Xero gap noted elsewhere.
3. **Where the "for whom, which package" step lives for an invoice
   with no package** (a one-off: travel, an extra hour). A free line on
   the booking, or an invoice outside any booking?
4. **Email design on web or paper rules.** Email is treated as a web
   kind here; its narrow fixed width (600px) and client limits make it
   a third medium in practice. Confirm one design per kind is enough
   for transactional emails plus newsletters.
5. **Plan lines for §7.1.**
6. **The brand kit in Blocks.** An earlier ruling asked for the brand
   kit to be top level and added as a Block. This spec makes it always
   present (name card, editor Brand tab). Keep a Blocks entry as the
   doorway for discovery, or drop it?
