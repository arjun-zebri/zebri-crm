/**
 * Quiet hours: defer a send to the next allowed local-time window.
 *
 * Every messaging action that respects quiet hours calls
 * {@link nextAllowedSendAt} with the requested send timestamp and
 * the couple's timezone (snapshot in {@link CoupleSnapshot.timezone}).
 *
 * If the requested time falls inside the quiet window (e.g.
 * 21:00–08:00 in the couple's local timezone), the function returns
 * the next moment that is just outside it. Otherwise it returns
 * the requested time unchanged.
 *
 * Per-automation overrides take precedence over the workspace
 * default; both default to "no quiet hours" when unset.
 *
 * @module lib/automations/quiet-hours
 */

import type { McSnapshot } from '@/types/automations'

const DEFAULT_TIMEZONE = 'Australia/Sydney'

export interface QuietHoursWindow {
  /** 'HH:MM' (24h) local time, inclusive lower bound. */
  start: string
  /** 'HH:MM' (24h) local time, exclusive upper bound. */
  end: string
  /** IANA timezone name. */
  timezone: string
}

/**
 * Resolve the effective quiet-hours window for an action:
 *   1. Per-automation override (the `quiet_hours_start`/`end` on
 *      the automations row)
 *   2. Workspace default (the MC's user_metadata)
 *   3. None - `null` means "send any time".
 */
export function resolveQuietHours(
  automationStart: string | null,
  automationEnd: string | null,
  mc: McSnapshot,
  coupleTimezone: string | null,
): QuietHoursWindow | null {
  const start = automationStart ?? mc.quietHoursStart
  const end = automationEnd ?? mc.quietHoursEnd
  if (!start || !end) return null
  return {
    start,
    end,
    timezone: coupleTimezone ?? mc.quietHoursTimezone ?? DEFAULT_TIMEZONE,
  }
}

/**
 * Compute the next send timestamp that respects the window.
 *
 * If `requested` already sits outside the window in the couple's
 * local timezone, returns `requested` unchanged. Otherwise advances
 * to the window's `end` boundary on the same (or next) calendar
 * day in the couple's local timezone.
 *
 * Returns a UTC ISO timestamp string.
 */
export function nextAllowedSendAt(
  requested: Date,
  window: QuietHoursWindow,
): Date {
  if (!isInsideQuietHours(requested, window)) return new Date(requested.getTime())
  // Bump to the window's end time in the couple's local TZ. If the
  // requested time is on the "before-midnight" side of an overnight
  // window (e.g. 22:30 with a 21:00-08:00 window), the end fires the
  // next calendar day.
  return advanceToLocalTime(requested, window)
}

/**
 * Is `at` inside the quiet window when projected to the couple's
 * local timezone? Handles both same-day windows (e.g. 13:00-14:00)
 * and overnight windows (e.g. 21:00-08:00).
 */
export function isInsideQuietHours(at: Date, window: QuietHoursWindow): boolean {
  const local = projectToLocalHM(at, window.timezone)
  const start = parseHM(window.start)
  const end = parseHM(window.end)
  if (start == null || end == null || local == null) return false

  if (start < end) {
    // Same-day window
    return local >= start && local < end
  }
  // Overnight window
  return local >= start || local < end
}

/** Returns the local-time minutes since midnight in the given TZ. */
function projectToLocalHM(at: Date, tz: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(at)
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 'NaN')
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 'NaN')
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null
    return hour * 60 + minute
  } catch {
    return null
  }
}

function parseHM(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim())
  if (!m) return null
  const h = Number(m[1])
  const mm = Number(m[2])
  if (h > 23 || mm > 59) return null
  return h * 60 + mm
}

/**
 * Advance the input date to the window's end boundary in the
 * couple's local timezone.
 *
 * Quiet-hours timezone math without a real library is fiddly; we
 * approximate by computing the offset between UTC and the local
 * wall-clock for the date in question, then snapping. Accurate
 * enough for the "fire at 08:00 couple-local instead of 03:00"
 * use case - and we never need sub-minute precision.
 */
function advanceToLocalTime(from: Date, window: QuietHoursWindow): Date {
  const end = parseHM(window.end) ?? 8 * 60
  const currentLocal = projectToLocalHM(from, window.timezone) ?? 0
  const start = parseHM(window.start) ?? 21 * 60

  // Same-day window: end is later today (since we're inside it).
  let minutesToAdd: number
  if (start < end) {
    minutesToAdd = end - currentLocal
  } else {
    // Overnight: if we're after start (e.g. 22:30 with start=21:00),
    // we need to jump to tomorrow's `end`.
    if (currentLocal >= start) {
      const remainderOfToday = 24 * 60 - currentLocal
      minutesToAdd = remainderOfToday + end
    } else {
      // We're between midnight and `end` - just push to today's end.
      minutesToAdd = end - currentLocal
    }
  }
  return new Date(from.getTime() + minutesToAdd * 60_000)
}
