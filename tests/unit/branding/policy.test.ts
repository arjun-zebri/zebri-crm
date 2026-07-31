import { describe, it, expect } from 'vitest'

import {
  isMarker, isRequired, isDeletable, requiredTypesForSurface, atLeastOneForSurface,
} from '@/app/(dashboard)/branding/blocks/policy'
import type { Block } from '@/app/(dashboard)/branding/blocks/types'

describe('policy', () => {
  it('markers are only the four render-split types', () => {
    expect(isMarker('couplePortal')).toBe(true)
    expect(isMarker('contractBody')).toBe(true)
    expect(isMarker('vendorTimelineBody')).toBe(true)
    expect(isMarker('questionnaireBody')).toBe(true)
    expect(isMarker('paymentSchedule')).toBe(false)
  })

  it('contract requires title/contractBody/action', () => {
    expect(requiredTypesForSurface('contract').sort()).toEqual(
      ['action', 'contractBody', 'title'].sort(),
    )
    expect(isRequired('footer', 'contract')).toBe(false)
  })

  it('invoice requires header/lineItems/totals; bank-or-pay is at-least-one', () => {
    expect(requiredTypesForSurface('invoice').sort()).toEqual(['lineItems', 'title', 'totals'].sort())
    expect(atLeastOneForSurface('invoice')).toEqual(['paymentDetails', 'action'])
    expect(isRequired('paymentSchedule', 'invoice')).toBe(false)
  })

  it('required blocks are deletable (deletion raises a flag, not a guard)', () => {
    const b: Block = { id: 'x', type: 'title', title: 'Invoice', showCoupleName: false, showRef: true, showExpires: true, showAbn: true }
    expect(isDeletable(b, 'invoice')).toBe(true)
    const locked: Block = { id: 'y', type: 'couplePortal', locked: true }
    expect(isDeletable(locked, 'portal')).toBe(false)
  })
})
