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

  it('clearable markers are the contract body + sign form + run sheet + portal body', () => {
    expect([...CLEARABLE_MARKERS].sort()).toEqual(
      ['contractBody', 'contractSign', 'vendorTimelineBody', 'couplePortal'].sort(),
    )
    // Every clearable marker is also a marker.
    for (const t of CLEARABLE_MARKERS) expect(MARKER_TYPES.has(t)).toBe(true)
    // The couple portal body is now clearable.
    expect(CLEARABLE_MARKERS.has('couplePortal')).toBe(true)
    // The questionnaire body remains a fixed singleton (not clearable).
    expect(CLEARABLE_MARKERS.has('questionnaireBody')).toBe(false)
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
    // The couple portal body is a clearable marker, so it is deletable even when
    // locked (deletion raises the not-ready flag; it is re-addable from the palette).
    const locked: Block = { id: 'y', type: 'couplePortal', locked: true }
    expect(isDeletable(locked, 'portal')).toBe(true)
  })

  it('clearable markers are deletable even though locked (body + sign + run sheet + portal)', () => {
    // They stay `locked` (no duplication) but the MC can delete them directly
    // and re-add from the palette, matching "Clear all blocks".
    const body: Block = { id: 'b', type: 'contractBody', locked: true }
    const sign: Block = { id: 's', type: 'contractSign', locked: true }
    const runSheet: Block = { id: 'r', type: 'vendorTimelineBody', locked: true }
    const portal: Block = { id: 'p', type: 'couplePortal', locked: true }
    expect(isDeletable(body, 'contract')).toBe(true)
    expect(isDeletable(sign, 'contract')).toBe(true)
    expect(isDeletable(runSheet, 'vendorTimeline')).toBe(true)
    expect(isDeletable(portal, 'portal')).toBe(true)
    // A non-clearable locked marker still resists deletion.
    expect(isDeletable({ id: 'q', type: 'questionnaireBody', locked: true }, 'questionnaire')).toBe(false)
  })
})
