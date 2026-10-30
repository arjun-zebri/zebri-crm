/**
 * The editor header's `context` slot and the proposal editor's
 * `ProposalCopyBadge` that fills it.
 *
 * The founder's objection was not that the editor wrote to the template
 * (it never did) but that nothing on screen said otherwise: "the make
 * edits should be just for the proposal going out to that couple, we dont
 * want to change the entire template". So the two things asserted here are
 * exactly the two things that had to become visible, plus the promise that
 * the template editor's own header did not change while we were at it.
 *
 * @module tests/unit/features/proposals/editor/editor-header-context
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ProposalLayout } from '@/features/proposals'
import { EditorHeader } from '@/features/proposals/editor/editor-header'
import { ProposalCopyBadge } from '@/features/proposals/editor/proposal-copy-badge'
import { buildPublicBranding } from '@/lib/branding/public-branding'

const branding = buildPublicBranding({ business_name: 'Sam MC' })
const layout: ProposalLayout = { version: 2, sections: [] }

/** The header as either editor mounts it; `context` is what the proposal editor adds and the template editor leaves out. */
function renderHeader(context?: React.ReactNode) {
  return render(
    <EditorHeader
      name="Anna & Jake, your wedding"
      onRename={vi.fn(async () => true)}
      {...(context ? { context } : {})}
      status="saved"
      lastSavedAt={null}
      onRetry={vi.fn()}
      device="desktop"
      onDeviceChange={vi.fn()}
      layout={layout}
      branding={branding}
    />,
  )
}

afterEach(cleanup)

/**
 * The badge's whole sentence. The couple's name and the "'s copy" suffix
 * are separate elements so that only the name truncates, so no single node
 * carries the full string for `getByText` to find.
 */
function badgeText(name: string): string {
  return screen.getByText(name).parentElement?.textContent ?? ''
}

describe('EditorHeader context slot', () => {
  it('names the couple whose copy is open, in the proposal editor', () => {
    renderHeader(<ProposalCopyBadge coupleName="Anna & Jake" templateName="Signature" />)
    expect(badgeText('Anna & Jake')).toBe("Anna & Jake's copy")
  })

  it('leaves the template editor\'s header exactly as it was', () => {
    renderHeader()
    expect(screen.queryByText(/copy$/)).not.toBeInTheDocument()
    // Everything the template editor's header always had is still there.
    expect(screen.getByRole('link', { name: 'Proposals' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rename Anna & Jake, your wedding' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument()
  })

  it('keeps the header one row: the badge steps out below `sm` rather than wrapping it', () => {
    const { container } = renderHeader(<ProposalCopyBadge coupleName="Anna & Jake" templateName="Signature" />)
    expect(container.querySelector('header')?.className).toContain('h-12')
    const wrapper = screen.getByText('Anna & Jake').closest('div')?.className ?? ''
    expect(wrapper).toContain('hidden')
    expect(wrapper).toContain('sm:block')
  })
})

describe('ProposalCopyBadge', () => {
  it('promises, by name, that the template is not the thing being edited', () => {
    render(<ProposalCopyBadge coupleName="Anna & Jake" templateName="Signature" />)
    // `mouseOver`, not `mouseEnter`: React implements `onMouseEnter`
    // through the bubbling mouseover event.
    fireEvent.mouseOver(screen.getByText('Anna & Jake'))
    expect(screen.getByRole('tooltip')).toHaveTextContent('Editing this proposal only. Your template Signature is not changed.')
  })

  it('drops the template name when the proposal was not created from one', () => {
    render(<ProposalCopyBadge coupleName="Anna & Jake" templateName={null} />)
    fireEvent.mouseOver(screen.getByText('Anna & Jake'))
    expect(screen.getByRole('tooltip')).toHaveTextContent('Editing this proposal only. Your templates are not changed.')
  })

  it('stays readable when the couple row could not be named', () => {
    render(<ProposalCopyBadge coupleName="  " templateName="Signature" />)
    expect(badgeText('This couple')).toBe("This couple's copy")
  })
})
