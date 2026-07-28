import { describe, it, expect } from 'vitest'

import {
  GENERAL_BLOCKS, blocksForSurface, paletteGroupsForSurface,
} from '@/app/(dashboard)/branding/blocks/blocks-by-surface'

describe('blocks-by-surface', () => {
  it('general blocks are ordered by frequency and exclude banner + action', () => {
    expect(GENERAL_BLOCKS).toEqual(['text', 'divider', 'spacer', 'businessName', 'image', 'tagline', 'footer'])
  })

  it('proposal doc-specific palette lists the four package blocks + accept CTA', () => {
    const proposal = blocksForSurface('proposal')
    expect(proposal).toEqual(expect.arrayContaining(['packageHeader', 'packageDetails', 'packageInclusions', 'packageTotals', 'action']))
    expect(proposal).not.toContain('headerBanner')
    expect(proposal).not.toContain('proposalBody')
  })

  it('exposes two labelled palette groups', () => {
    const groups = paletteGroupsForSurface('invoice')
    expect(groups.map((g) => g.label)).toEqual(['General', 'Document-specific'])
    expect(groups[1]!.types).toEqual(expect.arrayContaining(['title', 'lineItems', 'totals', 'paymentSchedule', 'paymentDetails', 'action']))
  })
})
