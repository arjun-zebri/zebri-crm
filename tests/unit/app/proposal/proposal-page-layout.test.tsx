/**
 * `ProposalPage` with a v2 layout (Phase 1): renders the layout's
 * sections instead of the v1 tree, an accept button in rich text opens
 * the stepper, a jump button scrolls to its section, and the print frame
 * still works. The v1 path is covered by proposal-page.test.tsx.
 *
 * @module tests/unit/app/proposal/proposal-page-layout
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { blockTemplate } from '@/app/(dashboard)/branding/blocks/defaults'
import { ProposalPage } from '@/app/proposal/[token]/_components/proposal-page'
import { button, doc, heading, migrateProposalTreeToLayout, paragraph, text, type ProposalLayout } from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import { sampleProposal } from '@/lib/proposals/sample-proposal'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const branding = buildPublicBranding({})
const proposal = sampleProposal(branding)

function layout(): ProposalLayout {
  const data = migrateProposalTreeToLayout([blockTemplate('packages'), blockTemplate('accept')])
  return {
    version: 2,
    sections: [
      { id: 'hero', kind: 'content', style: { height: 'full', contentWidth: 'medium', padding: 'roomy', align: 'center' }, content: doc(heading(1, text('V2 hero heading')), button({ label: 'Jump to packages', action: { kind: 'jump', sectionId: data.sections[0]!.id }, variant: 'outline', size: 'md', align: 'center' })) },
      { id: 'note', kind: 'content', style: { height: 'fit', contentWidth: 'narrow', padding: 'cozy' }, content: doc(paragraph(text('A v2 note')), button({ label: 'Accept now', action: { kind: 'accept' }, variant: 'fill', size: 'lg', align: 'left' })) },
      ...data.sections,
    ],
  }
}

describe('ProposalPage with a v2 layout', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('renders the layout sections and not the v1 tree', () => {
    const { container } = render(<ProposalPage proposal={proposal} blocks={[blockTemplate('hero')]} layout={layout()} frame="page" token="tok-1" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('V2 hero heading')
    expect(container.querySelectorAll('section[data-section-id]')).toHaveLength(4)
    expect(container.querySelector('[data-block-type="hero"]')).toBeNull()
  })

  it('a rich-text accept button opens the stepper', () => {
    render(<ProposalPage proposal={proposal} blocks={[]} layout={layout()} frame="page" token="tok-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Accept now' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('a jump button scrolls its target section into view', () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    render(<ProposalPage proposal={proposal} blocks={[]} layout={layout()} frame="page" token="tok-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Jump to packages' }))
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })

  it('the print frame renders the layout with fixed-height sections and no dialogs', () => {
    const { container } = render(<ProposalPage proposal={proposal} blocks={[]} layout={layout()} frame="print" />)
    expect(container.querySelector('section[data-section-id]')?.getAttribute('style')).toContain('480px')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
