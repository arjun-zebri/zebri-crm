import { describe, expect, it } from 'vitest'

import {
  isDataBound, isDeletable, isMarker, isRequired,
} from '@/app/(dashboard)/branding/blocks/policy'

describe('block policy', () => {
  it('marks all marker types', () => {
    for (const t of ['couplePortal', 'paymentSchedule', 'contractBody', 'proposalBody'] as const) {
      expect(isMarker(t)).toBe(true)
    }
    expect(isMarker('text')).toBe(false)
  })

  it('requires financial blocks on invoices only', () => {
    expect(isRequired('lineItems', 'invoice')).toBe(true)
    expect(isRequired('totals', 'invoice')).toBe(true)
    expect(isRequired('paymentDetails', 'invoice')).toBe(true)
    expect(isRequired('lineItems', 'proposal')).toBe(false)
  })

  it('requires the surface marker everywhere it appears', () => {
    expect(isRequired('proposalBody', 'proposal')).toBe(true)
    expect(isRequired('contractBody', 'contract')).toBe(true)
    expect(isRequired('couplePortal', 'portal')).toBe(true)
    expect(isRequired('paymentSchedule', 'invoice')).toBe(true)
  })

  it('never allows deleting required or locked blocks', () => {
    expect(isDeletable({ id: 'x', type: 'proposalBody', locked: true }, 'proposal')).toBe(false)
    expect(isDeletable({ id: 'x', type: 'lineItems' }, 'invoice')).toBe(false)
    expect(isDeletable({ id: 'x', type: 'text', text: 'hi' }, 'invoice')).toBe(true)
  })

  it('flags data-bound blocks', () => {
    expect(isDataBound('paymentSchedule')).toBe(true)
    expect(isDataBound('lineItems')).toBe(true)
    expect(isDataBound('text')).toBe(false)
  })
})
