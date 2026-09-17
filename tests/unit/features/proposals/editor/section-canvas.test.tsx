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
  doc, layoutReducer, newSectionFor, paragraph, SectionCanvas, text,
  type LayoutAction, type LayoutEditorState, type Section,
} from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'

const branding = buildPublicBranding({ business_name: 'Sam MC' })

function makeState(sections: Section[], sectionId: string | null = null): LayoutEditorState {
  return { layout: { version: 2, sections }, selection: { sectionId, node: null }, externalVersion: 0 }
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

  it("clicking a data section's overlay selects it", () => {
    const pkg = newSectionFor('packages')
    const { container } = render(<Harness initial={makeState([pkg])} />)
    fireEvent.click(screen.getByRole('button', { name: 'Select section' }))
    const wrapper = container.querySelector(`[data-canvas-section-id="${pkg.id}"]`)!
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

  it('the "Add section here" line opens the palette anchored at that index, and choosing a section inserts it there', () => {
    const sections = [contentSection('A'), contentSection('B')]
    const { container } = render(<Harness initial={makeState(sections)} />)
    const lines = screen.getAllByRole('button', { name: 'Add section here' })
    expect(lines).toHaveLength(3) // before A, between A/B, after B
    fireEvent.click(lines[1]!)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Packages' }))

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
    fireEvent.click(screen.getByRole('button', { name: 'Add section' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Text' }))

    const ids = sectionIds(container)
    expect(ids).toHaveLength(2)
    expect(ids[0]).toBe(sections[0]!.id)
  })

  it('shows the "Hidden on phones" badge for a hideOnMobile section on the mobile device', () => {
    const hidden: Section = { ...contentSection('Desktop only'), hideOnMobile: true }
    render(<Harness initial={makeState([hidden])} device="mobile" />)
    expect(screen.getByText('Hidden on phones')).toBeInTheDocument()
  })
})
