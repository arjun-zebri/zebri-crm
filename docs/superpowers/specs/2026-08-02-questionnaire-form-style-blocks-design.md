# Questionnaire form-style blocks — design

**Date:** 2026-08-02
**Surface:** Branding editor → Questionnaire document
**Status:** Approved (design), pending implementation plan

## Problem

The questionnaire document in the branding editor currently carries a single
locked marker block, `questionnaireBody`, whose presentation is chosen through
an in-block toggle (`mode?: 'form' | 'oneAtATime'`). We want the MC to choose
the form style by **adding one of two blocks** instead of flipping a toggle, and
to warn when the choice is ambiguous:

- **None** of the two blocks present → warning.
- **Both** blocks present → warning.
- Exactly **one** present → valid.

The two blocks must also be **stylable like every other block** (background,
padding, corner radius, width), and that styling must wrap the questions area on
both the editor preview and the live public fill page.

## Decisions (locked during brainstorming)

1. **Replace the toggle with two blocks.** Retire the `questionnaireBody` marker
   and its `mode` toggle. The presence of exactly one of two new marker blocks
   selects the style.
2. **Safe public fallback.** Branding autosaves, so an invalid state can reach
   the live questionnaire couples fill out. The public page never breaks: both
   present → first block in the tree wins; none present → Classic ("All on one
   page") form.
3. **Styling wraps the questions area.** The standard block style frame
   (background, padding, corner radius, width) wraps the questions container on
   both editor preview and public render.
4. **Labels:** "One at a time" (Typeform-style flow) and "All on one page"
   (Classic form). Avoids the "Typeform" brand name; matches the existing block
   toggle wording.

## Chosen approach

Two new marker block types plus a new `exactly-one` policy rule, mirroring the
existing `CLEARABLE_MARKERS` / `AT_LEAST_ONE_BY_SURFACE` patterns in
`app/(dashboard)/branding/blocks/policy.ts`. Rejected alternatives: reusing
`AT_LEAST_ONE` plus a separate "too many" check (splits one concept across two
mechanisms), and keeping one block with two non-marker selector blocks (two
sources of truth for one choice).

## Components & changes

### 1. Block types — `app/(dashboard)/branding/blocks/types.ts`

- Remove `QuestionnaireBodyBlock` from `BlockType` and the `Block` union.
- Add two marker interfaces `extends BaseBlock` (no `mode` field — the block
  type *is* the choice):
  - `QuestionnaireOneAtATimeBlock` — `type: 'questionnaireOneAtATime'`. Injects
    `TypeformFlow`.
  - `QuestionnaireAllOnePageBlock` — `type: 'questionnaireAllOnePage'`. Injects
    `ClassicForm`.
- Add `BLOCK_LABELS` ("One at a time" / "All on one page") and
  `BLOCK_DESCRIPTIONS` entries for both.

### 2. Policy — `app/(dashboard)/branding/blocks/policy.ts`

- Add both types to `MARKER_TYPES` (render-split markers → `return null`
  publicly) and to `CLEARABLE_MARKERS` (addable / deletable, singleton per type).
- Remove `questionnaireBody` from `REQUIRED_BY_SURFACE['questionnaire']`; leave
  the questionnaire required list empty (the exactly-one rule covers presence).
- Add `EXACTLY_ONE_BY_SURFACE = { questionnaire: ['questionnaireOneAtATime',
  'questionnaireAllOnePage'] }` and an `exactlyOneForSurface(surface)` helper.

### 3. Readiness — `lib/branding/readiness.ts`

- Remove the `questionnaire-mode` branch and that `ReadinessIssue.kind`.
- Add `kind: 'need-exactly-one'`.
- In `evaluateSurface`, count blocks present from `exactlyOneForSurface(surface)`:
  - `0` → issue *"Add a form style — One at a time or All on one page"*, flips
    `ready: false`.
  - `2+` → issue *"Pick one form style — you have both One at a time and All on
    one page"*, flips `ready: false`.
  - `1` → no issue.
- Surfaces automatically through the existing `NotReadyPanel` (no UI change
  needed there beyond the new message).

### 4. Defaults & migration — `app/(dashboard)/branding/blocks/defaults.ts`

- `defaultBlocksFor('questionnaire')` seeds one **All on one page**
  (`questionnaireAllOnePage`) block so new users start in a valid state (maps to
  today's default `mode: 'form'`).
- `migrateBlocks`: any stored `questionnaireBody` block →
  - `questionnaireOneAtATime` when `mode === 'oneAtATime'`,
  - otherwise `questionnaireAllOnePage`.
  Preserve the block `id` and all style/geometry fields so existing users'
  styling carries over.
- Verify `lib/branding/validate-blocks.ts` `repairBlocks` (run on load and on the
  public page) leaves the migrated blocks intact.

### 5. Palette — `app/(dashboard)/branding/blocks/blocks-by-surface.ts`

- List both types permanently under the questionnaire doc-specific group.
- Existing `addBlock` behavior: adding a type already present selects it (marker
  singleton behavior); adding the *other* type creates the "both" state →
  warning. Nothing is hard-blocked — the warning is the guardrail.

### 6. Rendering

- **Editor** (`block-renderer.tsx`, `render.tsx`): replace `RenderQuestionnaireBody`
  and its toggle with two renderers that preview the questions area wrapped in
  the block's style frame (shared document frame).
- **Public dispatch** (`lib/branding/public-renderer.tsx`): both new types are
  markers → `return null` (content injected by the fill page).
- **Fill page** (`app/questionnaire/[token]/page.tsx` +
  `_lib/branding-chrome.ts`): stop reading `.mode`. Determine the active block by
  type among the two:
  - `questionnaireOneAtATime` → `TypeformFlow`.
  - `questionnaireAllOnePage` → `ClassicForm`.
  - **Both present** → first in the block tree wins.
  - **None present** → `ClassicForm` fallback.
  Wrap the injected renderer in the active block's style frame (background /
  padding / corner radius / width) so styling reaches couples.
  `questionnaireChrome(blocks, ...)` updates to split chrome around whichever of
  the two markers is active.

## Data flow

Stored branding JSON (block tree per document) → `repairBlocks` / `migrateBlocks`
on load → editor renders blocks + computes `evaluateSurface` → `NotReadyPanel`.
On the public side: stored JSON → `repairBlocks` → fill page picks the active
form-style block by type → wraps the matching renderer in the block's style
frame.

The `'typeform' | 'form'` vocabulary in `lib/questionnaires/*` (question schema,
template builder) is unchanged; we bridge to the renderers at the fill-page
boundary only.

## Error / edge handling

- **Invalid live state (0 or 2+ blocks):** handled by the safe fallback above;
  never breaks the couple's fill experience.
- **Legacy `questionnaireBody` in stored data:** migrated deterministically by
  `mode`.
- **Autosave races:** no new concern — the block tree remains the single source
  of truth; readiness is derived, not stored.

## Testing

- **Unit:**
  - `evaluateSurface` for questionnaire with 0 / 1 / 2 form-style blocks →
    correct `ready` + `need-exactly-one` messages.
  - `migrateBlocks` maps `questionnaireBody{mode:'oneAtATime'}` →
    `questionnaireOneAtATime` and `{mode:'form'}` / undefined →
    `questionnaireAllOnePage`, preserving `id` + style.
  - `defaultBlocksFor('questionnaire')` seeds a valid single-block state.
  - Exhaustive-switch compile coverage (both renderers, both policy sets).
- **E2E (Playwright, desktop + Pixel 5 + iPhone 12):**
  - Adding / removing a form-style block toggles the `NotReadyPanel`.
  - Public fill page renders the correct form for each single-block state.
  - Fallback renders for both-present and none-present states.
- **Docs:** update `.claude/docs/document-blocks.md`,
  `.claude/docs/page-specs.md` (questionnaire), and the readiness notes in the
  same PR.

## Out of scope (YAGNI)

- No changes to the `lib/questionnaires/*` question engine, `QuestionnaireDisplayMode`
  vocabulary, or the questionnaire theme system.
- No per-block theme controls (question text color, button color) — the block
  style is limited to the standard frame, per decision 3.
