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
    expect(groups[1]!.entries.map((e) => e.type)).toEqual(expect.arrayContaining(['title', 'lineItems', 'totals', 'paymentSchedule', 'paymentDetails', 'action']))
  })

  it('contract doc-specific palette includes the body + the three signature panels', () => {
    const contract = blocksForSurface('contract')
    expect(contract).toEqual(
      expect.arrayContaining([
        'title',
        'contractBody',
        'contractSignVendor',
        'contractSignPrimary',
        'contractSignSecondary',
      ]),
    )
  })

  it('never offers the deprecated all-in-one sign block', () => {
    // Existing trees keep rendering theirs, but it must not be addable to a
    // new one: the per-party panels replace it.
    expect(blocksForSurface('contract')).not.toContain('contractSign')
    const entries = paletteGroupsForSurface('contract')[1]!.entries.map((e) => e.type)
    expect(entries).not.toContain('contractSign')
  })

  it('contract palette always lists the clearable markers (body + signatures)', () => {
    // They stay in the palette even once inserted so the MC always sees the full
    // set of contract blocks; addBlock guards against inserting a duplicate.
    const contract = paletteGroupsForSurface('contract')[1]!.entries.map((e) => e.type)
    expect(contract).toContain('contractBody')
    expect(contract).toContain('contractSignVendor')
    expect(contract).toContain('contractSignPrimary')
    expect(contract).toContain('contractSignSecondary')
  })

  it('run sheet palette always lists the clearable run sheet body', () => {
    expect(paletteGroupsForSurface('vendorTimeline')[1]!.entries.map((e) => e.type)).toContain('vendorTimelineBody')
  })

  it('portal palette always lists the clearable couple portal body', () => {
    expect(paletteGroupsForSurface('portal')[1]!.entries.map((e) => e.type)).toContain('couplePortal')
  })

  it('questionnaire palette lists both clearable form-style blocks', () => {
    // The form style is chosen by adding one of these two clearable markers, so
    // both stay listed permanently; addBlock guards against duplicates.
    const questionnaire = paletteGroupsForSurface('questionnaire')[1]!.entries.map((e) => e.type)
    expect(questionnaire).toContain('questionnaireOneAtATime')
    expect(questionnaire).toContain('questionnaireAllOnePage')
  })
})

describe('website form palette entries', () => {
  it('lists every fixed-form question as its own entry, then custom + submit', () => {
    const entries = paletteGroupsForSurface('lead')[1]!.entries
    expect(entries.map((e) => e.label)).toEqual([
      'Your name',
      "Partner's name",
      'Email',
      'Phone',
      'Wedding date',
      'Venue',
      'How did you hear about me?',
      'Message',
      'Custom question',
      'Submit button',
    ])
  })

  it('question entries preset a formField with the matching role', () => {
    const entries = paletteGroupsForSurface('lead')[1]!.entries
    const byLabel = new Map(entries.map((e) => [e.label, e]))
    expect(byLabel.get('Your name')!.preset).toMatchObject({ role: 'name', required: true })
    expect(byLabel.get("Partner's name")!.preset).toMatchObject({ role: 'partnerName' })
    expect(byLabel.get('Email')!.preset).toMatchObject({
      role: 'email',
      inputType: 'email',
      required: true,
    })
    expect(byLabel.get('Phone')!.preset).toMatchObject({ role: 'phone', inputType: 'tel' })
    expect(byLabel.get('Wedding date')!.preset).toMatchObject({
      role: 'weddingDate',
      inputType: 'date',
    })
    expect(byLabel.get('Venue')!.preset).toMatchObject({ role: 'venue' })
    expect(byLabel.get('How did you hear about me?')!.preset).toMatchObject({ role: 'referral' })
    expect(byLabel.get('Message')!.preset).toMatchObject({
      role: 'message',
      inputType: 'textarea',
    })
    expect(byLabel.get('Custom question')!.preset).toMatchObject({ role: 'custom' })
    expect(byLabel.get('Submit button')!.type).toBe('formSubmit')
    // All question entries are formField blocks, not new block types.
    for (const e of entries.slice(0, 9)) expect(e.type).toBe('formField')
  })
})
