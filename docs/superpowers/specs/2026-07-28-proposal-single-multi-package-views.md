# Proposal: single vs multi-package views

Status: draft for review
Date: 2026-07-28
Owner: Arjun

## 1. Problem

A proposal can offer one package or several. The block-based proposal layout
only handles one package well: `packageHeader/Details/Inclusions/Totals` render
a single chosen package, and multiple packages are bolted on as a weak "See
other packages" text dropdown inside `packageHeader`. There is no way for the
MC to design or preview how a multi-package proposal looks, and the comparison
experience the couple gets is poor.

Meanwhile the older standalone path (`ProposalPageView`) already has a polished
multi-package experience — `ProposalOptionChooser` (comparison cards) →
`ProposalSelection` (the chosen package's add-ons + live total) → Accept — but
the block path does not use it.

## 2. Goal

Give the proposal layout two presentations, both designable and previewable in
the branding editor:

- **Single view** — the current package blocks, rendering one package.
- **Multi view** — a fixed compare-and-pick structure the MC styles at the
  presentation level (card type styles, colours/borders/tint, the "most
  popular" treatment, which fields show). The couple compares packages, taps
  one, its add-ons + running total appear, then Accepts.

The MC toggles between the two in the editor to design/preview each. At send
time the view is chosen automatically by the number of packages — no per-
proposal setting.

## 3. Decisions (locked)

- **Multi flow = compare → pick → confirm-with-add-ons → Accept.** Reason:
  keeps the comparison clean and scannable (drives the choice), defers add-on
  complexity to the one chosen package (keeps cards light on mobile), preserves
  the add-on upsell, and is the smaller build (reuses existing components).
- **Multi is fixed structure, presentation-only customisation.** Not an
  arrangeable per-card block canvas. Styling flows from the existing global
  branding roles + editable proposal labels, exactly as the standalone chooser/
  selection already do.
- **View is automatic at send time by package count** (1 → single, 2+ → multi).
  The editor toggle is a design/preview switch only; there is no stored per-
  document mode.
- **Reuse, do not reinvent.** Multi view = `ProposalOptionChooser` +
  `ProposalSelection` (the standalone components), already branding-driven and
  already shared across surfaces.

## 4. Model

### 4.1 The swappable "package region"

The proposal block tree keeps its chrome blocks (businessName, text, footer,
action, dividers, etc.) exactly as arranged. Only the **package region** — the
contiguous `packageHeader/Details/Inclusions/Totals` blocks — is presentation-
switched:

- **1 option:** render the four package blocks in place, as today.
- **2+ options:** render `ProposalOptionChooser` + `ProposalSelection` in place
  of the four package blocks.

Everything around the region (business name, notes, footer, the Accept/Decline
action block) renders identically in both views, so the MC's chrome design and
the action-block wording ("Accept" / "Decline") always apply.

`ProposalBlocksRenderer` gains this branch: when `options.length > 1`, it emits
the chooser + selection for the package region and skips the individual package
blocks; otherwise it emits the package blocks unchanged. The weak "See other
packages" dropdown in `packageHeader` is removed (single view is one option, so
it never applied anyway).

### 4.2 Editor toggle

A **Single / Multi** segmented control on the proposal layout scope bar (next
to "Reset layout" / "Clear all blocks"), shown only on the proposal surface.
It is local editor preview state — not persisted, not a block field.

- **Single (default):** the editable drag-and-drop block canvas, exactly as
  today. The package region previews the four package blocks with
  `variablePreview` chips (`{{ Package name }}`, etc.), one package.
- **Multi:** because the multi structure is fixed (nothing to arrange), the
  canvas swaps the drag-and-drop editor for a **live preview**
  (`ProposalMultiPreview`): the same block tree rendered with the existing
  `PROPOSAL_SAMPLE_MULTI` sample options (three distinct named packages), so the
  compare-and-pick region appears as a couple would see it. Branding applies
  live; the multi-only wording labels (`choose`, `selected`, `addOns`, `accept`)
  are editable inline via `onEditLabel`, which is where they are edited (they do
  not appear in single view). Sample data, not chips, because a comparison of
  three identical `{{ Package name }}` cards would be meaningless; the sent
  document uses the couple's real packages. The MC edits blocks + arranges the
  layout in Single mode; Multi is design-by-preview.

### 4.3 Send-time rendering

`ProposalDocumentBody` / the public proposal page already have `options`. The
render path chooses the package-region presentation by `options.length`:

- 1 → package blocks (single).
- 2+ → chooser + selection (multi).

No new payload fields, no migration, no stored mode.

### 4.4 Customisation surface (multi)

Presentation-level only, via controls that already exist:

- Global branding type roles (heading/body/section styles, colours, fonts).
- Editable proposal labels (`choose`, `chooseHint`, `selected`, `addOns`,
  `addOnsHint`, `accept`, `decline`) — the chooser/selection already read these
  via `EditableLabel`.
- The "most popular" treatment (brand-tinted card + badge) is built into
  `ProposalOptionChooser`.

No new per-block style overrides for the multi view in this phase. If per-card
overrides are wanted later, that is a follow-up.

## 5. What changes

- `components/proposal/proposal-blocks-renderer.tsx` — branch the package region
  on `options.length`; render chooser + selection for multi, package blocks for
  single. Keep chrome + action delegation.
- `components/proposal/package-header.tsx` — remove the "See other packages"
  dropdown (superseded by the chooser). Keep the single-package title.
- `app/(dashboard)/branding/` — add the Single/Multi preview toggle to the
  proposal scope bar; thread the preview mode into the proposal preview render
  so the editor canvas shows the selected view.
- Editor proposal preview — when Multi, render `ProposalOptionChooser` +
  `ProposalSelection` with `PROPOSAL_SAMPLE_MULTI`; when Single, the package
  blocks with chips (as now).
- No schema changes. No new block types. No migration.

## 6. Testing + Definition of Done

- Unit: renderer emits chooser+selection for 2+ options and package blocks for
  1 option; editor toggle switches the preview; single-option proposals never
  show a chooser.
- Integration: send-time render of a real multi-option proposal shows the
  comparison + selection; single-option shows the blocks. Cross-tenant RLS
  unaffected (no new owned tables/columns).
- E2E (Playwright): multi-option proposal — compare cards, pick one, its add-ons
  appear, adjust, Accept; single-option — one package, Accept. Desktop + mobile.
- No `any`; generated DB types. Design-system compliant. Loading/empty/error
  unaffected. Docs updated (`.claude/docs/page-specs.md` proposal section).

## 7. Risks / open questions

- **Two chrome sources.** The chooser/selection were built for the standalone
  layout; embedding them inside the block tree's chrome must not double up
  business name / footer / accept. Mitigation: the block tree owns chrome; the
  chooser+selection render only the package region (no eyebrow/notes/footer/
  accept — those come from blocks). Confirm `ProposalSelection` can render
  without its own accept/footer (it already supports a `core`-style mode).
- **Accept wiring.** In multi, Accept still comes from the block tree's action
  block (`renderAccept`), driven by the chosen option + selection. Verify the
  chosen-option/selection state flows to the action the same way it does today.
- **Editor preview data.** Multi preview uses sample options; ensure the toggle
  doesn't leak sample data into the saved document (it is render-only state).
