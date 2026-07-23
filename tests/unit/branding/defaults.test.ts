import { describe, it, expect } from 'vitest'
import { defaultBlocksFor, blockTemplate } from '@/app/(dashboard)/branding/blocks/defaults'

const types = (bs: { type: string }[]) => bs.map((b) => b.type)

describe('defaultBlocksFor', () => {
  it('proposal seeds the five real blocks in spec order (§3)', () => {
    expect(types(defaultBlocksFor('proposal'))).toEqual([
      'businessName', 'packageHeader', 'packageDetails', 'packageInclusions', 'packageTotals', 'action', 'footer',
    ])
  })

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

  it('blockTemplate builds each new proposal block', () => {
    for (const t of ['packageHeader', 'packageDetails', 'packageInclusions', 'packageTotals'] as const) {
      expect(blockTemplate(t)).toMatchObject({ type: t })
    }
  })
})
