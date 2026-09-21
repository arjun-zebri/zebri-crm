/**
 * The one rule every proposal text size goes through before it reaches
 * CSS: every size becomes a `clamp()` that shrinks with the doc container
 * on a phone, body-range sizes only a little (2026-09-19 feedback: table
 * cells and paragraph text read too large/cramped on a narrow doc),
 * larger sizes down to their old, steeper headline scale.
 *
 * @module tests/unit/branding/fluid-type
 */
import { describe, expect, it } from 'vitest'

import { fluidFontSize } from '@/lib/branding/fluid-type'

describe('fluidFontSize', () => {
  it('gives body-range sizes a shallow clamp: a little smaller on a phone, never below the fixed value on desktop', () => {
    expect(fluidFontSize(15)).toBe('clamp(13px, 2.68cqw, 15px)')
    expect(fluidFontSize(32)).toBe('clamp(27px, 5.71cqw, 32px)')
  })

  it('turns a larger size into a clamp whose ceiling is the set size and whose floor never drops below the fixed range', () => {
    expect(fluidFontSize(46)).toBe('clamp(32px, 8.21cqw, 46px)')
    // Floor is 60% of the set size once that clears the fixed range.
    expect(fluidFontSize(96)).toBe('clamp(58px, 17.14cqw, 96px)')
  })

  it('reads a stored px string and passes anything else through untouched', () => {
    expect(fluidFontSize('46px')).toBe('clamp(32px, 8.21cqw, 46px)')
    expect(fluidFontSize('1.5rem')).toBe('1.5rem')
  })
})
