/**
 * Add-to-calendar builders: UTC stamps, Google and Outlook URLs, and the ICS
 * document (escaping, folding, CRLF, stable UID).
 *
 * @module tests/unit/lib/booking/calendar-links
 */
import { describe, expect, it } from 'vitest'

import {
  buildEventUid,
  buildGoogleCalendarUrl,
  buildIcs,
  buildOutlookCalendarUrl,
  escapeIcsText,
  foldIcsLine,
  toUtcStamp,
  type CalendarEvent,
} from '@/lib/booking/calendar-links'

const event: CalendarEvent = {
  title: 'Consultation with Lemon Weddings',
  start: '2026-10-14T00:30:00Z',
  end: '2026-10-14T01:00:00Z',
  description: 'Bring your questions, ideas & dates',
  location: 'https://meet.example.test/abc',
}

describe('toUtcStamp', () => {
  it('writes a basic-format UTC stamp regardless of the input offset', () => {
    expect(toUtcStamp('2026-10-14T00:30:00Z')).toBe('20261014T003000Z')
    expect(toUtcStamp('2026-10-14T10:30:00+10:00')).toBe('20261014T003000Z')
  })

  it('throws on an invalid date rather than writing NaN into a calendar', () => {
    expect(() => toUtcStamp('not a date')).toThrow(RangeError)
  })
})

describe('buildGoogleCalendarUrl', () => {
  it('builds a TEMPLATE link with UTC dates and encoded text', () => {
    const url = new URL(buildGoogleCalendarUrl(event))

    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('text')).toBe('Consultation with Lemon Weddings')
    expect(url.searchParams.get('dates')).toBe('20261014T003000Z/20261014T010000Z')
    expect(url.searchParams.get('details')).toBe('Bring your questions, ideas & dates')
    expect(url.searchParams.get('location')).toBe('https://meet.example.test/abc')
  })

  it('leaves out details and location when they are empty', () => {
    const url = new URL(buildGoogleCalendarUrl({ ...event, description: undefined, location: undefined }))

    expect(url.searchParams.has('details')).toBe(false)
    expect(url.searchParams.has('location')).toBe(false)
  })
})

describe('buildOutlookCalendarUrl', () => {
  it('builds a compose deeplink with ISO instants', () => {
    const url = new URL(buildOutlookCalendarUrl(event))

    expect(url.origin + url.pathname).toBe('https://outlook.live.com/calendar/0/deeplink/compose')
    expect(url.searchParams.get('subject')).toBe('Consultation with Lemon Weddings')
    expect(url.searchParams.get('startdt')).toBe('2026-10-14T00:30:00.000Z')
    expect(url.searchParams.get('enddt')).toBe('2026-10-14T01:00:00.000Z')
    expect(url.searchParams.get('rru')).toBe('addevent')
    expect(url.searchParams.get('body')).toBe('Bring your questions, ideas & dates')
  })
})

describe('escapeIcsText', () => {
  it('escapes backslash first, then semicolon, comma and newline', () => {
    expect(escapeIcsText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne')
  })

  it('treats CRLF and bare CR as one newline', () => {
    expect(escapeIcsText('one\r\ntwo\rthree')).toBe('one\\ntwo\\nthree')
  })
})

describe('foldIcsLine', () => {
  it('leaves short lines alone', () => {
    expect(foldIcsLine('SUMMARY:Short')).toBe('SUMMARY:Short')
  })

  it('folds at 75 octets and continues with a leading space', () => {
    const line = 'DESCRIPTION:' + 'x'.repeat(200)
    const folded = foldIcsLine(line)
    const parts = folded.split('\r\n')

    expect(parts[0]!.length).toBe(75)
    for (const continuation of parts.slice(1)) {
      expect(continuation.startsWith(' ')).toBe(true)
      expect(new TextEncoder().encode(continuation).length).toBeLessThanOrEqual(75)
    }
    expect(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join('')).toBe(line)
  })

  it('never splits a multi-byte character', () => {
    const line = 'SUMMARY:' + 'é'.repeat(80)
    const parts = foldIcsLine(line).split('\r\n')
    const rejoined = parts.map((p, i) => (i === 0 ? p : p.slice(1))).join('')

    expect(rejoined).toBe(line)
    for (const part of parts) {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75)
    }
  })
})

describe('buildIcs', () => {
  const now = new Date('2026-10-13T08:00:00Z')
  const ics = buildIcs({ ...event, uid: 'uid-1@zebri', now })

  it('is a CRLF document with one VEVENT in UTC', () => {
    expect(ics.split('\r\n').slice(0, 2)).toEqual(['BEGIN:VCALENDAR', 'VERSION:2.0'])
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics).not.toMatch(/[^\r]\n/)
    expect(ics).toContain('DTSTART:20261014T003000Z\r\n')
    expect(ics).toContain('DTEND:20261014T010000Z\r\n')
    expect(ics).toContain('DTSTAMP:20261013T080000Z\r\n')
    expect(ics).toContain('UID:uid-1@zebri\r\n')
  })

  it('escapes the description and summary', () => {
    expect(ics).toContain('DESCRIPTION:Bring your questions\\, ideas & dates\r\n')
    const commas = buildIcs({ ...event, title: 'Hi, there; friend', uid: 'u', now })
    expect(commas).toContain('SUMMARY:Hi\\, there\\; friend\r\n')
  })

  it('omits optional properties that have no value', () => {
    const bare = buildIcs({ title: 'T', start: event.start, end: event.end, uid: 'u', now })
    expect(bare).not.toContain('DESCRIPTION:')
    expect(bare).not.toContain('LOCATION:')
    expect(bare).not.toContain('URL:')
  })
})

describe('buildEventUid', () => {
  it('is the same for the same booking, so re-importing updates one event', () => {
    expect(buildEventUid(event.start, event.title)).toBe(buildEventUid(event.start, event.title))
  })

  it('differs when the time or the title differs', () => {
    expect(buildEventUid(event.start, 'A')).not.toBe(buildEventUid(event.start, 'B'))
    expect(buildEventUid(event.start, 'A')).not.toBe(buildEventUid('2026-10-15T00:30:00Z', 'A'))
  })
})
