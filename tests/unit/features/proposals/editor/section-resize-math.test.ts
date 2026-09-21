/**
 * Task 12: the pure padding/content-width <-> px conversions the section
 * resize grips drag through (`section-resize-math.ts`). Named stops round
 * -trip through their px value; anything else stays a number.
 *
 * @module tests/unit/features/proposals/editor/section-resize-math
 */
import { describe, expect, it } from 'vitest'

import { paddingToPx, pxToPadding, pxToWidth, widthToPx } from '@/features/proposals'

describe('section resize math', () => {
  it('paddingToPx resolves a named stop, and passes a dragged number through', () => {
    expect(paddingToPx('cozy')).toBe(48)
    expect(paddingToPx(70)).toBe(70)
  })

  it('widthToPx resolves a named stop, and passes a dragged number through', () => {
    expect(widthToPx('wide')).toBe(1100)
    expect(widthToPx(900)).toBe(900)
  })

  it('pxToPadding names a px value that lands on a stop, and leaves anything else numeric', () => {
    expect(pxToPadding(48)).toBe('cozy')
    expect(pxToPadding(32)).toBe('compact')
    expect(pxToPadding(64)).toBe('roomy')
    expect(pxToPadding(50)).toBe(50)
  })

  it('pxToWidth names a px value that lands on a stop, and leaves anything else numeric', () => {
    expect(pxToWidth(1100)).toBe('wide')
    expect(pxToWidth(560)).toBe('narrow')
    expect(pxToWidth(720)).toBe('medium')
    expect(pxToWidth(728)).toBe(728)
  })
})
