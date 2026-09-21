/**
 * Task 12: the selected section's resize grips (`resize/section-resize-overlay.tsx`
 * and its two presentational children) mounted through the real
 * `SectionCanvas` -> `EditableSection` tree, matching how
 * `section-canvas.test.tsx` exercises Task 6. The height grip drags
 * `SectionStyle.padding`, snapping to a named stop within tolerance; the
 * width handles drag `SectionStyle.contentWidth` symmetrically. Neither
 * grip renders unless the section itself is selected (not a node inside
 * it, and not some other section).
 *
 * @module tests/unit/features/proposals/editor/section-resize
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import {
  newSectionFor, SectionCanvas, type LayoutAction, type LayoutEditorState, type Section,
} from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'

const branding = buildPublicBranding({ business_name: 'Sam MC' })

function makeState(sections: Section[], sectionId: string | null): LayoutEditorState {
  return { layout: { version: 2, sections }, selection: { sectionId, node: null }, externalVersion: 0 }
}

/**
 * Mirrors `section-canvas.test.tsx`'s own harness, plus a `dispatch` spy
 * so a test can inspect exactly what each drag dispatched (the real
 * reducer still runs behind it, so a later drag step sees the layout the
 * previous one produced, the same way `useLayoutEditor` chains dispatches).
 */
function Harness({ initial, dispatchSpy }: { initial: LayoutEditorState; dispatchSpy: ReturnType<typeof vi.fn> }) {
  const [state, setState] = useState(initial)
  const dispatch = (action: LayoutAction, opts?: { commit?: boolean }) => {
    dispatchSpy(action, opts)
    setState((prev) => reduce(prev, action))
  }
  return <SectionCanvas state={state} dispatch={dispatch} branding={branding} device="desktop" role="mc" />
}

// A tiny stand-in for `layoutReducer`'s `updateStyle` branch: the only
// action this test's drags ever dispatch, so the harness does not need
// the full reducer import to keep a chained drag's state moving forward.
function reduce(state: LayoutEditorState, action: LayoutAction): LayoutEditorState {
  if (action.type !== 'updateStyle') return state
  const sections = state.layout.sections.map((s) => (s.id === action.id ? { ...s, style: { ...s.style, ...action.patch } } : s))
  return { ...state, layout: { ...state.layout, sections } }
}

describe('section resize grips', () => {
  it('renders the height and width grips for the selected section', () => {
    const a = newSectionFor('content')
    const b = newSectionFor('content')
    render(<Harness initial={makeState([a, b], a.id)} dispatchSpy={vi.fn()} />)
    expect(screen.getByRole('slider', { name: 'Section height' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Section width, left edge' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Section width, right edge' })).toBeInTheDocument()
  })

  it('renders no grips when nothing is selected', () => {
    const a = newSectionFor('content')
    const b = newSectionFor('content')
    render(<Harness initial={makeState([a, b], null)} dispatchSpy={vi.fn()} />)
    expect(screen.queryByRole('slider', { name: 'Section height' })).toBeNull()
  })

  it('renders no grips while a node inside the selected section is selected', () => {
    const a = newSectionFor('content')
    // A node inside the section selected, not the section itself: the
    // overlay stays hidden so it never fights the node view's own grips.
    const withNode: LayoutEditorState = {
      layout: { version: 2, sections: [a] },
      selection: { sectionId: a.id, node: { sectionId: a.id, nodeType: 'image', pos: 1 } },
      externalVersion: 0,
    }
    render(<Harness initial={withNode} dispatchSpy={vi.fn()} />)
    expect(screen.queryByRole('slider', { name: 'Section height' })).toBeNull()
  })

  it('drags the height grip: a small move reports a numeric padding, a further move snaps to roomy at 64', () => {
    const section = newSectionFor('content') // padding: 'cozy' (48px)
    const dispatchSpy = vi.fn()
    render(<Harness initial={makeState([section], section.id)} dispatchSpy={dispatchSpy} />)
    const grip = screen.getByRole('slider', { name: 'Section height' })

    fireEvent.mouseDown(grip, { clientY: 100 })
    // +8px from 48 = 56: more than 6px (the tolerance) from both cozy (48)
    // and roomy (64), so it stays a plain dragged number.
    fireEvent.mouseMove(window, { clientY: 108 })
    expect(dispatchSpy).toHaveBeenLastCalledWith({ type: 'updateStyle', id: section.id, patch: { padding: 56 } }, undefined)

    // +20px from 48 = 68: within 6px of roomy (64), so the drag locks onto it.
    fireEvent.mouseMove(window, { clientY: 120 })
    expect(dispatchSpy).toHaveBeenLastCalledWith({ type: 'updateStyle', id: section.id, patch: { padding: 'roomy' } }, undefined)
    expect(screen.getByText('Roomy')).toBeInTheDocument()

    fireEvent.mouseUp(window)
    expect(dispatchSpy).toHaveBeenLastCalledWith({ type: 'updateStyle', id: section.id, patch: { padding: 'roomy' } }, { commit: true })
  })

  it('drags a width handle within tolerance of 720 and snaps to medium', () => {
    const base = newSectionFor('content')
    const section: Section = { ...base, style: { ...base.style, contentWidth: 'narrow' } } // 560px
    const dispatchSpy = vi.fn()
    render(<Harness initial={makeState([section], section.id)} dispatchSpy={dispatchSpy} />)
    const grip = screen.getByRole('slider', { name: 'Section width, right edge' })

    fireEvent.mouseDown(grip, { clientX: 100 })
    // scale 0.5 doubles the drag's effect on the value: +84 screen px ->
    // +168 -> 560 + 168 = 728, within the 16px tolerance of medium (720).
    fireEvent.mouseMove(window, { clientX: 184 })
    expect(dispatchSpy).toHaveBeenLastCalledWith({ type: 'updateStyle', id: section.id, patch: { contentWidth: 'medium' } }, undefined)

    fireEvent.mouseUp(window)
    expect(dispatchSpy).toHaveBeenLastCalledWith({ type: 'updateStyle', id: section.id, patch: { contentWidth: 'medium' } }, { commit: true })
  })

  it('the left width handle is inverted: dragging it left (toward the edge) also grows the width', () => {
    const base = newSectionFor('content')
    const section: Section = { ...base, style: { ...base.style, contentWidth: 'narrow' } }
    const dispatchSpy = vi.fn()
    render(<Harness initial={makeState([section], section.id)} dispatchSpy={dispatchSpy} />)
    const grip = screen.getByRole('slider', { name: 'Section width, left edge' })

    fireEvent.mouseDown(grip, { clientX: 100 })
    fireEvent.mouseMove(window, { clientX: 16 }) // -84px screen -> inverted -> same +168 growth as the right edge
    expect(dispatchSpy).toHaveBeenLastCalledWith({ type: 'updateStyle', id: section.id, patch: { contentWidth: 'medium' } }, undefined)
  })
})
