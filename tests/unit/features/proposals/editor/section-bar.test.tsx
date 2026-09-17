// tests/unit/features/proposals/editor/section-bar.test.tsx
/**
 * Task 9: `SectionBar` renders the section's name, writes every style
 * control through `dispatch({ type: 'updateStyle', id, patch })`, shows
 * an override dot only on a control whose value differs from the
 * section kind's starting style, and its `...` menu's Delete reuses
 * `useDeleteSection`'s confirm-for-non-empty-sections flow. Nothing
 * mounts `SectionBar` yet (Task 12 does); these tests render it
 * directly with a mocked `dispatch`.
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

import {
  doc, newSectionFor, paragraph, SectionBar, text, type LayoutAction, type Section,
} from '@/features/proposals'

/** A content section, optionally pre-filled with text (empty otherwise, per `isSectionEmpty`). */
function contentSection(body: string | null): Section {
  const section = newSectionFor('content')
  return body === null ? section : { ...section, content: doc(paragraph(text(body))) }
}

function renderBar(section: Section, dispatch = vi.fn()) {
  const boundsRef = createRef<HTMLElement>()
  render(<SectionBar section={section} isFirst={false} dispatch={dispatch} boundsRef={boundsRef} />)
  return dispatch
}

/** The most recent `updateStyle` patch dispatched, across every call, so far. */
function patches(dispatch: ReturnType<typeof vi.fn>): Array<Partial<Record<string, unknown>>> {
  return dispatch.mock.calls
    .map(([action]) => action as LayoutAction)
    .filter((a): a is Extract<LayoutAction, { type: 'updateStyle' }> => a.type === 'updateStyle')
    .map((a) => a.patch)
}

describe('SectionBar', () => {
  it('exposes role="toolbar" with aria-label="Section"', () => {
    renderBar(contentSection(null))
    expect(screen.getByRole('toolbar', { name: 'Section' })).toBeInTheDocument()
  })

  it("renders the section's name", () => {
    renderBar({ ...contentSection(null), name: 'Welcome' })
    expect(screen.getByText('Welcome')).toBeInTheDocument()
  })

  it('falls back to a kind label when the section has no name', () => {
    renderBar(newSectionFor('packages'))
    expect(screen.getByText('Packages')).toBeInTheDocument()
  })

  it('clicking the Width "Wide" pill dispatches updateStyle with contentWidth: wide', () => {
    const dispatch = renderBar(contentSection(null))
    fireEvent.click(screen.getByRole('button', { name: 'Wide' }))
    expect(patches(dispatch)).toContainEqual(expect.objectContaining({ contentWidth: 'wide' }))
  })

  it('clicking the Height "Full" pill dispatches updateStyle with height: full', () => {
    const dispatch = renderBar(contentSection(null))
    fireEvent.click(screen.getByRole('button', { name: 'Full' }))
    expect(patches(dispatch)).toContainEqual(expect.objectContaining({ height: 'full' }))
  })

  it('shows the override dot on Width only when contentWidth differs from the kind default', () => {
    const fresh = contentSection(null)
    const { unmount } = render(
      <SectionBar section={fresh} isFirst={false} dispatch={vi.fn()} boundsRef={createRef<HTMLElement>()} />,
    )
    expect(within(screen.getByTestId('width-control')).queryByTestId('override-dot')).toBeNull()
    unmount()

    const restyled: Section = { ...fresh, style: { ...fresh.style, contentWidth: 'wide' } }
    render(<SectionBar section={restyled} isFirst={false} dispatch={vi.fn()} boundsRef={createRef<HTMLElement>()} />)
    expect(within(screen.getByTestId('width-control')).getByTestId('override-dot')).toBeInTheDocument()
  })

  it('the "..." menu\'s Delete opens a confirm for a non-empty section and dispatches deleteSection once confirmed', () => {
    const section = contentSection('Hello there')
    const dispatch = renderBar(section)

    fireEvent.click(screen.getByRole('button', { name: 'More section actions' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Delete this section?')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(dispatch).toHaveBeenCalledWith({ type: 'deleteSection', id: section.id }, { commit: true })
  })

  it('the "..." menu\'s Delete removes an empty section outright, with no confirm dialog', () => {
    const section = contentSection(null)
    const dispatch = renderBar(section)

    fireEvent.click(screen.getByRole('button', { name: 'More section actions' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(dispatch).toHaveBeenCalledWith({ type: 'deleteSection', id: section.id }, { commit: true })
  })

  it('Background > Overlay slider change dispatches an updateStyle patch with background.overlay', () => {
    const dispatch = renderBar(contentSection(null))

    fireEvent.click(screen.getByRole('button', { name: 'Background' }))
    const slider = screen.getByRole('slider', { name: 'Overlay' })
    fireEvent.keyDown(slider, { key: 'ArrowRight' })

    expect(patches(dispatch)).toContainEqual(
      expect.objectContaining({ background: expect.objectContaining({ overlay: 1 }) }),
    )
  })

  it('"Use page colour" clears an already-set text colour', () => {
    const withColor: Section = { ...contentSection(null), style: { ...contentSection(null).style, textColor: '#FF0000' } }
    const dispatch = renderBar(withColor)

    fireEvent.click(screen.getByRole('button', { name: 'Use page colour' }))
    expect(patches(dispatch)).toContainEqual({ textColor: undefined })
  })

  it('Padding drags near a named stop snap to it, in px, and commit on release', () => {
    const dispatch = renderBar(contentSection(null))

    fireEvent.click(screen.getByRole('button', { name: 'Padding' }))
    const slider = screen.getByRole('slider', { name: 'Padding' })
    // Fresh 'content' sections start at 'cozy' (48px); nudging by 1 should
    // snap right back to 'cozy' rather than drift to 49.
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(patches(dispatch)).toContainEqual({ padding: 'cozy' })
  })

  it('Duplicate and Reset style dispatch their actions', () => {
    const dispatch = renderBar(contentSection(null))

    fireEvent.click(screen.getByRole('button', { name: 'More section actions' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }))
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'duplicateSection' }), { commit: true })

    fireEvent.click(screen.getByRole('button', { name: 'More section actions' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Reset style' }))
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'resetStyle' }), { commit: true })
  })
})
