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

  it('contract doc-specific palette includes body + sign markers', () => {
    const contract = blocksForSurface('contract')
    expect(contract).toEqual(expect.arrayContaining(['title', 'contractBody', 'contractSign']))
  })

  it('contract palette always lists the clearable markers (body + sign)', () => {
    // They stay in the palette even once inserted so the MC always sees the full
    // set of contract blocks; addBlock guards against inserting a duplicate.
    const contract = paletteGroupsForSurface('contract')[1]!.types
    expect(contract).toContain('contractBody')
    expect(contract).toContain('contractSign')
  })

  it('run sheet palette always lists the clearable run sheet body', () => {
    expect(paletteGroupsForSurface('vendorTimeline')[1]!.types).toContain('vendorTimelineBody')
  })

  it('fixed-singleton markers never enter the palette', () => {
    expect(paletteGroupsForSurface('portal')[1]!.types).not.toContain('couplePortal')
    expect(paletteGroupsForSurface('questionnaire')[1]!.types).not.toContain('questionnaireBody')
  })
})
