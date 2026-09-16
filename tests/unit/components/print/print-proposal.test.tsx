/**
 * `proposalPrintElement` composes `ProposalPage` (which owns `useState` and
 * an effect for its selection state) exactly as `/proposal/[token]` does.
 * `renderToStaticMarkup` runs state hooks at their initial value and skips
 * effects (see the corrected contract on `PrintDocumentOptions.element`), so
 * this asserts the print element still renders real markup rather than
 * throwing, and never emits a `<video>` or `<iframe>` (the print frame never
 * plays embedded/uploaded media). The proposal number isn't printed by any
 * block on the default tree (it's a `{{proposal_number}}` variable an MC
 * opts into, not auto-shown) but `printProposal` always carries it in the
 * print window's title, so that's asserted through `buildPrintHtml` with the
 * same element, mirroring `printProposal`.
 *
 * @module tests/unit/components/print/print-proposal
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { defaultBlocksFor } from '@/app/(dashboard)/branding/blocks/defaults'
import { proposalPrintElement } from '@/components/print/print-proposal'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import { buildPrintHtml } from '@/lib/pdf/print-document'
import { sampleProposal } from '@/lib/proposals/sample-proposal'

describe('proposalPrintElement', () => {
  it('renders static markup with no video/iframe media', () => {
    const branding = buildPublicBranding({})
    const proposal = sampleProposal(branding)
    const markup = renderToStaticMarkup(proposalPrintElement(proposal, defaultBlocksFor('proposal')))

    expect(markup.length).toBeGreaterThan(0)
    expect(markup).not.toMatch(/<video/)
    expect(markup).not.toMatch(/<iframe/)
  })

  it('the built print document carries the proposal number, exactly as printProposal titles the window', () => {
    const branding = buildPublicBranding({})
    const proposal = sampleProposal(branding)
    const html = buildPrintHtml({
      title: `Proposal ${proposal.proposal_number}`,
      element: proposalPrintElement(proposal, defaultBlocksFor('proposal')),
      branding: proposal,
    })

    expect(html).toContain(proposal.proposal_number)
    expect(html).not.toMatch(/<video/)
    expect(html).not.toMatch(/<iframe/)
  })
})
