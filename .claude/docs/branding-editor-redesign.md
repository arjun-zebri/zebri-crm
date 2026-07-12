# Branding Editor Redesign — Design Spec (2026-07-12)

## Context

The `/branding` editor is a block-tree designer for the four
customer-facing surfaces (proposal, invoice, contract, portal). It works
but is not yet a real design tool: the left rail is cluttered, headings
are re-wordable but not restylable, there are only ~12/7 fonts, spacing
is a coarse global "density", the same block set shows on every surface,
and "Preview" is a stub toast. This redesign turns the editor into a
Canva-grade tool: fully customisable per-block styling, a real typography
system, per-surface block sets, functional starter templates, and a live
customer preview.

Delivered as **one change** (reviewed as a whole), built in internal
commits. All brand styling stays **global per MC** (one brand kit flows
into proposal/invoice/contract/portal); block layout + wording stay
**per surface**. This preserves the model clarified in
`.claude/docs/proposals.md` ("Preview parity + surface-scope clarity").

## Goals

- Every heading + text element is fully stylable: font, size (explicit
  px), weight, colour, alignment, case (UPPERCASE/Capitalize/none),
  letter-spacing, line-height, italic/underline.
- 30+ curated Google fonts, usable for heading or body.
- Per-block padding + a full per-block control set, tuned per block type.
- Block availability differs by surface.
- Functional document templates replace Themes + Starter designs.
- A real customer preview that opens in a new tab.
- A calmer, better-ordered sidebar with business info at the top and
  labelled colour roles.
- Remove the low-value density control.

## Non-goals

- Per-proposal / per-document branding overrides (branding stays global).
- Changing the accepted split-at-marker public rendering model.
- Rich-text inside blocks beyond the existing inline editing + TextStyle.

## 1. Sidebar restructure

`brand-panel.tsx` sections, top to bottom (collapsible accordions,
matching the existing calm style, no boxes-in-boxes):

1. **Your business** (new top position) — logo, business name, tagline,
   ABN, phone, website, Instagram/Facebook, favicon. (Moved up from the
   old bottom "Business info" section.)
2. **Brand colours** — the palette selector only; the 4 circular preset
   swatches are removed (redundant with the palette). Each colour row
   carries a one-line role description:
   - Primary — headings, buttons and key accents
   - Accent — highlights (e.g. the "most popular" badge)
   - Surface — the page background
   - Text — body copy
   - Muted — secondary/subtle text
   - Secondary + Secondary text — the priced-summary panel
3. **Typography** — §2.
4. **Global styles** — corner radius, link colour, default button style,
   base line-height + section spacing, page background. Density removed.
5. **Templates** — §4.

The rail header keeps "Applies to every document" (global reach). The
canvas keeps the per-surface scope bar.

## 2. Typography system

**Fonts.** Expand `lib/branding/fonts.ts` to a single curated list of
**30+ Google fonts**, each usable as heading or body (the MC picks per
role). Each entry defines its label, CSS stack, and Google Fonts family
(with weight axis). The font dropdown previews each option in its own
face. `HeadingFont`/`BodyFont` become one `FontId` union (kept
back-compatible: every current id stays valid).

**Global type defaults** (new `user_metadata` fields), split heading vs
body: font, **base size in px**, weight, colour, alignment, case,
letter-spacing, line-height. `font_scale` is retained as an optional
global multiplier layered on the px sizes (so existing saved scales keep
working), but the primary control is now explicit px.

**TextStyle** (`blocks/text-style.ts` + `types.ts`) gains
`textTransform?: 'none' | 'uppercase' | 'capitalize'`. Every text-bearing
element resolves its effective style as: global type default → block
TextStyle override → inline.

**Fixed-core headings become stylable.** Today the proposal-core section
labels (eyebrow, note, chooser, selected, add-ons, accept, decline) are
plain strings in `proposal_labels` and render with hard-coded classes.
They upgrade to `{ text: string; style?: TextStyle }` so each label can be
restyled (font/size/weight/colour/align/case) directly on the canvas,
not just reworded. `resolveProposalLabels` + `EditableLabel` +
`ProposalPageView` thread the style through; `_user_branding` returns the
new shape. A back-compat reader accepts the old string form.

## 3. Per-block, per-surface model

**Per-surface block availability.** A `BLOCKS_BY_SURFACE` map gates which
block types the Add-block palette offers and which `defaultBlocksFor`
seeds. Fixed cores in **bold**:

| Block | Proposal | Invoice | Contract | Portal |
|---|:--:|:--:|:--:|:--:|
| Header banner | ✓ | ✓ | ✓ | ✓ |
| Business name | ✓ | ✓ | ✓ | ✓ |
| Tagline | ✓ | ✓ | ✓ | ✓ |
| Text | ✓ | ✓ | ✓ | ✓ |
| Image (new) | ✓ | ✓ | ✓ | ✓ |
| Spacer (new) | ✓ | ✓ | ✓ | ✓ |
| Divider | ✓ | ✓ | ✓ | ✓ |
| Footer | ✓ | ✓ | ✓ | ✓ |
| Title & meta | – | ✓ | ✓ | – |
| Line items | – | ✓ | – | – |
| Totals | – | ✓ | – | – |
| Payment details | – | ✓ | – | – |
| Action | ✓ | ✓ | ✓ | – |
| **Proposal core** | ✓ | – | – | – |
| **Payment schedule** | – | ✓ | – | – |
| **Contract body** | – | – | ✓ | – |
| **Couple portal** | – | – | – | ✓ |

**New blocks.** `image` (uploaded image with fit/focal/rounding/width)
and `spacer` (adjustable vertical gap) for Canva-parity.

**Per-block control catalogue.** Every block (via `BaseBlock` + toolbar):
- Padding per side (top/right/bottom/left).
- Background colour.
- Border: width, colour, radius.
- Block width + horizontal alignment within the column.
- Space above/below.
- Show/hide, drag-resize height (existing), vertical align (existing).

Text-bearing blocks additionally expose the full §2 text controls.
Type-specific extras stay/extend: header banner (image, fit, focal/zoom,
height, overlay colour+opacity, rounding); business name (layout, logo
size, alignment); action (fill/outline, size, radius, alignment,
secondary button); divider (thickness, colour, style, width); line
items/totals (row style, emphasis, columns). Each block type is audited
on each surface it appears on and brought up to this bar.

## 4. Functional document templates

Replace Themes + Starter designs (both removed, incl.
`starter-designs.ts`, the Themes accordion, and their apply paths).

A **functional template** is a ready-made, fully laid-out starting
document for one surface: the right blocks in order with sensible starter
wording for that job (e.g. *Wedding proposal*, *Deposit invoice*,
*Standard e-sign contract*, *Couple portal*). Stored as data in
`app/(dashboard)/branding/templates/` (block trees built from
`defaultBlocksFor` + explicit content). Applying one replaces the current
surface's block tree in a single undoable step and shows a toast. It does
**not** touch other surfaces or global tokens (unlike the old
theme/kit apply), so it is surface-scoped and non-destructive to brand
colours/fonts.

## 5. Customer preview

The topbar Preview action opens a **new browser tab** at a preview route
(e.g. `/branding/preview/[surface]`) that renders the surface exactly as
the customer sees it — the shared `ProposalDocumentBody` / public block
renderers, fed by the MC's saved branding (`useCurrentBranding`) + realistic
sample data. Read-only, no accept/pay handlers. Reuses the same renderers
the public pages use so the preview can't drift.

## 6. Data model + migration

**New `user_metadata` fields** (scalar, JWT-safe): heading/body base
size, case, letter-spacing, line-height (per role); `link_color`;
button-style defaults (`button_variant`, `button_size`, `button_radius`);
`section_spacing`; `page_background` (colour + optional texture id).

**Changed:** `proposal_labels` entries become `{ text, style }`
(back-compat reader for old strings). **Removed:** `density` usage —
`DENSITY_PAD` collapses to a single fixed "cozy" baseline so live
documents don't shift; the field is ignored on read.

**Migration** (CI `supabase db push`): extend `_user_branding(uuid)` +
`get_public_{proposal,invoice,contract}` + `get_portal_data` to return
the new fields and the styled `proposal_labels`. Additive and
back-compatible; no destructive SQL. `buildPublicBranding` +
`PublicBranding` + `viewBranding` extended in lockstep.

## 7. Rendering impact

Public surfaces and the composer preview already share renderers
(`ProposalDocumentBody`, `PublicBlockRenderer`, `ProposalPageView`,
`lib/branding/public-blocks/*`). All new styles resolve inside those, so
editor preview = composer preview = public page. New blocks (image,
spacer) get `public-blocks/*` renderers + editor `render.tsx` renderers.

## 8. Testing

- Unit: font-list integrity, `resolveProposalLabels` back-compat (old
  string ↔ new `{text,style}`), `BLOCKS_BY_SURFACE` gating, density→
  baseline migration, TextStyle `textTransform` resolution, template
  block trees valid per surface.
- Integration: public RPCs return the new branding fields; RLS unchanged.
- E2E (Pixel 5 + iPhone 12 + desktop): edit a heading's font/size/case
  on a surface; add an image block; apply a functional template; open the
  customer preview tab.
- Gates: `typecheck` 0, strict + lint budgets not regressed (ratchet down
  where new code lets us), full pyramid green.

## 9. Rollout

Built in internal commits on `feature/proposals-phase-a`, reviewed as one
change, shipped through `staging` per the current batch policy. Docs
updated in the same change: this spec, `proposals.md`, `page-specs.md`,
`database-schema.md`, `frontend-design.md`/`component-library.md`.

## 10. Risks

- **Scope**: large surface area; mitigated by shared renderers + a fixed
  per-block control contract audited block-by-block.
- **proposal_labels schema change**: mitigated by a back-compat reader +
  unit tests pinning both shapes.
- **Density removal shifting live docs**: mitigated by migrating to the
  current default baseline (cozy), the most common value.
- **30 fonts payload**: fonts load per-surface on demand
  (`googleFontsHref`) as today; only chosen fonts are fetched, so the list
  size does not bloat the customer page.
