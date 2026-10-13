/**
 * Booking time formatting: the en-AU house style, locale fallback, the
 * day-of-slot rules, and the MC-zone hint.
 *
 * @module tests/unit/lib/booking/format-time
 */
import { describe, expect, it } from 'vitest'

import {
  cityFromTimezone,
  zoneLabel,
  formatBookingDate,
  formatBookingWhen,
  formatMcHint,
  formatSummaryWhen,
  formatTimeOfDay,
  formatTimeRange,
  pickLocale,
} from '@/lib/booking/format-time'

// 2026-10-14 00:30 UTC = 11:30 Sydney (AEDT, UTC+11) = 08:30 Perth (AWST, UTC+8).
const START = '2026-10-14T00:30:00Z'
const END = '2026-10-14T01:00:00Z'
const SYDNEY = 'Australia/Sydney'
const PERTH = 'Australia/Perth'

describe('pickLocale', () => {
  it('uses the browser language when it is usable', () => {
    expect(pickLocale('en-US')).toBe('en-US')
    expect(pickLocale('en-gb')).toBe('en-GB')
  })

  it('falls back to en-AU when the language is missing or malformed', () => {
    expect(pickLocale(undefined)).toBe('en-AU')
    expect(pickLocale(null)).toBe('en-AU')
    expect(pickLocale('')).toBe('en-AU')
    expect(pickLocale('not a locale!!')).toBe('en-AU')
  })
})

describe('formatTimeRange', () => {
  it('writes the range with the period once and the zone name, in en-AU', () => {
    expect(formatTimeRange(START, END, SYDNEY, 'en-AU')).toBe('11:30am–12:00pm AEDT')
  })

  it('omits the period from the start when both ends share it', () => {
    // 10:30 and 11:00 in the morning.
    expect(formatTimeRange('2026-10-14T23:30:00Z', '2026-10-15T00:00:00Z', SYDNEY, 'en-AU')).toBe('10:30–11:00am AEDT')
  })

  it('keeps Intl spacing for a locale that does not glue the period on', () => {
    expect(formatTimeRange(START, END, SYDNEY, 'en-US')).toMatch(/11:30 AM–12:00 PM/)
  })

  it('reads the zone the times are shown in, not the MC\'s', () => {
    // 00:30 UTC is 08:30 in Perth (UTC+8), not the 11:30 Sydney reads.
    expect(formatTimeRange(START, END, PERTH, 'en-AU')).toBe('8:30–9:00am AWST')
  })
})

describe('formatBookingDate and formatTimeOfDay', () => {
  it('gives the weekday, day and month in full', () => {
    expect(formatBookingDate(START, SYDNEY, 'en-AU')).toBe('Wednesday 14 October')
  })

  it('gives a short time of day with no zone', () => {
    expect(formatTimeOfDay(START, SYDNEY, 'en-AU')).toBe('11:30am')
  })
})

describe('formatBookingWhen', () => {
  it('joins the day and the range with a middle dot', () => {
    expect(formatBookingWhen(START, END, SYDNEY, 'en-AU')).toBe('Wednesday 14 October · 11:30am–12:00pm AEDT')
  })
})

describe('formatSummaryWhen', () => {
  it('gives the short line for the mobile summary bar', () => {
    expect(formatSummaryWhen(START, SYDNEY, 'en-AU')).toBe('Wed 14 Oct · 11:30am')
  })
})

describe('cityFromTimezone', () => {
  it('takes the last segment and turns underscores into spaces', () => {
    expect(cityFromTimezone('Australia/Sydney')).toBe('Sydney')
    expect(cityFromTimezone('America/Port_of_Spain')).toBe('Port of Spain')
    expect(cityFromTimezone('UTC')).toBe('UTC')
  })
})

describe('formatMcHint', () => {
  it('says what the time is in the MC\'s city when the zones differ', () => {
    expect(formatMcHint(START, PERTH, SYDNEY, 'en-AU')).toBe("That's 11:30am in Sydney.")
  })

  it('returns null when the booker is already in the MC\'s zone', () => {
    expect(formatMcHint(START, SYDNEY, SYDNEY, 'en-AU')).toBeNull()
  })

  it('returns null when the MC zone is not known yet', () => {
    expect(formatMcHint(START, PERTH, '', 'en-AU')).toBeNull()
  })
})

describe('zoneLabel', () => {
  const when = new Date('2026-10-14T00:30:00Z')

  it('never shows an offset like GMT+11 for an Australian zone, whatever the browser locale', () => {
    for (const locale of ['en-US', 'en-GB', 'de-DE', 'en-AU']) {
      expect(zoneLabel(when, 'Australia/Sydney', locale)).toBe('AEDT')
    }
  })

  it('follows daylight saving', () => {
    expect(zoneLabel(new Date('2026-07-01T00:00:00Z'), 'Australia/Sydney', 'en-US')).toBe('AEST')
  })

  it('falls back to the city when no locale has a name for the zone', () => {
    expect(zoneLabel(when, 'Asia/Kolkata', 'en-AU')).toMatch(/^(IST|Kolkata time)$/)
    expect(zoneLabel(when, 'Pacific/Port_Moresby', 'en-US')).toBe('Port Moresby time')
  })

  it('is used in the range, so an en-GB reader of a Sydney time sees AEDT', () => {
    expect(formatTimeRange(START, END, SYDNEY, 'en-GB')).toMatch(/AEDT$/)
  })
})
