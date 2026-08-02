import { describe, it, expect } from 'vitest'

import {
  GENERAL_BLOCKS, blocksForSurface, paletteGroupsForSurface,
} from '@/app/(dashboard)/branding/blocks/blocks-by-surface'

describe('blocks-by-surface', () => {
  it('general blocks are ordered by frequency and exclude banner + action', () => {
    expect(GENERAL_BLOCKS).toEqual(['text', 'divider', 'spacer', 'businessName', 'image', 'tagline', 'footer'])
  })

  it('invoice doc-specific palette lists the invoice blocks and excludes retired markers', () => {
    const invoice = blocksForSurface('invoice')
    expect(invoice).toEqual(expect.arrayContaining(['title', 'lineItems', 'totals', 'paymentSchedule', 'paymentDetails', 'action']))
    expect(invoice).not.toContain('headerBanner')
  })

  it('exposes two labelled palette groups', () => {
    const groups = paletteGroupsForSurface('invoice')
    expect(groups.map((g) => g.label)).toEqual(['General', 'Document-specific'])
    expect(groups[1]!.types).toEqual(expect.arrayContaining(['title', 'lineItems', 'totals', 'paymentSchedule', 'paymentDetails', 'action']))
  })

  it('contract palette offers the body only while it is absent', () => {
    // Present (the normal case): the locked marker stays out of the palette.
    const withBody = paletteGroupsForSurface('contract', ['title', 'contractBody'])
    expect(withBody[1]!.types).not.toContain('contractBody')
    // Cleared: the body becomes re-addable so a blank contract can be rebuilt.
    const withoutBody = paletteGroupsForSurface('contract', ['title'])
    expect(withoutBody[1]!.types).toContain('contractBody')
    // Default (no presentTypes) treats the body as absent → offered.
    expect(paletteGroupsForSurface('contract')[1]!.types).toContain('contractBody')
  })

  it('other surface markers never enter the palette, present or not', () => {
    expect(paletteGroupsForSurface('portal', [])[1]!.types).not.toContain('couplePortal')
    expect(paletteGroupsForSurface('questionnaire', [])[1]!.types).not.toContain('questionnaireBody')
  })
})
