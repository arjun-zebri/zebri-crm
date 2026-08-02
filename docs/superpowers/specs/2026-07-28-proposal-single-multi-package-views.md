# Proposal: multiple packages stack

> **OBSOLETE (2026-07-30):** superseded by the proposals removal
> ([docs/superpowers/specs/2026-07-30-remove-proposals-design.md](2026-07-30-remove-proposals-design.md)).
> Proposals were deleted in full; this spec is kept only so the history reads correctly.

Status: obsolete (was: implemented)
Date: 2026-07-28 (revised)
Owner: Arjun

> Revision note: an earlier draft of this spec proposed a compare-and-pick
> chooser for multi-package proposals plus a Single/Multi editor toggle. That
> UI was rejected as too heavy. This is the shipped design: multiple packages
> simply **stack**, each with its own Accept.

## 1. Problem

A proposal can offer one package or several. The block layout designs a single
package (`packageHeader/Details/Inclusions/Totals`). There was no good story for
several packages: a weak "See other packages" dropdown, then a rejected
comparison chooser.

## 2. Goal

Keep the proposal layout dead simple — the MC designs **one** package — and when
a real proposal offers several packages, render each one **in full, stacked top
to bottom**, each with its own **Accept**, and a single **Decline** at the
bottom. A note in the editor tells the MC this is what happens.

## 3. Decisions (locked)

- **Multiple packages stack; no chooser, no comparison.** Each package renders
  its full block set (header / details / inclusions / totals).
- **Accept per package.** Each stacked package ends with its own Accept button
  (two-step confirm), which accepts *that* package with *its* add-on selection.
- **One Decline at the bottom** of the stack (declining rejects the whole
  proposal), not repeated under every package.
- **Per-package add-on selection is local.** Each stacked package holds its own
  ticks so extras chosen on one package don't affect another.
- **View is automatic at send time by package count** (1 = one package, 2+ =
  stacked). No stored setting, no editor toggle, no schema change, no migration.
- **Editor gets a note, not a preview.** The MC designs one package; a line on
  the proposal layout bar explains stacking.

## 4. Model

### 4.1 The package stack (public render)

`ProposalBlocksRenderer` splits the tree:

- **Chrome** (business name, notes, footer, dividers, images) renders once, in
  place, via the generic `PublicBlockRenderer`.
- **The package region** (the four package blocks) **and the action block** are
  owned by the stack, rendered once at the position of the first package block:
  - For each option, a `StackedPackage` renders the four package blocks bound to
    that option (its own `ProposalBlockProvider` with `chosenId = option.id` and
    a **local** add-on selection), followed by that package's Accept.
  - Packages after the first get a hairline divider above them.
  - A single Decline renders once, after the stack, while the proposal is active.

The action block is never rendered on its own — it only supplies the Accept /
Decline button colour, radius, and labels.

### 4.2 Accept / Decline wiring

The public proposal page owns the accept UI (`ProposalAcceptActions`, which
gained `hideDecline` / `hideAccept`):

- `renderPackageAccept({ option, selection, style })` → an Accept for that
  package (`hideDecline`), wired to `accept_proposal(option.id, selection)` with
  the package's live local selection.
- `renderDecline({ style })` → the single bottom Decline (`hideAccept`), wired to
  `decline_proposal`.

`handleAccept(optionId, selection)` is shared by the stack (per package) and the
standalone fallback (its one Accept passes the chosen option). Accepted proposals
pin to `accepted_option_id` + `accepted_addon_selection`, so the accepted view
renders only that package, read-only, with no Accept/Decline.

### 4.3 Editor note

A proposal-only line on the layout scope bar:

> "Design one package here. If a proposal offers several packages, each one
> stacks below the other on the sent proposal, each with its own Accept."

No toggle, no multi preview — the canvas keeps showing the single-package
template with `{{ … }}` chips.

## 5. What changed

- `components/proposal/proposal-blocks-renderer.tsx` — rewritten to stack a
  package per option (`PackageStack` / `StackedPackage`), each with local
  selection + per-package Accept; chrome renders once; one bottom Decline.
- `app/proposal/[token]/_components/proposal-accept-actions.tsx` — `hideDecline`
  / `hideAccept`.
- `app/proposal/[token]/page.tsx` — `handleAccept(optionId, selection)`;
  `renderPackageAccept` + `renderDecline`; passes `acceptedOptionId` /
  `acceptedSelection`.
- `components/proposal/proposal-document-body.tsx` — threads the new stacking
  props to the block path; the standalone fallback is unchanged.
- `app/(dashboard)/branding/canvas-scope-bar.tsx` — the proposal note.
- `components/proposal/package-header.tsx` — the "See other packages" dropdown
  removed (single-package only).

Removed vs the rejected draft: the comparison chooser, the Single/Multi editor
toggle, and `ProposalMultiPreview`.

## 6. Testing

- Unit (`proposal-blocks-renderer.test.tsx`): single option → one package +
  Accept + Decline; multiple → each package stacked with its own Accept and one
  shared Decline; add-ons toggle independently per package; accepted state shows
  only the accepted package with no CTA; empty options render nothing.
- The standalone fallback path is untouched; existing e2e (single-option accept)
  still holds.
