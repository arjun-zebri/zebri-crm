# Proposal Layout v2 Phase 2: Template Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make templates editable: a Qwilr-style section editor for content sections at `/proposals/templates/[id]`, with the section, text and node bars, the add palette with presets, the resize engine, a mobile canvas, and the shared editor primitives extracted to `components/editor/`.

**Architecture:** The layout stays the single source of truth: `useLayoutEditor` holds one `ProposalLayout` plus a selection in a pure reducer wrapped by `lib/branding/use-history` (one undo history). Each content section mounts a TipTap editor built from a v2 extension set that mirrors `model/rich-doc-spec.ts` one-to-one (a parity test enforces it); TipTap's own history is off, edits flow `onUpdate -> toPlainJSON -> reducer`, and undo/redo re-hydrate the affected editor. Data sections render read-only through Phase 1's `SectionView mode="edit"` and are selectable only at section level (their editing is Phase 3). All bars are one 32px row of `components/editor/` primitives; every drag handle is one `ResizeGrip` over pure `resize-math`. The editor autosaves into `proposal_templates.layout` through `updateTemplateLayoutAction`.

**Tech Stack:** Next.js 16, React 19, TipTap 3.22 (`@tiptap/react`, `starter-kit`, `extension-table`, `extension-text-style`, `extension-highlight`, `extension-text-align`, `extension-image`, `suggestion`), dnd-kit sortable, Radix popover, Zod 4, Vitest + RTL, local Supabase.

**Spec:** `docs/superpowers/specs/2026-09-16-proposal-layout-v2-design.md` (sections 2.2, 3, 4, 5.1, 5.3, 8 item 2, 9, 10, 11 bind this plan). Phase 1 plan for what already exists: `docs/superpowers/plans/2026-09-16-proposal-layout-v2-phase1-foundation.md`.

## Global Constraints

- Never commit. Leave changes in the working tree and report; the user commits. Branch: `feature/proposal-layout-v2` (Phase 1 is committed there as `87274df6`).
- Comment style: TSDoc on every exported symbol and module; why-comments on non-obvious logic. No em dashes anywhere (code, comments, docs, copy).
- Design system: tokens only (`text-body`, `rounded-control`, `rounded-pill`, `bg-surface`, `border-border`, `text-text-muted`). No `text-sm`, `rounded-lg`, hex utilities. Icons are Lucide `strokeWidth={1.5}`. One control height, `h-8`. `<Button loading>` for busy states.
- Bars: one 32px row each, built only from `components/editor/` primitives plus `components/ui/` (`Tooltip`, `ColorPopover`, `MenuPanel`/`MenuItem`, `Button`, `ConfirmDialog`). No captions above controls. Anything deeper than one step opens a popover from that control, never a second row. Overflow `...` when a bar would not fit at 380px.
- Layering: `features/proposals/` imports only `@/lib/*`, `@/components/ui/*`, `@/components/editor/*`, `@/types/*` and (until Phase 3) `@/app/(dashboard)/branding/blocks/{types,defaults,proposal-starters}`. Nothing outside the module imports from inside it except `@/features/proposals`. `components/editor/` never imports `features/` or `app/`.
- Rich text JSON passes through `toPlainJSON` (`@/lib/utils`) before it enters the reducer, before validation and before storage.
- Node/mark parity: every entry of `NODE_TYPES` and `MARK_TYPES` in `features/proposals/model/rich-doc-spec.ts` has exactly one TipTap extension with that name, and every editor output must pass `parseProposalLayout`. Limits from the spec: 40 sections, 200 nodes per rich doc, 2 MB serialised.
- Widths: narrow 560 / medium 720 / wide 1100 px (`CONTENT_WIDTH_PX`); padding compact 32 / cozy 48 / roomy 64 px (`SECTION_PADDING_PX`); `contentWidth` and `padding` may also be a dragged px value (schema already allows numbers).
- Gates must stay green: `npm run typecheck` (0 errors), `npm run typecheck:strict` (budget 238, must not rise), `npm run lint:gate` (43 errors / 71 warnings budget, must not rise), unit + the proposals integration suites, `node scripts/check-server-action-exports.mjs`, `node scripts/check-no-service-role-in-client.mjs`.
- `'use server'` files export only async functions. Server actions validate with Zod and return `{ ok: true, ... } | { ok: false, error }`.
- Files stay near the ~150-line guideline; split by responsibility when a file passes it.
- Tests import from `@/features/proposals` only (the ESLint boundary applies to `tests/**` too): every task exports what its tests need from `features/proposals/index.ts`, as Phase 1 did.
- Test selectors: `getByRole` > `getByLabel` > `getByText` > `data-testid`. Unit tests run in the `unit` (jsdom) project; integration in `integration` (node, local Supabase). Bracketed path segments are glob metacharacters: quote them.
- The Branding editor keeps working throughout: moved primitives leave a re-export at the old path (removed in Phase 5).

## File structure

```
components/editor/
  toolbar-primitives.tsx   PillToggle, ActiveTargetLabel, ToolbarDivider, IncludeDropdown, VAlignIcon (moved)
  position-control.tsx     PositionControl (moved)
  select.tsx, slider.tsx   compact toolbar Select (xs/sm/md) and Slider (moved from branding/components)
  number-stepper.tsx       NumberStepper (extracted from text-style-controls)
  canvas-frame.tsx         CanvasFrame + zoom widget (moved)
  resize-math.ts           pure drag maths: zoom factor, snap, clamp, preset <-> px
  resize-grip.tsx          one grip, one readout pill, one snap tolerance
  index.ts                 barrel
features/proposals/editor/
  state.ts                 LayoutEditorState, layoutReducer, selection types
  use-layout-editor.ts     reducer + useHistory; the one undo history
  extensions/              TipTap extension set mirroring rich-doc-spec
    index.ts, image.ts, button.ts, embed.ts, audio.ts, columns.ts, spacer.ts, text-case.ts, slash-menu.ts
  node-views/              React node views: image, button, embed, audio, columns, spacer
  content-section-editor.tsx   one TipTap editor per content section
  editable-section.tsx     outline, gutter handle, hideOnMobile badge, content/data switch
  section-canvas.tsx       sortable section list, + lines, add button, keyboard
  add-palette.tsx          Sections / Presets palette
  bars/section-bar.tsx, bars/section-background.tsx, bars/text-bar.tsx, bars/link-popover.tsx
  bars/node-bar.tsx, bars/node-bar-image.tsx, bars/node-bar-button.tsx, bars/node-bar-misc.tsx
  resize/section-height-grip.tsx, resize/section-width-handles.tsx
  editor-registry.ts       section id -> TipTap Editor instance (for bars and undo re-hydration)
  template-editor.tsx      shell: load, autosave, header, CanvasFrame, bars
features/proposals/data/media.ts     upload path helper + Zod for storage URLs (client upload stays raw XHR)
app/(dashboard)/proposals/templates/[id]/page.tsx
app/design-system/editor-primitives.tsx
```

---

### Task 1: Extract the shared editor primitives to `components/editor/`

**Files:**
- Create: `components/editor/toolbar-primitives.tsx`, `components/editor/position-control.tsx`, `components/editor/select.tsx`, `components/editor/slider.tsx`, `components/editor/number-stepper.tsx`, `components/editor/canvas-frame.tsx`, `components/editor/index.ts`
- Create: `app/design-system/editor-primitives.tsx`
- Modify (become re-export shims): `app/(dashboard)/branding/blocks/toolbar-primitives.tsx`, `app/(dashboard)/branding/blocks/proposal/position-control.tsx`, `app/(dashboard)/branding/components/select.tsx`, `app/(dashboard)/branding/components/slider.tsx`, `app/(dashboard)/branding/canvas-frame.tsx`
- Modify: `app/(dashboard)/branding/blocks/text-style-controls.tsx` (its private `NumberStepper` becomes an import), `app/design-system/page.tsx` (mount the new section), `.claude/docs/frontend-design.md`, `.claude/docs/component-library.md`
- Test: `tests/unit/components/editor/toolbar-primitives.test.tsx`, `tests/unit/components/editor/number-stepper.test.tsx`

**Interfaces:**
- Produces (from `@/components/editor`): `PillToggle`, `ActiveTargetLabel`, `ToolbarDivider`, `IncludeDropdown`, `IncludeRow`, `VAlignIcon`, `PositionControl`, `Select`, `SelectOption`, `Slider`, `NumberStepper`, `CanvasFrame`, `CanvasFrameProps`, `CanvasDevice = 'desktop' | 'mobile'`. Signatures are unchanged from their current definitions (read each source file before moving it).
- `NumberStepper` props: `{ value: number; min: number; max: number; step: number; onChange: (v: number) => void; ariaLabel: string; suffix?: string }` (lifted verbatim from `text-style-controls.tsx:290`, plus the optional `suffix` shown after the number, e.g. `px`).

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/unit/components/editor/toolbar-primitives.test.tsx
/**
 * The shared editor primitives now live in components/editor; the Branding
 * paths only re-export them. Both import paths must resolve to the same
 * components so neither editor drifts.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PillToggle, ToolbarDivider } from '@/components/editor'
import * as legacy from '@/app/(dashboard)/branding/blocks/toolbar-primitives'

describe('components/editor toolbar primitives', () => {
  it('PillToggle marks the active option and reports changes', async () => {
    const onChange = vi.fn()
    render(<PillToggle options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} value="a" onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'A' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'B' }))
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('renders a divider', () => {
    const { container } = render(<ToolbarDivider />)
    expect(container.firstChild).not.toBeNull()
  })

  it('the Branding path re-exports the same components', () => {
    expect(legacy.PillToggle).toBe(PillToggle)
    expect(legacy.ToolbarDivider).toBe(ToolbarDivider)
  })
})
```

```tsx
// tests/unit/components/editor/number-stepper.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { NumberStepper } from '@/components/editor'

describe('NumberStepper', () => {
  it('steps within bounds and shows the suffix', async () => {
    const onChange = vi.fn()
    render(<NumberStepper value={48} min={0} max={50} step={4} onChange={onChange} ariaLabel="Padding" suffix="px" />)
    expect(screen.getByText('48px')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Increase Padding' }))
    expect(onChange).toHaveBeenCalledWith(50)
    await userEvent.click(screen.getByRole('button', { name: 'Decrease Padding' }))
    expect(onChange).toHaveBeenCalledWith(44)
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/components/editor`
Expected: FAIL, `Cannot find module '@/components/editor'`.

- [ ] **Step 3: Move the primitives**

Move the bodies of `PillToggle`, `ActiveTargetLabel`, `VAlignIcon`, `ToolbarDivider`, `IncludeRow`, `IncludeDropdown` into `components/editor/toolbar-primitives.tsx` unchanged (keep their TSDoc, fix imports to `@/components/ui/*`). Move `PositionControl` to `components/editor/position-control.tsx`, `Select`/`SelectOption` to `components/editor/select.tsx`, `Slider` to `components/editor/slider.tsx`, `CanvasFrame` (with its zoom widget and `ZOOM_MIN`/`ZOOM_MAX`/`clampZoom`) to `components/editor/canvas-frame.tsx`; export `type CanvasDevice = 'desktop' | 'mobile'` from it. Lift `NumberStepper` out of `text-style-controls.tsx` into `components/editor/number-stepper.tsx` with the `aria-label`s `Increase ${ariaLabel}` / `Decrease ${ariaLabel}` and the optional `suffix`; `text-style-controls.tsx` imports it.

Each old file becomes a shim, for example:

```ts
// app/(dashboard)/branding/blocks/toolbar-primitives.tsx
/**
 * Compatibility re-export: the toolbar primitives moved to `components/editor`
 * (Proposal Layout v2 Phase 2, spec 5.3) so the Branding and proposal editors
 * share one set. Removed in Phase 5 with the Branding toolbar rebuild.
 */
export { PillToggle, ActiveTargetLabel, VAlignIcon, ToolbarDivider, IncludeDropdown } from '@/components/editor'
export type { IncludeRow } from '@/components/editor'
```

`components/editor/index.ts` re-exports everything above with a module TSDoc.

- [ ] **Step 4: Add the design-system entry**

`app/design-system/editor-primitives.tsx`: one `Spec` per primitive (PillToggle, ActiveTargetLabel, ToolbarDivider, IncludeDropdown, PositionControl, Select xs, Slider, NumberStepper, CanvasFrame in a 320px-tall `SampleFrame`) following the `Spec`/`Example`/`SampleFrame` pattern in `app/design-system/patterns-chrome.tsx`; mount it from `app/design-system/page.tsx` under a heading "Editor primitives". Update `frontend-design.md` (new section "Editor primitives (`components/editor/`)") and `component-library.md` (one line per primitive).

- [ ] **Step 5: Run tests, typecheck, lint**

Run: `npx vitest run tests/unit/components/editor tests/unit/branding tests/unit/app/branding 2>/dev/null; npm run typecheck; npx eslint components/editor 'app/(dashboard)/branding' app/design-system`
Expected: all green; no new lint warnings.

- [ ] **Step 6: Report** (no commit)

---

### Task 2: `resize-math` and the shared `ResizeGrip`

**Files:**
- Create: `components/editor/resize-math.ts`, `components/editor/resize-grip.tsx`
- Modify: `components/editor/index.ts`, `app/(dashboard)/branding/blocks/proposal/hero-resize.tsx` (re-implemented on `ResizeGrip`, same props and behaviour), `app/design-system/editor-primitives.tsx`
- Test: `tests/unit/components/editor/resize-math.test.ts`, `tests/unit/components/editor/resize-grip.test.tsx`

**Interfaces:**
- Produces:
```ts
export interface Snap { value: number; label?: string }
/** Screen px per layout px for a CSS-zoomed root; 1 when it cannot be measured. */
export function zoomFactor(el: HTMLElement | null): number
export function applySnaps(value: number, snaps: readonly Snap[], tolerance: number): number
export function clamp(value: number, min: number, max: number): number
export function stepRound(value: number, step: number): number
/** Drag maths without DOM: start value + delta in screen px -> next value. */
export function dragValue(o: { start: number; deltaScreenPx: number; zoom: number; scale?: number; min: number; max: number; step?: number; snaps?: readonly Snap[]; tolerance?: number }): number
export interface ResizeGripProps {
  axis: 'x' | 'y'
  value: number
  min: number
  max: number
  /** Layout px per unit of `value` (1 for px values, e.g. viewportHeight/100 for vh). */
  scale?: number
  step?: number
  snaps?: readonly Snap[]
  tolerance?: number
  /** Readout text while dragging, e.g. (v) => `${v}px` or a snap label. */
  format: (value: number) => string
  onChange: (value: number) => void
  /** Fired once on mouse up with the final value (history commit point). */
  onCommit?: (value: number) => void
  ariaLabel: string
  className?: string
}
export function ResizeGrip(props: ResizeGripProps): JSX.Element
```

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/components/editor/resize-math.test.ts
import { describe, expect, it } from 'vitest'

import { applySnaps, clamp, dragValue, stepRound } from '@/components/editor/resize-math'

describe('resize-math', () => {
  it('snaps within tolerance and leaves values outside it alone', () => {
    const snaps = [{ value: 32 }, { value: 48 }, { value: 64 }]
    expect(applySnaps(50, snaps, 4)).toBe(48)
    expect(applySnaps(56, snaps, 4)).toBe(56)
  })
  it('clamps and rounds to steps', () => {
    expect(clamp(500, 0, 240)).toBe(240)
    expect(stepRound(13, 8)).toBe(16)
  })
  it('dragValue divides screen px by zoom and scale, then clamps, steps and snaps', () => {
    // 50% zoom: 100 screen px is 200 layout px; scale 7.2 layout px per vh.
    expect(dragValue({ start: 50, deltaScreenPx: 100, zoom: 0.5, scale: 7.2, min: 10, max: 100 })).toBe(78)
    expect(dragValue({ start: 40, deltaScreenPx: 4, zoom: 1, min: 8, max: 160, step: 8 })).toBe(48)
    expect(dragValue({ start: 700, deltaScreenPx: 15, zoom: 1, min: 320, max: 1400, snaps: [{ value: 720 }], tolerance: 12 })).toBe(720)
  })
})
```

```tsx
// tests/unit/components/editor/resize-grip.test.tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ResizeGrip } from '@/components/editor'

describe('ResizeGrip', () => {
  it('reports values while dragging, snaps, and commits on mouse up', () => {
    const onChange = vi.fn()
    const onCommit = vi.fn()
    render(
      <div style={{ position: 'relative' }}>
        <ResizeGrip axis="y" value={40} min={0} max={240} snaps={[{ value: 48, label: 'Cozy' }]} tolerance={4} format={(v) => `${v}px`} onChange={onChange} onCommit={onCommit} ariaLabel="Section height" />
      </div>,
    )
    const grip = screen.getByRole('slider', { name: 'Section height' })
    fireEvent.mouseDown(grip, { clientY: 100 })
    fireEvent.mouseMove(window, { clientY: 106 })
    expect(onChange).toHaveBeenLastCalledWith(48)
    expect(screen.getByText('Cozy')).toBeInTheDocument()
    fireEvent.mouseUp(window)
    expect(onCommit).toHaveBeenCalledWith(48)
  })
  it('moves by step with the arrow keys', () => {
    const onChange = vi.fn()
    render(<ResizeGrip axis="y" value={40} min={0} max={240} step={8} format={(v) => `${v}px`} onChange={onChange} ariaLabel="Section height" />)
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Section height' }), { key: 'ArrowDown' })
    expect(onChange).toHaveBeenCalledWith(48)
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/components/editor/resize`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

```ts
// components/editor/resize-math.ts
/**
 * Pure drag maths shared by every resize handle in the editors (section
 * height and width, image, columns, spacer, the Branding hero). No DOM
 * except `zoomFactor`, so the numbers are unit-testable.
 */
export interface Snap { value: number; label?: string }

/** Screen px per layout px for a CSS `zoom`-scaled root (the canvas), or 1. */
export function zoomFactor(el: HTMLElement | null): number {
  if (!el) return 1
  const layout = el.offsetHeight
  const screen = el.getBoundingClientRect().height
  return layout > 0 && screen > 0 ? screen / layout : 1
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function stepRound(value: number, step: number): number {
  return step > 0 ? Math.round(value / step) * step : value
}

/** The nearest snap wins when it is within `tolerance` units of `value`. */
export function applySnaps(value: number, snaps: readonly Snap[], tolerance: number): number {
  let best: Snap | null = null
  for (const s of snaps) {
    const d = Math.abs(s.value - value)
    if (d <= tolerance && (!best || d < Math.abs(best.value - value))) best = s
  }
  return best ? best.value : value
}

export function dragValue(o: {
  start: number; deltaScreenPx: number; zoom: number; scale?: number
  min: number; max: number; step?: number; snaps?: readonly Snap[]; tolerance?: number
}): number {
  const layoutPx = o.deltaScreenPx / (o.zoom || 1)
  const units = layoutPx / (o.scale ?? 1)
  let next = clamp(Math.round(o.start + units), o.min, o.max)
  if (o.step) next = clamp(stepRound(next, o.step), o.min, o.max)
  if (o.snaps) next = applySnaps(next, o.snaps, o.tolerance ?? 0)
  return next
}
```

`ResizeGrip`: a `role="slider"` element (`aria-valuenow/min/max`, `aria-label`, `tabIndex=0`) styled as a pill grip (`axis: 'y'` sits at the bottom edge with `cursor-ns-resize`, `'x'` at the side with `cursor-ew-resize`; tokens only: `bg-brand-fg`, `rounded-pill`, `shadow-sm`). On `mousedown` it records `zoomFactor(e.currentTarget.offsetParent)` and the start value, then on window `mousemove` calls `dragValue` and `onChange` when the value changes, shows a readout pill (`format(value)`, or the matching snap's label) next to the grip, and on `mouseup` calls `onCommit`. Arrow keys move by `step ?? 1` (`ArrowDown`/`ArrowRight` increase, `ArrowUp`/`ArrowLeft` decrease). `e.preventDefault()` + `stopPropagation()` on mousedown so a drag never selects the section behind it. Re-implement `HeroResizeGrip` as `<ResizeGrip axis="y" value={heightVh} min={HERO_MIN_VH} max={HERO_MAX_VH} scale={canvasViewportHeight / 100} snaps={[{ value: HERO_MAX_VH, label: 'Full screen' }]} tolerance={4} format={(v) => \`${v}% of screen\`} ... />` and keep its existing tests green.

- [ ] **Step 4: Run tests + gates**

Run: `npx vitest run tests/unit/components/editor tests/unit/app/branding; npm run typecheck; npx eslint components/editor`
Expected: green.

- [ ] **Step 5: Report**

---

### Task 3: Editor state: reducer, selection, one history

**Files:**
- Create: `features/proposals/editor/state.ts`, `features/proposals/editor/use-layout-editor.ts`
- Modify: `features/proposals/index.ts`
- Test: `tests/unit/features/proposals/editor/state.test.ts`, `tests/unit/features/proposals/editor/use-layout-editor.test.tsx`

**Interfaces:**
- Consumes: `ProposalLayout`, `Section`, `SectionKind`, `SectionStyle` from `../model/layout`; `newSectionId` from `../model/schema`; `presetSection`, `PresetId` from `../model/presets`; `LAYOUT_LIMITS` from `../model/rich-doc-spec`; `emptyContentSection(kind)` is added to `../model/doc.ts` in this task (a content section gets `doc(paragraph())`; a data kind gets its Phase 1 sample `data` from `presets.ts`'s existing helpers).
- Produces:
```ts
export type NodeSelection = { sectionId: string; nodeType: string; pos: number } | null
export interface Selection { sectionId: string | null; node: NodeSelection }
export interface LayoutEditorState { layout: ProposalLayout; selection: Selection }
export type LayoutAction =
  | { type: 'select'; sectionId: string | null }
  | { type: 'selectNode'; node: NodeSelection }
  | { type: 'addSection'; at: number; section: Section }
  | { type: 'moveSection'; from: number; to: number }
  | { type: 'duplicateSection'; id: string }
  | { type: 'deleteSection'; id: string }
  | { type: 'updateStyle'; id: string; patch: Partial<SectionStyle> }
  | { type: 'resetStyle'; id: string }
  | { type: 'setContent'; id: string; content: JSONContent }
  | { type: 'setName'; id: string; name: string }
  | { type: 'toggleHideOnMobile'; id: string }
  | { type: 'replaceLayout'; layout: ProposalLayout }
export function layoutReducer(state: LayoutEditorState, action: LayoutAction): LayoutEditorState
export function newSectionFor(kind: SectionKind | { preset: PresetId }, role?: ProposalRole): Section
export function useLayoutEditor(initial: ProposalLayout): {
  state: LayoutEditorState
  dispatch: (action: LayoutAction, opts?: { commit?: boolean }) => void
  undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean
  commit: () => void
}
```
- Rules encoded in the reducer: `addSection` beyond `LAYOUT_LIMITS.maxSections` is a no-op; `duplicateSection` regenerates `id` with `newSectionId()`; `deleteSection` of the selected section clears the selection; `resetStyle` restores the style the section's kind/preset starts with (`newSectionFor(kind).style`).
- History holds the layout only. `useHistory` (`lib/branding/use-history.ts`) commits by JSON-comparing the whole value it holds, so selection must live outside it: the hook keeps `useHistory<ProposalLayout>` for the layout and a plain `useState<Selection>` for the selection, and `layoutReducer` is a pure function over `{ layout, selection }` that the hook applies to both (selection actions leave `layout` untouched, so the history never records them).

- [ ] **Step 1: Write the failing tests** (cover every action above, the 40-section cap, id regeneration on duplicate, selection cleared on delete, `moveSection` bounds, `resetStyle`)

```ts
// tests/unit/features/proposals/editor/state.test.ts (excerpt; write one `it` per action)
import { describe, expect, it } from 'vitest'

import { defaultTemplateLayout, LAYOUT_LIMITS, layoutReducer, newSectionFor, type LayoutEditorState } from '@/features/proposals'

const base = (): LayoutEditorState => ({ layout: defaultTemplateLayout('mc'), selection: { sectionId: null, node: null } })

describe('layoutReducer', () => {
  it('adds a content section at an index and selects it', () => {
    const s = layoutReducer(base(), { type: 'addSection', at: 1, section: newSectionFor('content') })
    expect(s.layout.sections[1]?.kind).toBe('content')
    expect(s.selection.sectionId).toBe(s.layout.sections[1]?.id)
  })
  it('refuses the 41st section', () => {
    let s = base()
    while (s.layout.sections.length < LAYOUT_LIMITS.maxSections) s = layoutReducer(s, { type: 'addSection', at: 0, section: newSectionFor('content') })
    const before = s.layout
    expect(layoutReducer(s, { type: 'addSection', at: 0, section: newSectionFor('content') }).layout).toBe(before)
  })
  it('duplicate gets a fresh id and lands directly below', () => {
    const s0 = base(); const id = s0.layout.sections[0]!.id
    const s = layoutReducer(s0, { type: 'duplicateSection', id })
    expect(s.layout.sections[1]?.id).not.toBe(id)
    expect(s.layout.sections[1]?.kind).toBe(s0.layout.sections[0]!.kind)
  })
  it('delete clears a selection pointing at the section', () => {
    const s0 = base(); const id = s0.layout.sections[0]!.id
    const s = layoutReducer(layoutReducer(s0, { type: 'select', sectionId: id }), { type: 'deleteSection', id })
    expect(s.selection.sectionId).toBeNull()
  })
})
```

The hook test renders a probe component, dispatches `updateStyle` twice with a fake timer past the 500 ms commit debounce, then `undo()` twice and asserts the layout returns to the initial value, and that `select` never creates an undo step.

- [ ] **Step 2: Run to verify failure**, **Step 3: Implement** (`use-layout-editor.ts`: `const history = useHistory<ProposalLayout>(initial)`, `const [selection, setSelection] = useState<Selection>(...)`; `dispatch(action, opts)` computes `next = layoutReducer({ layout: latestLayoutRef.current, selection }, action)`, then `history.set(next.layout, opts)` only when `next.layout !== current layout` and `setSelection(next.selection)` when it changed; `undo`/`redo` pass through and clear the node selection, since the node positions they pointed at may no longer exist. Add a why-comment explaining the split.), **Step 4: Run tests**, **Step 5: Export from `index.ts`** (`useLayoutEditor`, `layoutReducer`, `newSectionFor`, types), **Step 6: Report**

---

### Task 4: The v2 TipTap extension set (spec parity)

**Files:**
- Create: `features/proposals/editor/extensions/index.ts`, `image.ts`, `button.ts`, `embed.ts`, `audio.ts`, `columns.ts`, `spacer.ts`, `text-case.ts`, `normalise.ts`
- Test: `tests/unit/features/proposals/editor/extensions.test.ts`

**Interfaces:**
- Consumes: `NODE_TYPES`, `MARK_TYPES`, `detectEmbedProvider` from `../../model/rich-doc-spec`; `parseProposalLayout` from `../../model/schema`; `Variable` from `@/lib/branding/rich-text-extensions` (its node is named `variable` with attr `id`, matching the schema); `toPlainJSON` from `@/lib/utils`.
- Produces:
```ts
/** Every extension the v2 rich doc needs, in one place, so the editor, the schema and the renderer agree. */
export function buildRichDocExtensions(o: { placeholder?: string; nodeViews?: boolean }): AnyExtension[]
/** Names of every node and mark `buildRichDocExtensions` registers (for the parity test and the slash menu). */
export const EDITOR_NODE_NAMES: readonly string[]
export const EDITOR_MARK_NAMES: readonly string[]
/** `toPlainJSON` plus: drops attrs whose value is null (TipTap's default for unset attrs; the Zod schema uses optional, not nullable). */
export function normaliseEditorJSON(json: JSONContent): JSONContent
```
- Node definitions (attrs and defaults must satisfy `model/schema.ts` exactly; read it first):
  - `image` (custom `Node.create`, not `@tiptap/extension-image`, because of the extra attrs): `group: 'block'`, `atom: true`, `draggable: true`, attrs `src` (string), `alt` (default `''`), `caption` (default `''`), `layout` (default `'inline'`), `widthPct` (default `100`).
  - `button`: `group: 'block'`, `atom: true`, attrs `label` (default `'Button'`), `action` (default `{ kind: 'link', href: 'https://' }`), `variant` (`'fill'`), `size` (`'md'`), `align` (`'left'`), `color` (default `undefined`, omitted when unset), `radius` (default `undefined`).
  - `embed`: `group: 'block'`, `atom: true`, attrs `url`; `addCommands` `setEmbed(url)` refuses a url whose `detectEmbedProvider` is null (returns false).
  - `audio`: `group: 'block'`, `atom: true`, attrs `src`, `title` (`''`), `durationSec` (default `undefined`).
  - `columns`: `group: 'block'`, `content: 'column{2,3}'`, attrs `count` (2); `column`: `content: 'block+'`, attrs `ratio` (0.5); `columns` is not allowed inside `column` (set `column`'s content to `(paragraph | heading | bulletList | orderedList | blockquote | image | button | embed | audio | spacer | horizontalRule | table)+`). Commands: `insertColumns(count)` (equal ratios), `setColumnRatios(ratios)`.
  - `spacer`: `group: 'block'`, `atom: true`, attrs `heightPx` (24).
  - `textCase` mark: attr `value` in `sentence | capitalize | uppercase | lowercase`, rendered as `<span data-text-case>` with the matching `text-transform` (sentence is applied by the renderer's existing `text-case` helper; in the editor render it as `capitalize` for the first letter only via `lib/branding/text-case`).
  - Base: `StarterKit.configure({ heading: { levels: [1, 2, 3] }, history: false, link: { openOnClick: false, autolink: true, protocols: ['https', 'mailto', 'tel'] } })` (StarterKit 3 includes `link`, `underline`, `strike`, `bold`, `italic`, lists, blockquote, hr, hardBreak); `TextStyle`, `Color`, `FontFamily`, `FontSize`, `Highlight.configure({ multicolor: true })`, `TextAlign.configure({ types: ['heading', 'paragraph'] })`, `TableKit` from `@tiptap/extension-table` (`table`, `tableRow`, `tableCell`, `tableHeader` with `resizable: false`), `Placeholder`, `Variable`. StarterKit's `codeBlock`, `code` are disabled (`codeBlock: false, code: false`) because the spec's node list has no code.
  - `history: false` is the one-undo-history rule (Task 3): document edits are undone by the layout history, not TipTap's.

- [ ] **Step 1: Write the failing parity test**

```ts
// tests/unit/features/proposals/editor/extensions.test.ts
/**
 * Spec 2.2: one node/mark spec drives the editor, the renderer and the
 * validator. This test pins the editor side to `rich-doc-spec.ts`.
 */
import { getSchema } from '@tiptap/core'
import { describe, expect, it } from 'vitest'

import { buildRichDocExtensions, MARK_TYPES, newSectionId, NODE_TYPES, normaliseEditorJSON, parseProposalLayout } from '@/features/proposals'

describe('v2 editor extensions', () => {
  const schema = getSchema(buildRichDocExtensions({}))

  it('registers exactly the spec node types (plus doc)', () => {
    const names = Object.keys(schema.nodes).filter((n) => n !== 'doc').sort()
    expect(names).toEqual([...NODE_TYPES].sort())
  })
  it('registers exactly the spec mark types', () => {
    expect(Object.keys(schema.marks).sort()).toEqual([...MARK_TYPES].sort())
  })
  it('a document using every node passes the layout schema after normalisation', () => {
    const json = normaliseEditorJSON({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1, textAlign: null }, content: [{ type: 'text', text: 'Hi ' }, { type: 'variable', attrs: { id: 'couple_name' } }] },
        { type: 'paragraph', attrs: { textAlign: null }, content: [{ type: 'text', text: 'Body', marks: [{ type: 'bold' }, { type: 'textCase', attrs: { value: 'uppercase' } }] }] },
        { type: 'image', attrs: { src: 'https://x.supabase.co/storage/v1/object/public/proposal-media/u/a.jpg', alt: '', caption: '', layout: 'inline', widthPct: 100 } },
        { type: 'button', attrs: { label: 'Accept', action: { kind: 'accept' }, variant: 'fill', size: 'md', align: 'left', color: null, radius: null } },
        { type: 'embed', attrs: { url: 'https://www.youtube.com/watch?v=abc' } },
        { type: 'columns', attrs: { count: 2 }, content: [
          { type: 'column', attrs: { ratio: 0.5 }, content: [{ type: 'paragraph' }] },
          { type: 'column', attrs: { ratio: 0.5 }, content: [{ type: 'spacer', attrs: { heightPx: 24 } }] },
        ] },
        { type: 'horizontalRule' },
      ],
    })
    const layout = { version: 2 as const, sections: [{ id: newSectionId(), kind: 'content' as const, style: { height: 'fit' as const, contentWidth: 'medium' as const, padding: 'cozy' as const }, content: json }] }
    const result = parseProposalLayout(layout)
    expect(result.ok, JSON.stringify(result)).toBe(true)
  })
  it('the embed command refuses a host outside the allowlist', () => {
    const embed = buildRichDocExtensions({}).find((e) => e.name === 'embed')
    expect(embed).toBeDefined()
    // Command behaviour is covered end to end in the node-bar test (Task 11); here the node exists with a url attr.
    expect(schema.nodes.embed?.spec.attrs?.url).toBeDefined()
  })
})
```

- [ ] **Step 2: Run to verify failure**, **Step 3: Implement** (each node file ≤ 80 lines: `Node.create` with `parseHTML`/`renderHTML` using `data-*` attributes so copy/paste inside the editor survives; no React yet, node views arrive in Task 7), **Step 4: Run the parity test and `npm run typecheck`**, **Step 5: Report**

---

### Task 5: `ContentSectionEditor`: one TipTap editor per content section

**Files:**
- Create: `features/proposals/editor/content-section-editor.tsx`, `features/proposals/editor/editor-registry.ts`, `features/proposals/editor/editor-styles.ts`
- Test: `tests/unit/features/proposals/editor/content-section-editor.test.tsx`

**Interfaces:**
- Consumes: `buildRichDocExtensions`, `normaliseEditorJSON` (Task 4); `roleCss`, `HEADING_ROLE` from `../render/text-roles` (so headings in the editor use the brand roles the page uses); `PublicBranding` from `@/lib/branding/public-branding`.
- Produces:
```ts
export interface ContentSectionEditorProps {
  sectionId: string
  content: JSONContent
  branding: PublicBranding
  textColor?: string | undefined
  align?: 'left' | 'center' | undefined
  /** Fired on every document change with normalised JSON (already `toPlainJSON`ed, null attrs dropped). */
  onChange: (sectionId: string, content: JSONContent) => void
  onFocusSection: (sectionId: string) => void
  onNodeSelect: (node: { sectionId: string; nodeType: string; pos: number } | null) => void
}
export function ContentSectionEditor(props: ContentSectionEditorProps): JSX.Element
// editor-registry.ts
export function registerEditor(sectionId: string, editor: Editor): void
export function unregisterEditor(sectionId: string): void
export function getEditor(sectionId: string): Editor | null
export function useRegisteredEditor(sectionId: string | null): Editor | null   // re-renders on register/unregister
```
- Behaviour: `useEditor({ extensions, content, editorProps: { attributes: { class: EDITOR_PROSE_CLASS } }, onUpdate })`; `onUpdate` -> `normaliseEditorJSON(editor.getJSON())` -> `onChange`. Re-hydration: when the `content` prop changes and its JSON differs from `editor.getJSON()` (after normalisation), call `editor.commands.setContent(content, { emitUpdate: false })` and restore the selection at the same position when it still exists (this is how undo/redo and "Reset style" reach an open editor). `onSelectionUpdate`: a `NodeSelection` on an atom node reports `onNodeSelect({ sectionId, nodeType, pos })`, anything else reports `null`. `onFocus` reports `onFocusSection`. Enter = paragraph, Shift+Enter = hard break (StarterKit default); headings keep focus on Enter (default TipTap behaviour splits into a paragraph, which is what the spec wants).
- `editor-styles.ts` exports `EDITOR_PROSE_CLASS`: the Tailwind classes that make the editor's DOM match `render/rich-doc.tsx` (same heading roles via CSS variables set by `roleCss`, list, blockquote and table styles, `[&_.is-editor-empty:first-child::before]` placeholder, `[&_[data-canvas=mobile]_&]` stacking rules for columns and floats, see Task 13). Keep it a single exported constant with a why-comment per group.

- [ ] **Step 1: Write the failing tests** (jsdom): renders the content's text; typing "!" at the end calls `onChange` with normalised JSON containing the text and no `null` attrs; a `content` prop change re-hydrates the editor; the registry returns the editor while mounted and `null` after unmount.

```tsx
// tests/unit/features/proposals/editor/content-section-editor.test.tsx (excerpt)
import { render, screen, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ContentSectionEditor, doc, getEditor, paragraph, text } from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'

const SAMPLE_BRANDING = buildPublicBranding({ business_name: 'Sam MC' })

it('emits normalised JSON on change and registers its editor', async () => {
  const onChange = vi.fn()
  render(<ContentSectionEditor sectionId="s1" content={doc(paragraph(text('Hello')))} branding={SAMPLE_BRANDING} onChange={onChange} onFocusSection={() => {}} onNodeSelect={() => {}} />)
  expect(screen.getByText('Hello')).toBeInTheDocument()
  const editor = getEditor('s1')
  expect(editor).not.toBeNull()
  act(() => { editor!.commands.insertContentAt(editor!.state.doc.content.size - 1, '!') })
  const last = onChange.mock.calls.at(-1)?.[1]
  expect(JSON.stringify(last)).toContain('Hello!')
  expect(JSON.stringify(last)).not.toContain('null')
})
```

`buildPublicBranding` is the fixture Phase 1's render tests use (`tests/unit/features/proposals/render/layout.test.tsx`); check its import path there before writing the test.

- [ ] **Step 2: Run to verify failure**, **Step 3: Implement**, **Step 4: Run tests + typecheck + `npx eslint features/proposals`**, **Step 5: Report**

---

### Task 6: The section canvas: sortable sections, selection, add lines, keyboard

**Files:**
- Create: `features/proposals/editor/section-canvas.tsx`, `features/proposals/editor/editable-section.tsx`, `features/proposals/editor/add-line.tsx`, `features/proposals/editor/use-canvas-keys.ts`
- Test: `tests/unit/features/proposals/editor/section-canvas.test.tsx`

**Interfaces:**
- Consumes: `useLayoutEditor` output (Task 3) passed in as props; `ContentSectionEditor` (Task 5); `SectionView` (Phase 1, `mode: 'edit'`) for data kinds; `sectionCss` from `../render/section-style`; dnd-kit `DndContext` + `SortableContext` + `useSortable` (the same pattern as `app/(dashboard)/branding/blocks/block-frame.tsx`; read it for the sensor and modifier setup, do not import it).
- Produces:
```ts
export interface SectionCanvasProps {
  state: LayoutEditorState
  dispatch: (action: LayoutAction, opts?: { commit?: boolean }) => void
  branding: PublicBranding
  device: CanvasDevice
  /** Opens the add palette at an index (Task 8 supplies the palette; here it is a callback). */
  onRequestAdd: (at: number) => void
}
export function SectionCanvas(props: SectionCanvasProps): JSX.Element
```
- `EditableSection`: wraps one section in a `useSortable` item: a left-gutter drag handle (`aria-label="Move section"`, `GripVertical` icon, visible on hover/selection), the selection outline (`ring-2 ring-brand-fg` when `state.selection.sectionId === section.id`), click on the gutter or on a data section selects it (`dispatch({ type: 'select', sectionId })`), a content section renders `ContentSectionEditor` inside the section's own frame (`sectionCss(section.style, 'edit')` for background, padding, column width, so the canvas looks like the page), a data section renders `<SectionView mode="edit" .../>` under a transparent overlay that captures the click. `hideOnMobile` on the mobile device renders the section at `opacity-40` with an `EyeOff` badge "Hidden on phones" (never removed).
- `AddLine`: the `+` line between sections shown on hover (`aria-label="Add section here"`), and the trailing `Button variant="outline"` "Add section"; both call `onRequestAdd(index)`.
- `use-canvas-keys.ts`: a window `keydown` handler active while a section is selected and no editor has focus: `Escape` steps out (node -> section -> none: `dispatch({ type: 'selectNode', node: null })` then `select null`), `Alt+ArrowUp/Down` moves the section, `Meta+D` duplicates, `Backspace`/`Delete` deletes an empty content section outright (a doc with no text and no atom nodes) and otherwise opens a `ConfirmDialog` ("Delete this section?"), `Meta+Z` / `Shift+Meta+Z` call `undo`/`redo` (passed in). When a TipTap editor has focus, TipTap handles the keys except `Escape`, which blurs the editor and selects its section.

- [ ] **Step 1: Write the failing tests**: renders one editable section per layout section in order; clicking a data section's overlay selects it (outline present); `Alt+ArrowDown` on a selected section moves it; `Meta+D` duplicates; `Delete` on an empty content section removes it without a dialog; `Delete` on a non-empty section shows the confirm dialog; the "Add section here" line calls `onRequestAdd` with the right index; on `device="mobile"` a `hideOnMobile` section shows the "Hidden on phones" badge. Mock dnd-kit's sensors as the Branding block tests do (`tests/unit/app/branding/*` has the pattern; copy the mock, do not import from there).

- [ ] **Step 2: Run to verify failure**, **Step 3: Implement** (files ≤ 150 lines each; `section-canvas.tsx` owns `DndContext`/`SortableContext` and maps sections to `EditableSection`; `onDragEnd` dispatches `moveSection` with `{ commit: true }`), **Step 4: Run tests + gates**, **Step 5: Report**

---

### Task 7: Node views and node-level resizing

**Files:**
- Create: `features/proposals/editor/node-views/image-view.tsx`, `button-view.tsx`, `embed-view.tsx`, `audio-view.tsx`, `columns-view.tsx`, `spacer-view.tsx`, `node-views/index.ts`
- Modify: `features/proposals/editor/extensions/{image,button,embed,audio,columns,spacer}.ts` (add `addNodeView` returning `ReactNodeViewRenderer(View)` when `nodeViews` is on)
- Test: `tests/unit/features/proposals/editor/node-views.test.tsx`

**Interfaces:**
- Consumes: `ResizeGrip`, `dragValue` (Task 2); the renderer's node components from `../render/rich-doc.tsx` for the visual (`ImageNode`, `ButtonNode`, `EmbedNode`, `AudioNode` are module-private today: export them from `rich-doc.tsx` as `RichDocNodeViews` in this task, or move them to `render/rich-doc-nodes.tsx` (the split the final Phase 1 review suggested) and re-export; the renderer's output must not change: keep `tests/unit/features/proposals/render/rich-doc.test.tsx` green).
- Behaviour: every view is a `NodeViewWrapper` that renders the same markup the page renders (so the canvas is WYSIWYG), adds `data-node-type`, and on click calls `selectNode()` (TipTap `NodeSelection`). When `selected`:
  - image: four corner grips (`ResizeGrip axis="x"`, proportional: writes `widthPct` from the drag as a percentage of the column width measured from the wrapper's `offsetParent`, snaps 25 / 33 / 50 / 100, tolerance 3) and two side grips (same value, non-proportional); `updateAttributes({ widthPct })`.
  - columns: one gutter grip per boundary (`axis="x"`), writes the two neighbouring `ratio`s (sum preserved), snaps at 1/2 and 1/3 boundaries (tolerance 0.03); readout shows `50 / 50`.
  - spacer: bottom-edge grip, `heightPx` 8..160, step 8.
  - button, embed, audio: selection ring only (their attributes are edited from the node bar, Task 11).
- Node views never dispatch to the layout store directly; `updateAttributes` changes the TipTap document and the existing `onUpdate` path carries it to the store.

- [ ] **Step 1: Write the failing tests**: mount a `ContentSectionEditor` whose content has an image, columns and a spacer; clicking the image wrapper makes `editor.state.selection` a `NodeSelection` of type `image` and `onNodeSelect` reports `{ nodeType: 'image' }`; dragging the image side grip 30 screen px in a 300 px column changes `widthPct` by 10 and snaps to 50 when within tolerance; the spacer grip steps by 8; the columns gutter writes complementary ratios.

- [ ] **Step 2: Run to verify failure**, **Step 3: Implement** (each view ≤ 120 lines; the shared grip-placement wrapper `NodeGrips` lives in `node-views/index.ts`), **Step 4: Run tests + gates**, **Step 5: Report**

---

### Task 8: The add palette and the in-text insert menu

**Files:**
- Create: `features/proposals/editor/add-palette.tsx`, `features/proposals/editor/extensions/slash-menu.ts`, `features/proposals/editor/insert-items.ts`
- Modify: `features/proposals/editor/extensions/index.ts` (register the slash suggestion), `features/proposals/editor/section-canvas.tsx` (mount the palette from `onRequestAdd`)
- Test: `tests/unit/features/proposals/editor/add-palette.test.tsx`, `tests/unit/features/proposals/editor/insert-items.test.ts`

**Interfaces:**
- `AddPalette` props: `{ open: boolean; at: number | null; onOpenChange: (o: boolean) => void; onAdd: (section: Section, at: number) => void; role: ProposalRole }`. Two tabs (`role="tablist"`): **Sections** (Text, Packages, Gallery, Video, Testimonials, FAQ, Accept, from `newSectionFor(kind)`) and **Presets** (from `PRESET_IDS` / `PRESET_LABELS`, `presetSection(id, role)`). Built on `MenuPanel` inside a Radix `Popover` anchored to the add line, or `Modal` when opened from the trailing button (whichever `open` came from; pass `anchor?: HTMLElement`).
- `insert-items.ts`: the single list both the slash menu and the text bar's `+` use:
```ts
export interface InsertItem { id: string; label: string; icon: LucideIcon; run: (editor: Editor) => void }
export const INSERT_ITEMS: readonly InsertItem[]  // heading (1..3 as three items), image (opens the upload flow via a callback registered on the editor storage), button, columns 2, columns 3, embed (prompts for a url via the node bar after insertion of a placeholder), audio, divider, spacer, table 3x3, variable (opens the variable list)
```
- `slash-menu.ts`: `@tiptap/suggestion` on the `/` char at the start of an empty paragraph (or after a space), rendering `INSERT_ITEMS` filtered by the query in a `MenuPanel` (reuse the render/positioning pattern of `components/ui/variable-suggestion.tsx`; read it first). Enter runs the item and deletes the `/query` text.
- Image and audio uploads use `features/proposals/data/media.ts`: `uploadProposalMediaFile(file, kind: 'image' | 'audio' | 'video' | 'background', onProgress)` mirroring `app/(dashboard)/branding/upload-proposal-media.ts` (raw XHR to the `proposal-media` bucket, session token, path `${userId}/${kind}/${nanoid}.${ext}`); the module cannot import the Branding file. Type/size caps: image 10 MB (`image/jpeg`, `image/png`, `image/webp`, `image/gif`), audio 25 MB (`audio/mpeg`, `audio/mp4`, `audio/x-m4a`, `audio/wav`), video 50 MB (`video/mp4`, `video/webm`). Also export `MEDIA_LIMITS` for the bars' error copy.

- [ ] **Step 1: Write the failing tests**: palette lists seven sections and seven presets by role name; choosing "How it works" calls `onAdd` with a section whose content has an H2 and a `columns` node at the given index; `INSERT_ITEMS` covers heading/image/button/columns/embed/audio/divider/spacer/table/variable; running the `divider` item on a test editor inserts a `horizontalRule`; the slash menu opens on `/` in an empty paragraph (suggestion `items` returns the filtered list for query `div`).

- [ ] **Step 2: Run to verify failure**, **Step 3: Implement**, **Step 4: Run tests + gates**, **Step 5: Report**

---

### Task 9: The section bar

**Files:**
- Create: `features/proposals/editor/bars/section-bar.tsx`, `features/proposals/editor/bars/section-background.tsx`, `features/proposals/editor/bars/bar-shell.tsx`, `features/proposals/editor/bars/override-dot.tsx`
- Test: `tests/unit/features/proposals/editor/section-bar.test.tsx`

**Interfaces:**
- Consumes: `components/editor` primitives (`ActiveTargetLabel`, `PillToggle`, `Select` size `xs`, `Slider`, `NumberStepper`, `ToolbarDivider`), `ColorPopover`, `Tooltip`, `MenuPanel`/`MenuItem`, `ConfirmDialog`; `CONTENT_WIDTH_PX`, `SECTION_PADDING_PX`; `uploadProposalMediaFile` (Task 8); `newSectionFor(kind).style` for the override dots' baseline.
- Produces:
```ts
export interface SectionBarProps {
  section: Section
  isFirst: boolean
  dispatch: SectionCanvasProps['dispatch']
  /** The canvas scroll element; the bar is positioned inside it, never over the page chrome. */
  boundsRef: RefObject<HTMLElement | null>
}
export function SectionBar(props: SectionBarProps): JSX.Element
/** One 32px row that measures itself and moves trailing controls into a `...` menu when it would not fit (380px minimum). */
export function BarShell({ children, overflow }: { children: ReactNode; overflow?: ReactNode }): JSX.Element
/** The small dot on a control whose value differs from the section's starting style. */
export function OverrideDot({ active }: { active: boolean }): JSX.Element | null
```
- Controls, in order (spec section 4): section `name` (an `Input`-styled inline field via a ghost `Button` that turns into `Input`, same pattern as the templates row), Background (a swatch button opening a popover with tabs Colour / Image / Video and an Overlay `Slider` 0..100; image and video upload through `uploadProposalMediaFile('background' | 'video')`, showing `<Button loading>` during upload), Width (`PillToggle` narrow / medium / wide; a dragged px value shows as a fourth pill "Custom 812px"), Height (`PillToggle` fit / full), Padding (icon button opening a popover with a `Slider` 0..240 that snaps to the three stops, readout in px), Text colour (`ColorPopover` with the brand swatches, plus "Use page colour" to clear), Align (`PillToggle` left / center with icons), then `...`: Hide on phone (checkbox row), Duplicate, Reset style, Delete (confirm when the section has content). Data kinds add nothing in Phase 2 (Layout / Include arrive in Phase 3).
- Every write is `dispatch({ type: 'updateStyle', id, patch })`; sliders dispatch without commit while dragging and `{ commit: true }` on release.

- [ ] **Step 1: Write the failing tests**: renders the section name; Width pill "Wide" dispatches `updateStyle { contentWidth: 'wide' }`; Height "Full" dispatches `{ height: 'full' }`; the override dot shows on Width when the value differs from the kind's default and not otherwise; the `...` menu's Delete opens a confirm for a non-empty section and dispatches `deleteSection` after confirming; Background > Overlay slider change dispatches `background.overlay`; the bar exposes `role="toolbar"` with `aria-label="Section"`.

- [ ] **Step 2: Run to verify failure**, **Step 3: Implement** (`section-bar.tsx` ≤ 150 lines; background popover in its own file; the `...` menu in the bar file), **Step 4: Run tests + gates**, **Step 5: Report**

---

### Task 10: The text bar

**Files:**
- Create: `features/proposals/editor/bars/text-bar.tsx`, `features/proposals/editor/bars/link-popover.tsx`, `features/proposals/editor/bars/text-bar-style.ts`
- Test: `tests/unit/features/proposals/editor/text-bar.test.tsx`

**Interfaces:**
- Consumes: the registered TipTap `Editor` (`useRegisteredEditor(selection.sectionId)`), `BubbleMenu` from `@tiptap/react/menus` (the same import the Branding `rich-text.tsx` uses; read it for the `shouldShow` guard that keeps the menu open while its own popovers have focus and copy the `bubbleShouldShow` rule), `HEADING_FONTS`/`BODY_FONTS` + `RICH_TEXT_FONT_SIZES` from `@/lib/branding`, `INSERT_ITEMS` (Task 8), `PROPOSAL_VARIABLES`.
- Controls (spec section 4): Style `Select` (Heading 1 / Heading 2 / Heading 3 / Paragraph) · font `Select` · size `Select` · weight `PillToggle` (Regular / Bold via the `bold` mark) · colour `ColorPopover` (`textStyle.color`) · B I U S toggles · align `PillToggle` (left / center / right, `setTextAlign`) · list toggle (bullet / ordered) · link (opens `LinkPopover`: `Input` for the URL, Apply / Remove, validates `https?:`, `mailto:`, `tel:` like the schema) · `+` insert menu (`INSERT_ITEMS`) · `Aa` case `Select` (None / Sentence / Capitalize / UPPER / lower via the `textCase` mark). `text-bar-style.ts` holds the pure `readTextState(editor)` (active marks/attrs) and `applyTextStyle(editor, patch)` helpers so the bar file stays a thin row.
- `Meta+K` inside the editor opens the link popover (Task 15 wires the key; expose `openLink()` from the bar via a ref now).

- [ ] **Step 1: Write the failing tests**: with a test editor selecting the word "Hello", the bar renders `role="toolbar"` `aria-label="Text"`; clicking Bold toggles the `bold` mark on the selection; choosing "Heading 2" converts the paragraph; the link popover applies `https://zebri.com.au` and rejects `javascript:alert(1)` with an error message; `Aa` "UPPER" sets the `textCase` mark with `value: 'uppercase'`. `readTextState` unit tests cover heading level detection and active marks.

- [ ] **Step 2: Run to verify failure**, **Step 3: Implement**, **Step 4: Run tests + gates**, **Step 5: Report**

---

### Task 11: The node bars

**Files:**
- Create: `features/proposals/editor/bars/node-bar.tsx`, `bars/node-bar-image.tsx`, `bars/node-bar-button.tsx`, `bars/node-bar-misc.tsx` (embed, audio, columns, spacer)
- Test: `tests/unit/features/proposals/editor/node-bar.test.tsx`

**Interfaces:**
- `NodeBar` props: `{ node: NonNullable<NodeSelection>; editor: Editor }`; it reads the selected node's attrs from `editor.state.doc.nodeAt(node.pos)` and writes with `editor.chain().focus().updateAttributes(type, patch).run()`; `Remove` deletes the node (`deleteSelection`).
- image: layout `PillToggle` (inline / left / right / full) · width `NumberStepper` 20..100 % step 5 · caption (`Input` in a popover) · alt (`Input` in the same popover, required for the page: an empty alt shows an `OverrideDot`-style warning dot with tooltip "Add alt text") · Replace (upload) · Remove.
- button: label `Input` · action `Select` (Link / Accept / Decline / Jump to section, Link shows a URL `Input`, Jump shows a `Select` of section names) · variant `PillToggle` · size `PillToggle` · colour `ColorPopover` · radius `NumberStepper` 0..40 · align `PillToggle`.
- embed: Replace link (`Input` + Apply; rejects hosts outside `EMBED_PROVIDERS` with the message "That site cannot be embedded") · Remove. audio: title `Input` · Replace (upload) · Remove. columns: `PillToggle` 2 / 3 (`setColumnCount`: adds an equal column or merges the last into its neighbour) · Reset ratio. spacer: height `NumberStepper` 8..160 step 8.

- [ ] **Step 1: Write the failing tests**: for each node type mount a test editor with that node selected and assert the bar's `aria-label` (`Image`, `Button`, `Embed`, `Audio`, `Columns`, `Spacer`) and one representative write per bar (image layout -> attrs.layout; button label -> attrs.label; embed rejects `https://evil.example/x`; columns 3 -> three columns with ratio 1/3; spacer stepper -> heightPx 32; Remove deletes the node).

- [ ] **Step 2: Run to verify failure**, **Step 3: Implement** (each file ≤ 150 lines), **Step 4: Run tests + gates**, **Step 5: Report**

---

### Task 12: Section resizing: height grip and width handles

**Files:**
- Create: `features/proposals/editor/resize/section-height-grip.tsx`, `features/proposals/editor/resize/section-width-handles.tsx`, `features/proposals/editor/resize/section-resize-math.ts`
- Modify: `features/proposals/editor/editable-section.tsx` (mount both when the section is selected)
- Test: `tests/unit/features/proposals/editor/section-resize.test.tsx`, `tests/unit/features/proposals/editor/section-resize-math.test.ts`

**Interfaces:**
```ts
// section-resize-math.ts (pure)
export const PADDING_SNAPS: readonly Snap[]      // compact 32, cozy 48, roomy 64 with labels
export const WIDTH_SNAPS: readonly Snap[]        // narrow 560, medium 720, wide 1100 with labels
export function paddingToPx(p: SectionStyle['padding']): number
export function widthToPx(w: SectionStyle['contentWidth']): number
/** A px value that lands on a stop is stored as the stop's name, otherwise as the number. */
export function pxToPadding(px: number): SectionStyle['padding']
export function pxToWidth(px: number): SectionStyle['contentWidth']
/** Dragging past one canvas viewport height toggles `height: 'full'`; the threshold in layout px. */
export const FULL_HEIGHT_THRESHOLD_PX = 720
```
- Height grip: `ResizeGrip axis="y"` on the section's bottom edge, `value = paddingToPx(style.padding)`, min 0, max 240, `snaps = PADDING_SNAPS`, tolerance 6, readout label or `${px}px`; `onChange` dispatches `updateStyle { padding: pxToPadding(px) }` uncommitted, `onCommit` commits. When the dragged content height (measured wrapper `offsetHeight`) exceeds `FULL_HEIGHT_THRESHOLD_PX`, the readout shows "Full screen" and `onCommit` dispatches `{ height: 'full' }` instead.
- Width handles: two `ResizeGrip axis="x"` on the content column's outline (left grip mirrors the right: dragging either changes the total width symmetrically), `value = widthToPx(style.contentWidth)`, min 320, max 1400, `snaps = WIDTH_SNAPS`, tolerance 16; dispatches `updateStyle { contentWidth: pxToWidth(px) }`.

- [ ] **Step 1: Write the failing tests**: math: `pxToPadding(48)` is `'cozy'`, `pxToPadding(50)` is `50`, `widthToPx('wide')` is 1100; component: with a selected content section, the height grip is present (`role="slider"`, name "Section height"), dragging 20 px from cozy dispatches `updateStyle` with a numeric padding and snaps back to `'roomy'` at 64; the width grips dispatch `contentWidth: 'medium'` when dragged within tolerance of 720.

- [ ] **Step 2: Run to verify failure**, **Step 3: Implement**, **Step 4: Run tests + gates**, **Step 5: Report**

---

### Task 13: Mobile canvas

**Files:**
- Modify: `features/proposals/editor/editor-styles.ts` (stacking rules), `features/proposals/editor/editable-section.tsx` (device-aware frame width), `features/proposals/editor/section-canvas.tsx` (`data-canvas={device}` on the root)
- Test: `tests/unit/features/proposals/editor/mobile-canvas.test.tsx`

**Behaviour (spec section 3.6):** the canvas root carries `data-canvas="mobile"` and is 380 px wide inside `CanvasFrame device="mobile"`. The renderer stacks with viewport `max-md:` classes, which never fire inside a desktop-width editor, so the editor's own stacking is driven by the attribute: `EDITOR_PROSE_CLASS` gets `[[data-canvas=mobile]_&_[data-columns]]:flex-col`, `[[data-canvas=mobile]_&_figure]:!w-full`, `[[data-canvas=mobile]_&_figure]:float-none` and the section frame drops its px `contentWidth` to `100%` on mobile. `hideOnMobile` sections render dimmed with the eye-off badge (Task 6) and are still selectable and editable. Section width handles are hidden on the mobile canvas (there is no width to drag).

- [ ] **Step 1: Write the failing tests**: with `device="mobile"` the canvas root has `data-canvas="mobile"` and a width of 380 px; a section with `contentWidth: 900` renders its column at `100%`; the width handles are absent; on desktop they are present.

- [ ] **Step 2: Run to verify failure**, **Step 3: Implement**, **Step 4: Run tests + gates**, **Step 5: Report**

---

### Task 14: Template editor shell, autosave and the route

**Files:**
- Create: `features/proposals/editor/template-editor.tsx`, `features/proposals/editor/editor-header.tsx`, `features/proposals/editor/use-template-autosave.ts`, `app/(dashboard)/proposals/templates/[id]/page.tsx`
- Modify: `features/proposals/index.ts` (export `TemplateEditor`), `app/(dashboard)/proposals/templates/template-row.tsx` (Open becomes a `Link` to `/proposals/templates/${id}`; the tooltip goes), `features/proposals/data/templates.ts` only if `updateTemplateLayoutAction` needs a `updatedAt` echo (read it first; it returns `{ ok: true }` today, which is enough)
- Test: `tests/unit/features/proposals/editor/template-editor.test.tsx`, `tests/unit/app/proposals/templates-list.test.tsx` (Open link), `tests/integration/proposals/template-editor-save.test.ts`

**Interfaces:**
```ts
export function TemplateEditor({ templateId }: { templateId: string }): JSX.Element
```
- Loads with `getTemplateAction(templateId)` through react-query (`useQuery`, key `['proposal-template', id]`), shows `Loading` / `ErrorState` / `Empty` ("Template not found"), then mounts `useLayoutEditor(template.layout)`; also loads the account branding through the existing `useCurrentBranding` (`lib/branding/use-current-branding.ts`, read it) so the canvas renders with the real brand kit.
- `use-template-autosave.ts`: `useAutosave(layout, save, 800)` where `save` runs `parseProposalLayout` first (an invalid layout is a bug: `logger.error('proposal_layout_invalid_editor', ...)` and skip the save so the server never sees it) then `updateTemplateLayoutAction({ id, layout: toPlainJSON(layout) })`; `formatSaveStatus` feeds the header's status text.
- `EditorHeader` (one row, `h-12`): back link "Templates" (`ArrowLeft`), the template name (click to rename, `renameTemplateAction`, same pattern as the row), save status, Undo / Redo icon buttons (disabled by `canUndo`/`canRedo`), device `PillToggle` (desktop / mobile) and the `CanvasFrame` zoom widget stays inside the frame. No "Save" button (autosave) and no "Preview" yet (the public page is Phase 4).
- Layout: header, then `CanvasFrame device zoom page wide` containing `SectionCanvas`; the active bar (`SectionBar` when a section is selected and no node; `NodeBar` when a node is selected; `TextBar` is TipTap's bubble and mounts itself) renders in a sticky strip at the top of the canvas scroll area (`boundsRef`), never over the header.
- Route `app/(dashboard)/proposals/templates/[id]/page.tsx`: server component, `notFound()` when the flag is off, renders `<TemplateEditor templateId={id} />` (client). The templates route layout from Phase 1 pads every `/proposals` route; the editor needs full width, so the page renders inside a `-mx-6 sm:-mx-[3.75rem]` wrapper with a why-comment, or (better) the Phase 1 `layout.tsx` moves its gutter into a `ProposalsFrame` component that the editor page opts out of. Pick the second when it stays under 30 lines of change.

- [ ] **Step 1: Write the failing tests**: unit: mocks `getTemplateAction` to return a template and asserts the canvas renders its sections, that editing a section style calls `updateTemplateLayoutAction` once after the debounce with a layout that passes `parseProposalLayout`, that Undo is enabled after an edit and disabled after undoing, and that the header shows "Saved". Templates list: Open is a link to `/proposals/templates/<id>` and is enabled. Integration: create a template through `createTemplateAction`, call `updateTemplateLayoutAction` with a layout produced by `normaliseEditorJSON` of a doc containing every node type, read it back with `getTemplateAction` and assert deep equality; cross-tenant: another user's `updateTemplateLayoutAction` on that id returns `ok: false` and the row is unchanged.

- [ ] **Step 2: Run to verify failure**, **Step 3: Implement**, **Step 4: Run tests + all gates (`npm run typecheck`, strict, lint, unit, `npx vitest run --project integration tests/integration/proposals`)**, **Step 5: Report**

---

### Task 15: Keyboard, history wiring and edge cases

**Files:**
- Modify: `features/proposals/editor/use-canvas-keys.ts`, `features/proposals/editor/content-section-editor.tsx` (keymap extension for `Mod-k`, `Escape`), `features/proposals/editor/template-editor.tsx` (undo/redo re-hydration of open editors), `features/proposals/editor/bars/text-bar.tsx` (`openLink` on `Mod-k`)
- Test: `tests/unit/features/proposals/editor/keyboard.test.tsx`

**Behaviour (spec section 3.5):** `Meta+Z` / `Shift+Meta+Z` (and `Ctrl` on non-Mac) undo/redo the layout history whether focus is on the canvas or inside an editor (TipTap's history is off; a keymap extension forwards the keys to the layout hook through the editor storage); after undo/redo every mounted `ContentSectionEditor` whose section content changed re-hydrates (Task 5) and the selection is cleared to section level. `Mod-k` opens the link popover; `Mod-b/i/u` are TipTap defaults. `Backspace` on an empty selected section deletes it; `Escape` steps out one level. The 40-section cap surfaces in the palette as a disabled state with tooltip "Templates hold up to 40 sections".

- [ ] **Step 1: Write the failing tests**: type into a section, wait past the commit debounce, press `Meta+Z` while the editor has focus: the editor's text reverts and `canUndo` is false; `Shift+Meta+Z` reapplies; `Mod-k` opens the link popover; adding a 41st section from the palette is disabled with the tooltip text.

- [ ] **Step 2: Run to verify failure**, **Step 3: Implement**, **Step 4: Run tests + gates**, **Step 5: Report**

---

### Task 16: Docs, design-system entries and full verification

**Files:**
- Modify: `.claude/docs/page-specs.md` (Templates editor: selection model, bars, palette, resizing, keyboard, mobile canvas, autosave), `.claude/docs/frontend-design.md` (editor primitives: already added in Task 1; add the bar rules), `.claude/docs/proposals.md` (Phase 2 section, editor architecture, one-history rule, media limits), `.claude/docs/testing.md` (new test files and the dnd-kit / TipTap test patterns), `.claude/docs/security.md` (media upload limits row; embed allowlist unchanged), `.claude/docs/production-readiness.md` (roadmap line: Phase 2 built), `CONTRIBUTING.md` (`components/editor/` in the layering summary)
- Verify: every gate; grep for U+2014 (`grep -rnP "\x{2014}"`) across every file this plan touched (no em dashes); the ~150-line guideline (list any file over it with the reason)

- [ ] **Step 1: Update the docs** (facts only: every path, prop and limit named must exist in the working tree)
- [ ] **Step 2: Run everything**: `npm run typecheck`, `npm run typecheck:strict`, `npm run lint:gate`, `npx vitest run --project unit`, `npx vitest run --project integration tests/integration/proposals tests/integration/rls/proposal-templates.test.ts tests/integration/rls/proposal-settings.test.ts`, `node scripts/check-server-action-exports.mjs`, `node scripts/check-no-service-role-in-client.mjs`
- [ ] **Step 3: Live check (controller):** with `NEXT_PUBLIC_PROPOSAL_LAYOUT_V2=1` on an isolated dev server against local Supabase: open a template, add a preset, type, drag a section, resize an image, insert columns, switch to the mobile canvas, reload and confirm the edits persisted, undo across a section move and a text edit.
- [ ] **Step 4: Report** (no commit)

---

## Self-review notes

- Spec coverage (section 8 item 2): section editor for content sections (Tasks 5, 6), three bars (9, 10, 11), palette + presets (8), resize engine (2, 7, 12), mobile canvas (13), `components/editor/` extraction (1, 2). Section 3.1 selection levels (3, 6, 7), 3.2 adding (8), 3.3 moving (6; node drag within a section is TipTap's built-in `draggable` on atom nodes, cross-section node drag is deferred to Phase 5 as a polish item), 3.4 resizing (2, 7, 12), 3.5 keyboard (6, 15), 3.6 mobile (13), 4 bars (9, 10, 11), 5.1 `/proposals/templates/[id]` (14), 5.3 module boundary (all tasks), 9 testing (every task), 10 security (8 upload caps, 4 embed allowlist, 14 parse-before-save), 11 docs (1, 16).
- Out of scope for this phase, by the spec's phasing: data-section editing (Layout / Include controls, quantities, gallery, video, testimonials, FAQ, accept editing) is Phase 3; per-proposal Design mode, page settings, role picker on first run, and the public page serving v2 are Phase 4; section nav, wider font library, Branding toolbar rebuild are Phase 5.
- Type consistency: `Selection`, `NodeSelection`, `LayoutAction`, `dispatch` signature are defined once in Task 3 and consumed verbatim by Tasks 6, 7, 9, 11, 12, 14, 15; `ResizeGrip`/`Snap` from Task 2 are consumed by 7 and 12; `INSERT_ITEMS` from Task 8 by 10; `uploadProposalMediaFile` from Task 8 by 9 and 11; `EDITOR_PROSE_CLASS` from Task 5 by 13.
