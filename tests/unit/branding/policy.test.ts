import { describe, it, expect } from 'vitest'

import {
  isMarker, isRequired, isDeletable, requiredTypesForSurface, atLeastOneForSurface,
  MARKER_TYPES, CLEARABLE_MARKERS,
} from '@/app/(dashboard)/branding/blocks/policy'
import type { Block } from '@/app/(dashboard)/branding/blocks/types'

describe('policy', () => {
  it('markers are the five render-split types', () => {
    expect(isMarker('couplePortal')).toBe(true)
    expect(isMarker('contractBody')).toBe(true)
    expect(isMarker('contractSign')).toBe(true)
    expect(isMarker('vendorTimelineBody')).toBe(true)
    expect(isMarker('questionnaireBody')).toBe(true)
    expect(isMarker('paymentSchedule')).toBe(false)
    expect(MARKER_TYPES.has('contractSign')).toBe(true)
  })

  it('clearable markers are exactly the contract body + sign form', () => {
    expect([...CLEARABLE_MARKERS].sort()).toEqual(['contractBody', 'contractSign'].sort())
    // Every clearable marker is also a marker.
    for (const t of CLEARABLE_MARKERS) expect(MARKER_TYPES.has(t)).toBe(true)
    // Fixed-singleton markers are not clearable.
    expect(CLEARABLE_MARKERS.has('couplePortal')).toBe(false)
  })

  it('contract requires title/contractBody/contractSign (no generic action block)', () => {
    expect(requiredTypesForSurface('contract').sort()).toEqual(
      ['contractBody', 'contractSign', 'title'].sort(),
    )
    expect(isRequired('contractSign', 'contract')).toBe(true)
    expect(isRequired('action', 'contract')).toBe(false)
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

  it('clearable markers are deletable even though locked (contract body + sign)', () => {
    // They stay `locked` (no duplication) but the MC can delete them directly
    // and re-add from the palette, matching "Clear all blocks".
    const body: Block = { id: 'b', type: 'contractBody', locked: true }
    const sign: Block = { id: 's', type: 'contractSign', locked: true }
    expect(isDeletable(body, 'contract')).toBe(true)
    expect(isDeletable(sign, 'contract')).toBe(true)
    // A non-clearable locked marker still resists deletion.
    expect(isDeletable({ id: 'q', type: 'questionnaireBody', locked: true }, 'questionnaire')).toBe(false)
  })
})
