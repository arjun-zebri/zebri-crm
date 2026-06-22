/**
 * Quiet-hours tests.
 *
 * Cover the inside/outside membership check + the next-allowed
 * advance for both same-day windows and the more common overnight
 * window (21:00 – 08:00).
 */
import { describe, expect, it } from 'vitest'

import { isInsideQuietHours, nextAllowedSendAt } from '@/lib/automations/quiet-hours'

const sydneyOvernight = {
  start: '21:00',
  end: '08:00',
  timezone: 'Australia/Sydney',
}

describe('isInsideQuietHours', () => {
  it('is outside at 14:00 Sydney for an overnight window', () => {
    const t = makeSydneyDate(2026, 6, 1, 14, 0)
    expect(isInsideQuietHours(t, sydneyOvernight)).toBe(false)
  })

  it('is inside at 22:00 Sydney for the overnight 21–08 window', () => {
    const t = makeSydneyDate(2026, 6, 1, 22, 0)
    expect(isInsideQuietHours(t, sydneyOvernight)).toBe(true)
  })

  it('is inside at 02:00 Sydney for the overnight 21–08 window', () => {
    const t = makeSydneyDate(2026, 6, 1, 2, 0)
    expect(isInsideQuietHours(t, sydneyOvernight)).toBe(true)
  })

  it('is outside at 08:30 Sydney once the window has closed', () => {
    const t = makeSydneyDate(2026, 6, 1, 8, 30)
    expect(isInsideQuietHours(t, sydneyOvernight)).toBe(false)
  })
})

describe('nextAllowedSendAt', () => {
  it('returns the input unchanged when outside the window', () => {
    const t = makeSydneyDate(2026, 6, 1, 14, 0)
    const next = nextAllowedSendAt(t, sydneyOvernight)
    expect(next.getTime()).toBe(t.getTime())
  })

  it('bumps a 22:00 request roughly forward to next-day 08:00', () => {
    const t = makeSydneyDate(2026, 6, 1, 22, 30)
    const next = nextAllowedSendAt(t, sydneyOvernight)
    expect(next.getTime()).toBeGreaterThan(t.getTime())
    const diffHours = (next.getTime() - t.getTime()) / 3_600_000
    expect(diffHours).toBeGreaterThanOrEqual(8)
    expect(diffHours).toBeLessThanOrEqual(11)
  })
})

/** Helper: build a Date that, in Sydney, reads as the given wall-clock time. */
function makeSydneyDate(y: number, m: number, d: number, h: number, min: number): Date {
  // Sydney is currently UTC+10 (winter) or UTC+11 (summer). For the
  // June test dates we use, it is UTC+10. The function uses
  // Intl.DateTimeFormat to project back to local time so test inputs
  // don't need to be too precise.
  return new Date(Date.UTC(y, m - 1, d, h - 10, min))
}
