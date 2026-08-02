import { describe, it, expect } from 'vitest'

import { defaultBlocksFor, blockTemplate, migrateBlocks } from '@/app/(dashboard)/branding/blocks/defaults'

const types = (bs: { type: string }[]) => bs.map((b) => b.type)

describe('defaultBlocksFor', () => {
  it('invoice seeds both bank details and pay CTA', () => {
    const t = types(defaultBlocksFor('invoice'))
    expect(t).toContain('paymentDetails')
    expect(t).toContain('action')
    expect(t[0]).toBe('businessName')
    expect(t[t.length - 1]).toBe('footer')
  })

  it('questionnaire seeds the all-on-one-page form (a valid exactly-one state)', () => {
    const blocks = defaultBlocksFor('questionnaire')
    const t = types(blocks)
    expect(t).toContain('questionnaireAllOnePage')
    expect(t).not.toContain('questionnaireOneAtATime')
    const form = blocks.find((b) => b.type === 'questionnaireAllOnePage')
    expect(form).toMatchObject({ type: 'questionnaireAllOnePage', locked: true })
  })

  it('blockTemplate builds each document-specific block', () => {
    for (const t of ['title', 'lineItems', 'totals', 'paymentSchedule', 'paymentDetails', 'contractSign'] as const) {
      expect(blockTemplate(t)).toMatchObject({ type: t })
    }
    // The sign marker is a locked singleton.
    expect(blockTemplate('contractSign')).toMatchObject({ type: 'contractSign', locked: true })
  })

  it('contract default seeds a header (expires off), the body marker, then the sign marker, no CTA', () => {
    const blocks = defaultBlocksFor('contract')
    const t = types(blocks)
    expect(t).toEqual(['businessName', 'title', 'contractBody', 'contractSign'])
    expect(t).not.toContain('action')
    // The sign marker is last, right after the body marker.
    expect(t[t.length - 1]).toBe('contractSign')
    const header = blocks.find((b) => b.type === 'title')
    // A contract is signed, not quoted or billed: no "Expires" date and no
    // customer-facing reference number on its header.
    expect(header).toMatchObject({ type: 'title', showExpires: false, showRef: false })
    const body = blocks.find((b) => b.type === 'contractBody')
    expect(body).toMatchObject({ type: 'contractBody', locked: true })
    const sign = blocks.find((b) => b.type === 'contractSign')
    expect(sign).toMatchObject({ type: 'contractSign', locked: true })
  })

  it('migrates a legacy questionnaireBody block by its mode, preserving id + styling', () => {
    const oneAtATime = migrateBlocks(
      [{ id: 'qb-1', type: 'questionnaireBody', mode: 'oneAtATime', locked: true, bgColor: '#EEE', padTop: 12 }],
      'questionnaire',
    )
    expect(oneAtATime[0]).toMatchObject({
      id: 'qb-1',
      type: 'questionnaireOneAtATime',
      locked: true,
      bgColor: '#EEE',
      padTop: 12,
    })
    // The now-meaningless mode field is dropped.
    expect('mode' in oneAtATime[0]!).toBe(false)

    // 'form' and an absent mode both map to the all-on-one-page form.
    const form = migrateBlocks([{ id: 'qb-2', type: 'questionnaireBody', mode: 'form' }], 'questionnaire')
    expect(form[0]).toMatchObject({ id: 'qb-2', type: 'questionnaireAllOnePage' })
    const noMode = migrateBlocks([{ id: 'qb-3', type: 'questionnaireBody' }], 'questionnaire')
    expect(noMode[0]).toMatchObject({ id: 'qb-3', type: 'questionnaireAllOnePage' })
  })

  it('title template is surface-aware: contract turns Expires + Ref off, invoice keeps them on', () => {
    expect(blockTemplate('title', 'contract')).toMatchObject({ showExpires: false, showRef: false })
    expect(blockTemplate('title', 'invoice')).toMatchObject({ showExpires: true, showRef: true })
    // No surface passed → the generic default (Expires + Ref on).
    expect(blockTemplate('title')).toMatchObject({ showExpires: true, showRef: true })
  })
})
