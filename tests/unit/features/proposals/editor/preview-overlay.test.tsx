// tests/unit/features/proposals/editor/preview-overlay.test.tsx
/**
 * Proposal Layout v2 UX audit slice D (§3.7): `PreviewOverlay` renders the
 * editor's live, possibly-unsaved layout through the same
 * `ProposalLayoutView` the public page uses, closes on Escape or its own
 * Close button, and returns focus to whatever the caller wired up as the
 * "was open before" control (the caller's job - see `editor-header.test`
 * cases in `template-editor.test.tsx` for the full round trip through the
 * header's own Preview button).
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { describe, expect, it } from 'vitest'

import { doc, heading, newSectionFor, PreviewOverlay, text, type ProposalLayout, type Section } from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'

const branding = buildPublicBranding({ business_name: 'Sam MC' })

/** One content section whose heading is the thing every test here looks for. */
function heroSection(): Section {
  return { ...newSectionFor('content'), content: doc(heading(1, text('Hello Preview'))) }
}

function layoutWith(sections: Section[]): ProposalLayout {
  return { version: 2, sections }
}

/** A real "Preview" button + the overlay, so Escape/Close focus-return can be asserted end to end - mirrors how `editor-header.tsx` wires the two together. */
function Harness() {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const close = () => {
    setOpen(false)
    buttonRef.current?.focus()
  }
  return (
    <>
      <button ref={buttonRef} type="button" onClick={() => setOpen(true)}>Preview</button>
      <PreviewOverlay
        isOpen={open}
        onClose={close}
        layout={layoutWith([heroSection()])}
        branding={branding}
        initialDevice="desktop"
      />
    </>
  )
}

describe('PreviewOverlay', () => {
  it('renders nothing while closed', () => {
    render(
      <PreviewOverlay isOpen={false} onClose={() => {}} layout={layoutWith([heroSection()])} branding={branding} initialDevice="desktop" />,
    )
    expect(screen.queryByRole('dialog', { name: 'Preview' })).not.toBeInTheDocument()
  })

  it('shows the live layout - the first section\'s heading text - once open', () => {
    render(
      <PreviewOverlay isOpen onClose={() => {}} layout={layoutWith([heroSection()])} branding={branding} initialDevice="desktop" />,
    )
    expect(screen.getByRole('dialog', { name: 'Preview' })).toBeInTheDocument()
    expect(screen.getByText('Hello Preview')).toBeInTheDocument()
  })

  it('focuses the Close button on open', () => {
    render(
      <PreviewOverlay isOpen onClose={() => {}} layout={layoutWith([heroSection()])} branding={branding} initialDevice="desktop" />,
    )
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
  })

  it('Escape closes it and returns focus to the control that opened it', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    expect(screen.getByRole('dialog', { name: 'Preview' })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: 'Preview' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preview' })).toHaveFocus()
  })

  it('its own Close button closes it and returns focus the same way', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog', { name: 'Preview' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preview' })).toHaveFocus()
  })
})
