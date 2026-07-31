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
})
