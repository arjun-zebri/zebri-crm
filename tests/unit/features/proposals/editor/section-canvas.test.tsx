// tests/unit/features/proposals/editor/section-canvas.test.tsx
/**
 * Task 6: `SectionCanvas` renders one `EditableSection` per layout section
 * in order, wires selection (click a data section's overlay), reordering
 * and deletion through the canvas keyboard shortcuts, and the "add section
 * here" insert lines. Task 8 moves the add palette itself inside
 * `SectionCanvas` (`useAddPalette`/`AddPalette`), so the insert-line tests
 * below drive the real palette instead of a mocked `onRequestAdd`.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import {
  defaultTheme, doc, layoutReducer, newSectionFor, paragraph, SectionCanvas, text,
  type LayoutAction, type LayoutEditorState, type ProposalTheme, type Section,
} from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'

const branding = buildPublicBranding({ business_name: 'Sam MC' })

function makeState(sections: Section[], sectionId: string | null = null, theme?: ProposalTheme): LayoutEditorState {
  return { layout: { version: 2, sections, theme }, selection: { sectionId, node: null }, externalVersion: 0 }
}

/** A content section, optionally pre-filled with text (a doc with no text is "empty" per `isSectionEmpty`). */
function contentSection(body: string | null): Section {
  const section = newSectionFor('content')
  return body === null ? section : { ...section, content: doc(paragraph(text(body))) }
}

/**
 * Mirrors `useLayoutEditor`'s real reducer wiring closely enough for these
 * tests: a real `layoutReducer` behind a plain `useState`, so a dispatched
 * action actually changes what's on screen (selection, order, count).
 */
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

function sectionIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[data-canvas-section-id]')).map((el) => el.getAttribute('data-canvas-section-id')!)
}

describe('SectionCanvas', () => {
  it('renders one editable section per layout section, in order', () => {
    const sections = [contentSection('Hi'), newSectionFor('packages'), contentSection('Bye')]
    const { container } = render(<Harness initial={makeState(sections)} />)
    expect(sectionIds(container)).toEqual(sections.map((s) => s.id))
  })

  it('clicking anywhere in a data section (not a real control inside it) selects it', () => {
    const pkg = newSectionFor('packages')
    const { container } = render(<Harness initial={makeState([pkg])} />)
    const wrapper = container.querySelector(`[data-canvas-section-id="${pkg.id}"]`)!
    fireEvent.click(wrapper)
    expect(wrapper.className).toContain('ring-2')
    expect(wrapper.className).toContain('ring-brand-fg')
  })

  it('Alt+ArrowDown moves the selected section down', () => {
    const a = contentSection('A')
    const b = contentSection('B')
    const { container } = render(<Harness initial={makeState([a, b], a.id)} />)
    fireEvent.keyDown(window, { key: 'ArrowDown', altKey: true })
    expect(sectionIds(container)).toEqual([b.id, a.id])
  })

  it('Meta+D duplicates the selected section', () => {
    const a = contentSection('A')
    const { container } = render(<Harness initial={makeState([a], a.id)} />)
    fireEvent.keyDown(window, { key: 'd', metaKey: true })
    expect(sectionIds(container)).toHaveLength(2)
  })

  it('Delete on an empty content section removes it without a dialog', () => {
    const empty = contentSection(null)
    const other = contentSection('Keep me')
    const { container } = render(<Harness initial={makeState([empty, other], empty.id)} />)
    fireEvent.keyDown(window, { key: 'Delete' })
    expect(sectionIds(container)).toEqual([other.id])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Delete on a non-empty section opens the confirm dialog', () => {
    const filled = contentSection('Do not lose this')
    const { container } = render(<Harness initial={makeState([filled], filled.id)} />)
    fireEvent.keyDown(window, { key: 'Delete' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Delete this section?')).toBeInTheDocument()
    // Nothing is removed until the dialog is confirmed.
    expect(sectionIds(container)).toEqual([filled.id])
  })

  it('a section\'s bottom edge "+" opens the palette anchored at that index, and choosing a section inserts it there', () => {
    const sections = [contentSection('A'), contentSection('B')]
    const { container } = render(<Harness initial={makeState(sections)} />)
    // Every section has a top and bottom edge button, all named "Add
    // section" (`section-edge-add.tsx`), plus the trailing button:
    // A-top(@0), A-bottom(@1), B-top(@1), B-bottom(@2), trailing(@2).
    const edges = screen.getAllByRole('button', { name: 'Add section' })
    expect(edges).toHaveLength(5)
    fireEvent.click(edges[1]!) // A's bottom edge: insert between A and B
    fireEvent.click(screen.getByRole('button', { name: 'Add Packages' }))

    const ids = sectionIds(container)
    expect(ids).toHaveLength(3)
    // The new section landed at index 1, between A and B.
    expect(ids[0]).toBe(sections[0]!.id)
    expect(ids[2]).toBe(sections[1]!.id)
    expect(ids[1]).not.toBe(sections[0]!.id)
    expect(ids[1]).not.toBe(sections[1]!.id)
  })

  it('the trailing "Add section" button opens the palette as a modal, appending the chosen section at the end', () => {
    const sections = [contentSection('A')]
    const { container } = render(<Harness initial={makeState(sections)} />)
    // The section's own top/bottom edge buttons share the same accessible
    // name; the trailing button (outside every section) is the last one.
    const buttons = screen.getAllByRole('button', { name: 'Add section' })
    fireEvent.click(buttons.at(-1)!)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add Text' }))

    const ids = sectionIds(container)
    expect(ids).toHaveLength(2)
    expect(ids[0]).toBe(sections[0]!.id)
  })

  it('an empty layout shows the blank-page nudge instead of the bare trailing button, and its button inserts at index 0', () => {
    const { container } = render(<Harness initial={makeState([])} />)
    expect(container.querySelector('[data-canvas-empty]')).toBeInTheDocument()
    expect(screen.getByText('A blank page, all yours')).toBeInTheDocument()
    // Exactly one "Add section" entry point on a blank page: no section
    // edge buttons exist yet, and the trailing line is swapped out.
    const buttons = screen.getAllByRole('button', { name: 'Add section' })
    expect(buttons).toHaveLength(1)
    fireEvent.click(buttons[0]!)
    fireEvent.click(screen.getByRole('button', { name: 'Add Text' }))

    expect(sectionIds(container)).toHaveLength(1)
    // The nudge leaves once a section lands; the normal trailing line is back.
    expect(container.querySelector('[data-canvas-empty]')).not.toBeInTheDocument()
  })

  it('shows the "Hidden on phones" badge for a hideOnMobile section on the mobile device', () => {
    const hidden: Section = { ...contentSection('Desktop only'), hideOnMobile: true }
    render(<Harness initial={makeState([hidden])} device="mobile" />)
    expect(screen.getByText('Hidden on phones')).toBeInTheDocument()
  })

  describe('page breaks', () => {
    it('the palette inserts a page break, which renders as a labelled row with a hint while the flow is Stacked', () => {
      const a = contentSection('A')
      const { container } = render(<Harness initial={makeState([a], null, defaultTheme(branding))} />)
      fireEvent.click(screen.getAllByRole('button', { name: 'Add section' }).at(-1)!)
      fireEvent.click(screen.getByRole('button', { name: 'Add Page break' }))
      const ids = sectionIds(container)
      expect(ids).toHaveLength(2)
      const row = container.querySelector(`[data-canvas-section-id="${ids[1]}"]`)!
      expect(row.getAttribute('data-section-kind')).toBe('pageBreak')
      expect(row).toHaveTextContent('Page break')
      expect(row).toHaveTextContent('Only shown in One at a time')
      // No page wrappers in stack flow: the canvas is the flat list.
      expect(container.querySelector('[data-page-id]')).toBeNull()
    })

    it('Delete on a selected page break removes it with no confirmation', () => {
      const a = contentSection('A')
      const pb = newSectionFor('pageBreak')
      const { container } = render(<Harness initial={makeState([a, pb], pb.id)} />)
      fireEvent.keyDown(window, { key: 'Delete' })
      expect(sectionIds(container)).toEqual([a.id])
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('the row\'s own Remove button deletes it, and clicking the row selects it', () => {
      const a = contentSection('A')
      const pb = newSectionFor('pageBreak')
      const { container } = render(<Harness initial={makeState([a, pb])} />)
      const row = container.querySelector(`[data-canvas-section-id="${pb.id}"]`)!
      fireEvent.click(row)
      expect(row.className).toContain('ring-brand-fg')
      fireEvent.click(screen.getByRole('button', { name: 'Remove page break' }))
      expect(sectionIds(container)).toEqual([a.id])
    })

    it('in step flow the canvas groups sections into pages around the breaks, keeps an empty page\'s break visible, and drops the hint', () => {
      const a = contentSection('A')
      const b = contentSection('B')
      const pb1 = newSectionFor('pageBreak')
      const pb2 = newSectionFor('pageBreak')
      const full: Section = { ...contentSection('Hero'), style: { height: 'full', contentWidth: 'medium' } }
      const { container } = render(<Harness initial={makeState([a, pb1, b, full, pb2], null, { ...defaultTheme(branding), flow: 'step' })} />)
      const pages = Array.from(container.querySelectorAll<HTMLElement>('[data-page-id]'))
      // The trailing break opens a page with nothing on it: no page box, but its row still renders below.
      expect(pages.map((p) => p.getAttribute('data-page-id'))).toEqual(['page-first', pb1.id])
      for (const p of pages) expect(p.getAttribute('style')).toContain('min-height: 80svh')
      // Sections keep their natural height on a page; only `height: 'full'` grows.
      expect(container.querySelector(`[data-canvas-section-id="${a.id}"]`)!.className).not.toContain('grow')
      expect(pages[0]!.querySelector(`[data-canvas-section-id="${a.id}"]`)).not.toBeNull()
      expect(pages[1]!.querySelector(`[data-canvas-section-id="${b.id}"]`)).not.toBeNull()
      // The break rows sit between the pages, never inside one.
      expect(container.querySelector(`[data-page-id] [data-canvas-section-id="${pb1.id}"]`)).toBeNull()
      expect(sectionIds(container)).toEqual([a.id, pb1.id, b.id, full.id, pb2.id])
      expect(container.querySelector(`[data-canvas-section-id="${full.id}"]`)!.className).toContain('grow')
      expect(screen.queryByText('Only shown in One at a time')).toBeNull()
    })
  })
})
