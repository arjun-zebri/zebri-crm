# Contract block model — coherence pass

**Date:** 2026-08-02
**Surface:** Branding editor → Contract document surface
**Status:** Approved design, pre-implementation

## Problem

The branding editor's contract surface is assembled from three block
types, two of which are generic quote/invoice blocks relabeled for
contracts. The result is incoherent for a contract:

1. **Contract header** is the shared `title` block. Its template
   hard-codes `showRef: true` and `showExpires: true`
   (`app/(dashboard)/branding/blocks/defaults.ts:45-54`). "Expires"
   is quote/invoice semantics — a contract is signed, it does not
   expire.
2. **Sign contract** is the shared `action` block. Its defaults are
   payment-shaped for every surface: `actionDefaults()` returns
   `{ primary: 'Pay now', secondary: null }`
   (`defaults.ts:33-35`), with a `CreditCard` palette icon and an
   `'Accept / Decline / Pay'` description (`types.ts:431`,
   `add-block-palette.tsx:21`). So adding "Sign contract" to a
   contract inserts a **Pay now** button.
3. **Crucially, the action block renders nothing on a real sent
   contract.** The public card passes `hideAction` to every block
   renderer (`app/contract/[token]/_components/contract-branded-card.tsx:83,114`)
   and the actual sign/decline form is always injected separately as
   `bodyTrailing` (`contract-branded-card.tsx:96`). Yet `action` is
   in the contract *required* set (`policy.ts` `REQUIRED_BY_SURFACE`),
   so the top-right "Not ready to send" warning nags the MC to add a
   block that then draws nothing.
4. The **contract body** placeholder in the editor
   (`RenderContractBody`, `render.tsx:1066-1131`) renders a heavy
   dashed "Locked" box with fake sample clauses ("1. Definitions and
   interpretation", a sample event date, etc.). This mock is
   redundant now that (a) the per-block **Required** badge
   (`block-toolbar.tsx`) and (b) the top-right `NotReadyPanel`
   already communicate the locked/required status.

## Goal

A contract surface that reads coherently:

- **Contract header** (`title`) — logo / business / couple / date
  chrome, with contract-appropriate field defaults.
- **Contract body** (`contractBody`) — the per-couple clauses,
  injected on the public page; a slim, honest placeholder in the
  editor.
- **Signature** — always auto-injected on the public page; not a
  block the MC manages.

## Design

### 1. Remove the Sign contract (action) block from the contract surface

The signature UI is always injected, so a contract has no use for a
manageable action block.

- `app/(dashboard)/branding/blocks/blocks-by-surface.ts:21` →
  `contract: ['title', 'contractBody']` (drop `'action'`).
- `app/(dashboard)/branding/blocks/policy.ts` →
  `REQUIRED_BY_SURFACE.contract = ['title', 'contractBody']` (drop
  `'action'`).
- `app/(dashboard)/branding/blocks/types.ts:407-409` → remove the
  `action: 'Sign contract'` relabel under `contract`; keep
  `title: 'Contract header'`.
- **No change** to the `action` block for invoices — `'Pay now'`, the
  credit-card icon, and the `'Accept / Decline / Pay'` description are
  all correct there.
- **Legacy data:** contract `branding_blocks` trees that already
  contain an `action` block continue to render nothing on the public
  page (`hideAction` already suppresses it). The block simply stops
  being addable from the palette and stops being demanded by the
  readiness check. No migration required. The editor must tolerate an
  existing `action` block in a loaded contract tree without error
  (it may still appear in the editor preview; that is acceptable and
  rare since `action` was never in the default contract tree).

### 2. Contract header (title) — contract-correct defaults, default-present, required

- Make `blockTemplate` surface-aware so a `title` block created on a
  contract defaults to:
  `{ showCoupleName: true, showRef: true, showExpires: false, showAbn: false }`.
  Invoice/quote retain today's defaults (`showExpires: true`).
  - Mechanism: add an optional `surface` parameter to
    `blockTemplate(type, surface?)` and branch the `title` case. The
    add-block palette flow already has surface context to pass in.
- Add the header to the **default contract tree** in
  `defaults.ts` so a fresh contract looks complete. New default order:
  `[businessName, title(contract defaults), contractBody]`.
- Keep `title` in `REQUIRED_BY_SURFACE.contract`, so the top-right
  warning re-appears if the MC deletes the header.

### 3. Contract body (contractBody) — slim the editor placeholder

In `RenderContractBody` (`render.tsx:1066-1131`):

- Remove the fake sample clauses (the `opacity-60 select-none
  pointer-events-none` mock block).
- Remove the heavy dashed "Locked" framing.
- Keep a compact, clearly labelled **"Contract body"** slot with the
  single-line note that the body is authored per couple under
  **Payments → Contracts**.
- Rely on the existing per-block **Required** badge + top-right
  `NotReadyPanel` for the required/locked signal.

Match existing calm in-app styling (see couple-overview / couple-events
patterns): no boxes-in-boxes, minimal chrome.

### 4. Required warning (NotReadyPanel) — already built

No new UI. The generic `NotReadyPanel` ("Not ready to send", amber,
`absolute top-3 right-3`, `not-ready-panel.tsx`) already runs on the
contract surface via `evaluateSurface`
(`branding-editor.tsx:967-972`, `lib/branding/readiness.ts:71-148`).
After step 1 the contract requirement is `['title', 'contractBody']`.
Both are default-present and `contractBody` is a locked singleton
(always present), so the panel is quiet on a healthy contract and only
fires if the MC removes the header.

## Out of scope

- No change to how the per-couple contract body is authored (the
  builder modal's TipTap editor, `components/builders/parts/contract-body-editor.tsx`).
- No change to the public contract page's signature/decline flow.
- No change to the `action` block on invoices/portal.
- No new "quote" surface (there isn't one; document surfaces are
  invoice/contract).

## Testing

- **Unit:**
  - `evaluateSurface('contract', …)` — required set is
    `['title', 'contractBody']`; missing header → not ready; missing
    action is no longer flagged.
  - `blockTemplate('title', 'contract')` → `showExpires: false`,
    `showRef: true`; `blockTemplate('title', 'invoice')` unchanged.
  - Contract allowed-blocks list from `blocks-by-surface` excludes
    `action`.
  - `RenderContractBody` output no longer contains the fake-clause
    strings ("Definitions and interpretation", the sample date) and
    still contains the "Payments → Contracts" note.
  - Default contract tree contains a `title` block.
- **Update existing tests** asserting the old contract block list or
  required set, if any.
- **E2E / manual:** verify in the running app that a fresh contract
  shows header + body + injected signature, the palette has no "Sign
  contract" entry, and the top-right warning behaves as described.

## Files touched

- `app/(dashboard)/branding/blocks/blocks-by-surface.ts`
- `app/(dashboard)/branding/blocks/policy.ts`
- `app/(dashboard)/branding/blocks/types.ts`
- `app/(dashboard)/branding/blocks/defaults.ts`
- `app/(dashboard)/branding/blocks/render.tsx`
- Tests under `tests/unit/` for the above
- Docs: the block-model plan
  (`docs/superpowers/plans/2026-07-23-document-blocks.md`) and any
  affected `.claude/docs/*` (page-specs / component-library) to
  reflect the contract surface = header + body + injected signature.

## Branch

Per the user's decision, this work stays on the current branch
(`feature/custom-payment-schedules`) rather than a separate worktree.
