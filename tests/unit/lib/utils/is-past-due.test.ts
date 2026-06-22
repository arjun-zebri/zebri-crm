/**
 * Unit coverage for `isPastDue` — the shared "has this date fully
 * passed?" predicate behind every overdue / expired derivation
 * (quotes, invoices, contracts, tasks).
 *
 * The regression it guards: comparing a `YYYY-MM-DD` date's midnight
 * directly against `new Date()` (the current instant) made anything
 * due *today* read as overdue the moment the clock ticked past
 * midnight. "Due today" must NOT be past due.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { isPastDue } from '@/lib/utils'

describe('isPastDue', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    // Pin to LOCAL mid-afternoon (note: month is 0-indexed → 5 = June)
    // so the pin is timezone-independent — an absolute `...Z` instant
    // would land on a different calendar day in AEST/AEDT (this is an
    // AU codebase). Mid-afternoon also means the bug, if reintroduced,
    // would visibly fire: a naive `dueMidnight < now` calls "today"
    // overdue because now is hours past midnight.
    vi.setSystemTime(new Date(2026, 5, 11, 15, 30, 0))
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  it('returns false for a date that is today', () => {
    expect(isPastDue('2026-06-11')).toBe(false)
  })

  it('returns true for a date that was yesterday', () => {
    expect(isPastDue('2026-06-10')).toBe(true)
  })

  it('returns false for a date in the future', () => {
    expect(isPastDue('2026-06-12')).toBe(false)
  })

  it('returns false for null / undefined / empty', () => {
    expect(isPastDue(null)).toBe(false)
    expect(isPastDue(undefined)).toBe(false)
    expect(isPastDue('')).toBe(false)
  })

  it('returns false for an unparseable date rather than throwing', () => {
    expect(isPastDue('not-a-date')).toBe(false)
  })
})
