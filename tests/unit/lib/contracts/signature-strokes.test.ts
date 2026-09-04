/**
 * Signature-pad geometry (`lib/contracts/signature-strokes`).
 *
 * The pad itself is a canvas that jsdom cannot render, so the decisions that
 * matter are made here where they can be tested: chiefly whether a gesture
 * counts as a signature at all.
 */
import { describe, expect, it } from 'vitest'

import {
  isEmptyStroke,
  MIN_SIGNATURE_TRAVEL_PX,
  padPixelRatio,
  totalTravel,
  type Stroke,
} from '@/lib/contracts/signature-strokes'

/** A horizontal stroke of the given length. */
const line = (length: number): Stroke => [
  { x: 0, y: 0 },
  { x: length, y: 0 },
]

describe('totalTravel', () => {
  it('sums distance across every stroke', () => {
    expect(totalTravel([line(30), line(40)])).toBe(70)
  })

  it('measures diagonals, not just axes', () => {
    expect(totalTravel([[{ x: 0, y: 0 }, { x: 3, y: 4 }]])).toBe(5)
  })

  it('is zero for no strokes and for single points', () => {
    expect(totalTravel([])).toBe(0)
    expect(totalTravel([[{ x: 5, y: 5 }]])).toBe(0)
  })
})

describe('isEmptyStroke', () => {
  it('treats a tap as empty', () => {
    // Otherwise a signer could "sign" a legal document with a dot, or an
    // accidental brush against a phone screen would count as a signature.
    expect(isEmptyStroke([[{ x: 10, y: 10 }]])).toBe(true)
  })

  it('treats a nearly-motionless gesture as empty', () => {
    expect(isEmptyStroke([line(MIN_SIGNATURE_TRAVEL_PX - 1)])).toBe(true)
  })

  it('accepts a real signature', () => {
    expect(isEmptyStroke([line(MIN_SIGNATURE_TRAVEL_PX + 1)])).toBe(false)
  })

  it('accumulates across several short strokes', () => {
    // Someone signing initials makes several short marks; together they are a
    // signature even though no single stroke clears the threshold.
    expect(isEmptyStroke([line(10), line(10), line(10)])).toBe(false)
  })

  it('is empty with no strokes at all', () => {
    expect(isEmptyStroke([])).toBe(true)
  })
})

describe('padPixelRatio', () => {
  it('caps at 2', () => {
    // Export size scales with the square of this, against a hard 128KB budget:
    // a 3x phone would triple the pixel count for no visible gain.
    expect(padPixelRatio(3)).toBe(2)
    expect(padPixelRatio(4)).toBe(2)
  })

  it('passes through sane ratios', () => {
    expect(padPixelRatio(1)).toBe(1)
    expect(padPixelRatio(1.5)).toBe(1.5)
    expect(padPixelRatio(2)).toBe(2)
  })

  it('falls back to 1 for missing or nonsensical values', () => {
    expect(padPixelRatio(undefined)).toBe(1)
    expect(padPixelRatio(0)).toBe(1)
    expect(padPixelRatio(-2)).toBe(1)
    expect(padPixelRatio(Number.NaN)).toBe(1)
    // Infinity is not finite, so it is treated as a bad reading rather than
    // clamped to the cap.
    expect(padPixelRatio(Number.POSITIVE_INFINITY)).toBe(1)
  })
})
