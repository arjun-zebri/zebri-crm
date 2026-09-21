// tests/unit/features/proposals/editor/mobile-canvas.test.tsx
/**
 * Task 13: the mobile canvas. `SectionCanvas`'s own root carries
 * `data-canvas="mobile"` and a 380px width (spec 3.6); a content
 * section's column width stays whatever the layout stores (no JS
 * override, see `content-section-frame.tsx`) but picks up a CSS rule
 * that pins it to 100% while that ancestor attribute is set; and the
 * section width handles (`resize/section-width-handles.tsx`, Task 12) do
 * not mount on the mobile canvas, since there is no width to drag once
 * the column is pinned full width. The height grip is unaffected.
 */
import { render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import {
  SectionCanvas, layoutReducer, newSectionFor,
  type LayoutAction, type LayoutEditorState, type Section,
} from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'

const branding = buildPublicBranding({ business_name: 'Sam MC' })

function makeState(sections: Section[], sectionId: string | null = null): LayoutEditorState {
  return { layout: { version: 2, sections }, selection: { sectionId, node: null }, externalVersion: 0 }
}

/** Mirrors `section-canvas.test.tsx`'s harness: a real reducer behind `useState`. */
function Harness({
  initial, device = 'desktop',
}: {
  initial: LayoutEditorState
  device?: 'desktop' | 'mobile'
}) {
  const [state, setState] = useState(initial)
  const dispatch = (action: LayoutAction) => setState((prev) => layoutReducer(prev, action))
  return <SectionCanvas state={state} dispatch={dispatch} branding={branding} device={device} role="mc" />
}

describe('mobile canvas', () => {
  it('carries data-canvas="mobile" and a 380px width on the canvas root', () => {
    const { container } = render(<Harness initial={makeState([newSectionFor('content')])} device="mobile" />)
    const root = container.querySelector('[data-canvas]')
    expect(root).not.toBeNull()
    expect(root!.getAttribute('data-canvas')).toBe('mobile')
    expect(root!.className).toContain('w-[380px]')
  })

  it('does not stamp data-canvas="mobile" or the 380px width on the desktop canvas', () => {
    const { container } = render(<Harness initial={makeState([newSectionFor('content')])} device="desktop" />)
    const root = container.querySelector('[data-canvas]')
    expect(root!.getAttribute('data-canvas')).toBe('desktop')
    expect(root!.className).not.toContain('w-[380px]')
  })

  it('a numeric contentWidth is left untouched on the stored style, and the column picks up the mobile override class, on the mobile canvas', () => {
    const base = newSectionFor('content')
    const section: Section = { ...base, style: { ...base.style, contentWidth: 900 } }
    const { container } = render(<Harness initial={makeState([section])} device="mobile" />)
    const column = container.querySelector('[data-content-column]') as HTMLElement
    expect(column).not.toBeNull()
    // No JS override: the stored 900px value still reaches the inline style
    // (switching back to desktop must show the same 900px, so the mobile
    // canvas never mutates `contentWidth` to make it look full width).
    expect(column.style.maxWidth).toBe('900px')
    // The CSS-only override that actually pins it to 100% while an
    // ancestor carries data-canvas="mobile" (jsdom does not evaluate CSS
    // attribute selectors, so this asserts the rule is present, not that
    // it visually applies).
    expect(column.className).toContain('[[data-canvas=mobile]_&]:!max-w-full')
  })

  it('a numeric contentWidth still carries the same inline style and override class on the desktop canvas (the rule only ever fires under data-canvas=mobile)', () => {
    const base = newSectionFor('content')
    const section: Section = { ...base, style: { ...base.style, contentWidth: 900 } }
    const { container } = render(<Harness initial={makeState([section])} device="desktop" />)
    const column = container.querySelector('[data-content-column]') as HTMLElement
    expect(column.style.maxWidth).toBe('900px')
    expect(column.className).toContain('[[data-canvas=mobile]_&]:!max-w-full')
  })

  it('hides the section width handles on the mobile canvas but keeps the height grip', () => {
    const section = newSectionFor('content')
    render(<Harness initial={makeState([section], section.id)} device="mobile" />)
    expect(screen.getByRole('slider', { name: 'Section height' })).toBeInTheDocument()
    expect(screen.queryByRole('slider', { name: 'Section width, left edge' })).toBeNull()
    expect(screen.queryByRole('slider', { name: 'Section width, right edge' })).toBeNull()
  })

  it('shows the section width handles for a selected section on the desktop canvas', () => {
    const section = newSectionFor('content')
    render(<Harness initial={makeState([section], section.id)} device="desktop" />)
    expect(screen.getByRole('slider', { name: 'Section height' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Section width, left edge' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Section width, right edge' })).toBeInTheDocument()
  })
})

describe('section alignment on the canvas column', () => {
  // A placeholder is a `::before` floated left (TipTap's recipe, so the
  // caret sits before it) - which ignores `text-align`, so a centred
  // section's empty fields read as left-aligned (live bug 2026-09-19).
  // The column stamps `data-align` so the prose rules can switch a
  // centred/right section's placeholders to inline instead.
  it('a content section and a data section both stamp the alignment on the column, and the placeholder rules key off it', () => {
    const content = newSectionFor('content')
    const packages = newSectionFor('packages')
    const sections: Section[] = [
      { ...content, style: { ...content.style, align: 'center' } },
      { ...packages, style: { ...packages.style, align: 'right' } },
      newSectionFor('faq'),
    ]
    const { container } = render(<Harness initial={makeState(sections)} />)
    const columns = [...container.querySelectorAll('[data-content-column]')] as HTMLElement[]
    expect(columns.map((c) => c.getAttribute('data-align'))).toEqual(['center', 'right', null])
    const prose = container.querySelector('.ProseMirror') as HTMLElement
    expect(prose.className).toContain('[[data-align=center]_&_.is-empty::before]:float-none')
    expect(prose.className).toContain('[[data-align=right]_&_.is-empty::before]:float-none')
  })
})
