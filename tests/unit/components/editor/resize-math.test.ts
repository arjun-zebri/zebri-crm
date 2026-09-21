/**
 * Unit tests for the pure drag maths shared by every resize handle:
 * snapping, clamping, step rounding, and the combined `dragValue`
 * pipeline a `ResizeGrip` drag runs through.
 *
 * @module tests/unit/components/editor/resize-math
 */
import { describe, expect, it } from 'vitest'

import { applySnaps, clamp, dragValue, stepRound } from '@/components/editor/resize-math'

describe('resize-math', () => {
  it('snaps within tolerance and leaves values outside it alone', () => {
    const snaps = [{ value: 32 }, { value: 48 }, { value: 64 }]
    expect(applySnaps(50, snaps, 4)).toBe(48)
    expect(applySnaps(56, snaps, 4)).toBe(56)
  })
  it('clamps and rounds to steps', () => {
    expect(clamp(500, 0, 240)).toBe(240)
    expect(stepRound(13, 8)).toBe(16)
  })
  it('dragValue divides screen px by zoom and scale, then clamps, steps and snaps', () => {
    // 50% zoom: 100 screen px is 200 layout px; scale 7.2 layout px per vh.
    expect(dragValue({ start: 50, deltaScreenPx: 100, zoom: 0.5, scale: 7.2, min: 10, max: 100 })).toBe(78)
    expect(dragValue({ start: 40, deltaScreenPx: 4, zoom: 1, min: 8, max: 160, step: 8 })).toBe(48)
    expect(dragValue({ start: 700, deltaScreenPx: 15, zoom: 1, min: 320, max: 1400, snaps: [{ value: 720 }], tolerance: 12 })).toBe(720)
  })
})
