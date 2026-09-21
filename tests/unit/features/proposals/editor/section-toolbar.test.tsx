// tests/unit/features/proposals/editor/section-toolbar.test.tsx
/**
 * `SectionToolbar` (UX audit §3.2/3.5 editor-chrome rebuild, replacing
 * `SectionBar`): the section's own anchored toolbar - Style, move
 * up/down, duplicate and delete. Every heavier style control (plus Hide
 * on phone and Reset style, once also duplicated behind a trailing `...`
 * menu here) lives behind the Style button's own popover, covered by
 * `section-style-popover.test.tsx`.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { defaultTheme, doc, newSectionFor, paragraph, SectionToolbar, text, type Section } from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'

const THEME = defaultTheme(buildPublicBranding({ business_name: 'Sam MC' }))

/** A content section, optionally pre-filled with text (empty otherwise, per `isSectionEmpty`). */
function contentSection(body: string | null): Section {
  const section = newSectionFor('content')
  return body === null ? section : { ...section, content: doc(paragraph(text(body))) }
}

function renderToolbar({
  section = contentSection(null), index = 0, total = 1, dispatch = vi.fn(),
}: { section?: Section; index?: number; total?: number; dispatch?: ReturnType<typeof vi.fn> } = {}) {
  const boundsRef = createRef<HTMLElement>()
  render(<SectionToolbar section={section} index={index} total={total} theme={THEME} dispatch={dispatch} boundsRef={boundsRef} />)
  return dispatch
}

describe('SectionToolbar', () => {
  it('exposes role="toolbar" with aria-label="Section"', () => {
    renderToolbar()
    expect(screen.getByRole('toolbar', { name: 'Section' })).toBeInTheDocument()
  })

  it('Move up dispatches moveSection with this index and one above it', () => {
    const dispatch = renderToolbar({ index: 1, total: 3 })
    fireEvent.click(screen.getByRole('button', { name: 'Move up' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'moveSection', from: 1, to: 0 }, { commit: true })
  })

  it('Move down dispatches moveSection with this index and one below it', () => {
    const dispatch = renderToolbar({ index: 1, total: 3 })
    fireEvent.click(screen.getByRole('button', { name: 'Move down' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'moveSection', from: 1, to: 2 }, { commit: true })
  })

  it('disables Move up at the first position and Move down at the last', () => {
    renderToolbar({ index: 0, total: 3 })
    expect(screen.getByRole('button', { name: 'Move up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move down' })).not.toBeDisabled()
  })

  it('Duplicate dispatches duplicateSection', () => {
    const section = contentSection('A')
    const dispatch = renderToolbar({ section })
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'duplicateSection', id: section.id }, { commit: true })
  })

  it('Delete opens a confirm for a non-empty section and dispatches deleteSection once confirmed', () => {
    const section = contentSection('Hello there')
    const dispatch = renderToolbar({ section })

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Delete this section?')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(dispatch).toHaveBeenCalledWith({ type: 'deleteSection', id: section.id }, { commit: true })
  })

  it('Delete removes an empty section outright, with no confirm dialog', () => {
    const section = contentSection(null)
    const dispatch = renderToolbar({ section })

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(dispatch).toHaveBeenCalledWith({ type: 'deleteSection', id: section.id }, { commit: true })
  })

  it('a packages or gallery section gets only Style after Style, same as a content section - their own settings live in the Style popover', () => {
    const names = () => screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))
    renderToolbar({ section: newSectionFor('packages') })
    expect(names()[0]).toBe('Style')
    expect(names()).not.toContain('Packages')
    cleanup()
    renderToolbar({ section: newSectionFor('gallery') })
    expect(names()[0]).toBe('Style')
    expect(names()).not.toContain('Gallery')
    cleanup()
    renderToolbar()
    expect(names()[0]).toBe('Style')
  })
})
