import { describe, it, expect } from 'vitest'

import {
  isMarker, isRequired, isDeletable, requiredTypesForSurface, atLeastOneForSurface,
  exactlyOneForSurface, stylesWrapMarker,
  MARKER_TYPES, CLEARABLE_MARKERS,
} from '@/app/(dashboard)/branding/blocks/policy'
import type { Block } from '@/app/(dashboard)/branding/blocks/types'

describe('policy', () => {
  it('markers are the six render-split types', () => {
    expect(isMarker('couplePortal')).toBe(true)
    expect(isMarker('contractBody')).toBe(true)
    expect(isMarker('contractSign')).toBe(true)
    expect(isMarker('vendorTimelineBody')).toBe(true)
    expect(isMarker('questionnaireOneAtATime')).toBe(true)
    expect(isMarker('questionnaireAllOnePage')).toBe(true)
    expect(isMarker('paymentSchedule')).toBe(false)
    expect(MARKER_TYPES.has('contractSign')).toBe(true)
  })

  it('clearable markers include the contract/run-sheet/portal bodies + both questionnaire form blocks', () => {
    expect([...CLEARABLE_MARKERS].sort()).toEqual(
      [
        'contractBody', 'contractSign', 'vendorTimelineBody', 'couplePortal',
        'questionnaireOneAtATime', 'questionnaireAllOnePage',
      ].sort(),
    )
    // Every clearable marker is also a marker.
    for (const t of CLEARABLE_MARKERS) expect(MARKER_TYPES.has(t)).toBe(true)
    // The questionnaire form blocks are clearable (the MC swaps style by
    // deleting one and adding the other).
    expect(CLEARABLE_MARKERS.has('questionnaireOneAtATime')).toBe(true)
    expect(CLEARABLE_MARKERS.has('questionnaireAllOnePage')).toBe(true)
  })

  it('only the questionnaire form blocks are style-wrapping markers', () => {
    expect(stylesWrapMarker('questionnaireOneAtATime')).toBe(true)
    expect(stylesWrapMarker('questionnaireAllOnePage')).toBe(true)
    // Content-injecting markers strip their frame styling.
    expect(stylesWrapMarker('couplePortal')).toBe(false)
    expect(stylesWrapMarker('contractBody')).toBe(false)
    // Every style-wrapping marker is a marker.
    expect(isMarker('questionnaireOneAtATime')).toBe(true)
  })

  it('questionnaire needs exactly one form-style block; no fixed required block', () => {
    expect(requiredTypesForSurface('questionnaire')).toEqual([])
    expect(exactlyOneForSurface('questionnaire')).toEqual([
      'questionnaireOneAtATime', 'questionnaireAllOnePage',
    ])
    // Other surfaces have no exactly-one constraint.
    expect(exactlyOneForSurface('invoice')).toBeNull()
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

  it('clearable markers are deletable even though locked (bodies + both questionnaire form blocks)', () => {
    // They stay `locked` (no duplication) but the MC can delete them directly
    // and re-add from the palette, matching "Clear all blocks".
    const body: Block = { id: 'b', type: 'contractBody', locked: true }
    const sign: Block = { id: 's', type: 'contractSign', locked: true }
    const runSheet: Block = { id: 'r', type: 'vendorTimelineBody', locked: true }
    const portal: Block = { id: 'p', type: 'couplePortal', locked: true }
    const oneAtATime: Block = { id: 'q1', type: 'questionnaireOneAtATime', locked: true }
    const allOnePage: Block = { id: 'qa', type: 'questionnaireAllOnePage', locked: true }
    expect(isDeletable(body, 'contract')).toBe(true)
    expect(isDeletable(sign, 'contract')).toBe(true)
    expect(isDeletable(runSheet, 'vendorTimeline')).toBe(true)
    expect(isDeletable(portal, 'portal')).toBe(true)
    expect(isDeletable(oneAtATime, 'questionnaire')).toBe(true)
    expect(isDeletable(allOnePage, 'questionnaire')).toBe(true)
    // A locked block that is not a clearable marker still resists deletion.
    const lockedTitle: Block = { id: 't', type: 'title', title: 'X', showCoupleName: false, showRef: true, showExpires: true, showAbn: false, locked: true }
    expect(isDeletable(lockedTitle, 'invoice')).toBe(false)
  })
})
