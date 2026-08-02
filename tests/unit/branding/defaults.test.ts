import { describe, it, expect } from 'vitest'

import { defaultBlocksFor, blockTemplate } from '@/app/(dashboard)/branding/blocks/defaults'

const types = (bs: { type: string }[]) => bs.map((b) => b.type)

describe('defaultBlocksFor', () => {
  it('invoice seeds both bank details and pay CTA', () => {
    const t = types(defaultBlocksFor('invoice'))
    expect(t).toContain('paymentDetails')
    expect(t).toContain('action')
    expect(t[0]).toBe('businessName')
    expect(t[t.length - 1]).toBe('footer')
  })

  it('questionnaire seeds form mode', () => {
    const qb = defaultBlocksFor('questionnaire').find((b) => b.type === 'questionnaireBody')
    expect(qb).toMatchObject({ type: 'questionnaireBody', mode: 'form' })
  })

  it('blockTemplate builds each document-specific block', () => {
    for (const t of ['title', 'lineItems', 'totals', 'paymentSchedule', 'paymentDetails'] as const) {
      expect(blockTemplate(t)).toMatchObject({ type: t })
    }
  })

  it('contract default seeds a header (expires off) and the body marker, no CTA', () => {
    const blocks = defaultBlocksFor('contract')
    const t = types(blocks)
    expect(t).toEqual(['businessName', 'title', 'contractBody'])
    expect(t).not.toContain('action')
    const header = blocks.find((b) => b.type === 'title')
    // A contract is signed, not quoted or billed: no "Expires" date and no
    // customer-facing reference number on its header.
    expect(header).toMatchObject({ type: 'title', showExpires: false, showRef: false })
    const body = blocks.find((b) => b.type === 'contractBody')
    expect(body).toMatchObject({ type: 'contractBody', locked: true })
  })

  it('title template is surface-aware: contract turns Expires + Ref off, invoice keeps them on', () => {
    expect(blockTemplate('title', 'contract')).toMatchObject({ showExpires: false, showRef: false })
    expect(blockTemplate('title', 'invoice')).toMatchObject({ showExpires: true, showRef: true })
    // No surface passed → the generic default (Expires + Ref on).
    expect(blockTemplate('title')).toMatchObject({ showExpires: true, showRef: true })
  })
})
