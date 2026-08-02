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

  it('title template is surface-aware: contract turns Expires + Ref off, invoice keeps them on', () => {
    expect(blockTemplate('title', 'contract')).toMatchObject({ showExpires: false, showRef: false })
    expect(blockTemplate('title', 'invoice')).toMatchObject({ showExpires: true, showRef: true })
    // No surface passed → the generic default (Expires + Ref on).
    expect(blockTemplate('title')).toMatchObject({ showExpires: true, showRef: true })
  })
})
