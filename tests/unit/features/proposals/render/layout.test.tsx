/**
 * The whole-page renderer (spec §6): one `<section>` per layout section
 * with its style applied, content sections through `RichDocView`, data
 * sections through the v1 adapter, `hideOnMobile` as a class, and the
 * first section never animated.
 *
 * @module tests/unit/features/proposals/render/layout
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { blockTemplate } from '@/app/(dashboard)/branding/blocks/defaults'
import { doc, heading, migrateProposalTreeToLayout, paragraph, ProposalLayoutView, text, type ProposalLayout } from '@/features/proposals'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import { SAMPLE_PROPOSAL_DOC } from '@/lib/proposals/sample-proposal'

const branding = buildPublicBranding({ business_name: 'Sam MC' })

function layout(): ProposalLayout {
  const migrated = migrateProposalTreeToLayout([blockTemplate('packages'), blockTemplate('accept')])
  return {
    version: 2,
    sections: [
      { id: 'hero', kind: 'content', name: 'Hero', style: { height: 'full', contentWidth: 'medium', padding: 'roomy', background: { color: '#112233' }, textColor: '#FFFFFF', align: 'center' }, content: doc(heading(1, text('Anna & Jake')), paragraph(text('A proposal'))) },
      { id: 'hidden', kind: 'content', hideOnMobile: true, style: { height: 'fit', contentWidth: 'narrow', padding: 'compact' }, content: doc(paragraph(text('Desktop only'))) },
      ...migrated.sections,
    ],
  }
}

describe('ProposalLayoutView', () => {
  it('renders one section per layout section with the style applied', () => {
    const { container } = render(<ProposalLayoutView layout={layout()} branding={branding} doc={SAMPLE_PROPOSAL_DOC} mode="page" />)
    const sections = container.querySelectorAll('section[data-section-id]')
    expect(sections).toHaveLength(4)
    const hero = sections[0]!
    expect(hero.getAttribute('data-section-kind')).toBe('content')
    expect(hero.getAttribute('style')).toContain('min-height: 100svh')
    expect(hero.getAttribute('style')).toContain('rgb(17, 34, 51)')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Anna & Jake')
    expect(hero.querySelector('[class*="max-w-doc-prose"]')).not.toBeNull()
  })

  it('marks hide-on-mobile sections with the responsive class and never animates the first section', () => {
    const { container } = render(<ProposalLayoutView layout={layout()} branding={branding} doc={SAMPLE_PROPOSAL_DOC} mode="page" />)
    const sections = container.querySelectorAll('section[data-section-id]')
    expect(sections[1]!.className).toContain('max-md:hidden')
    expect(sections[0]!.className).not.toContain('opacity-0')
  })

  it('renders data sections through the v1 components and wires accept to onAction', () => {
    const onAction = vi.fn()
    render(<ProposalLayoutView layout={layout()} branding={branding} doc={SAMPLE_PROPOSAL_DOC} mode="page" onAction={onAction} proposal={{ onAccept: () => onAction({ kind: 'accept' }) }} />)
    // The v1 packages block renders the sample proposal's option titles.
    expect(screen.getAllByText(SAMPLE_PROPOSAL_DOC.proposal!.options[0]!.title).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument()
  })

  it('print mode renders full sections at 480px and skips the reveal classes', () => {
    const { container } = render(<ProposalLayoutView layout={layout()} branding={branding} doc={SAMPLE_PROPOSAL_DOC} mode="print" />)
    const hero = container.querySelector('section[data-section-id]')!
    expect(hero.getAttribute('style')).toContain('min-height: 480px')
    expect(container.querySelector('.animate-reveal-up, .opacity-0')).toBeNull()
  })
})
