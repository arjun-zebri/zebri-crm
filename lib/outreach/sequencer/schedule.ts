/**
 * When should the next outreach message go out?
 *
 * Messages land on an allowed weekday, at a random minute inside the send
 * window, in the *recipient's* timezone (a Perth celebrant gets 9am Perth,
 * not 9am Sydney). Randomising the minute keeps the cadence human and
 * gives the timing analysis a spread of send hours to compare.
 *
 * Daily caps are counted per Sydney calendar day, the founder's day, so
 * "30 a day" means what he expects regardless of recipient zone.
 *
 * Pure: `random` and the per-day counts are injected.
 *
 * @module lib/outreach/sequencer/schedule
 */

/** The settings the scheduler reads. */
export interface ScheduleSettings {
  /** "HH:MM" or "HH:MM:SS", local to the recipient. */
  windowStart: string;
  windowEnd: string;
  /** ISO weekdays allowed, 1 = Monday. */
  weekdays: number[];
}

/** Zone that daily caps are counted in. */
export const CAP_TIMEZONE = 'Australia/Sydney';

const DAY_MS = 86_400_000;

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', weekday: 'short',
    });
    formatters.set(tz, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Wall-clock parts of `date` in `tz`. */
export function localParts(date: Date, tz: string): LocalParts {
  const parts = Object.fromEntries(formatter(tz).formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAYS[parts.weekday ?? 'Mon'] ?? 1,
  };
}

/** `YYYY-MM-DD` of `date` in `tz`. */
export function localDateKey(date: Date, tz: string): string {
  const p = localParts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/**
 * The UTC instant for a wall-clock time in `tz`. Solved by guessing UTC
 * and correcting by the zone's offset; the second pass settles DST edges.
 */
export function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const p = localParts(new Date(guess), tz);
    const seen = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += target - seen;
  }
  return new Date(guess);
}

function minutesOf(hhmm: string): number {
  const [h = '0', m = '0'] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
}

/**
 * True when `at` falls inside the recipient's send window on an allowed
 * weekday. The window end is exclusive. Used at send time: a message
 * scheduled before a settings change, or during an outage, is rescheduled
 * rather than sent out of hours.
 */
export function isInSendWindow(at: Date, timezone: string, settings: ScheduleSettings): boolean {
  const p = localParts(at, timezone);
  if (!settings.weekdays.includes(p.weekday)) return false;
  const minute = p.hour * 60 + p.minute;
  return minute >= minutesOf(settings.windowStart) && minute < minutesOf(settings.windowEnd);
}

/** Inputs for {@link nextSendTime}. */
export interface NextSendInput {
  /** Delays count from here (enrolment or the previous real send). */
  base: Date;
  delayDays: number;
  /** Recipient timezone. */
  timezone: string;
  settings: ScheduleSettings;
  /** Never schedule before this (normally "now"). */
  notBefore: Date;
  /** Messages already scheduled/sent per Sydney day, for this channel. */
  dayCounts: Map<string, number>;
  /** Cap for a given Sydney day key. */
  capFor: (dayKey: string) => number;
  random?: () => number;
}

/**
 * Pick the send instant: base + delay, rolled forward to the first
 * allowed weekday with cap headroom, at a random minute in the window.
 * Searches up to 60 days ahead, then gives up (returns null).
 */
export function nextSendTime(input: NextSendInput): Date | null {
  const random = input.random ?? Math.random;
  const start = minutesOf(input.settings.windowStart);
  const end = minutesOf(input.settings.windowEnd);
  if (end <= start || input.settings.weekdays.length === 0) return null;

  const earliest = new Date(Math.max(input.base.getTime() + input.delayDays * DAY_MS, input.notBefore.getTime()));

  for (let offset = 0; offset < 60; offset++) {
    const day = localParts(new Date(earliest.getTime() + offset * DAY_MS), input.timezone);
    if (!input.settings.weekdays.includes(day.weekday)) continue;

    // On the first candidate day, don't pick a minute that's already past.
    const nowMinutes = offset === 0 ? localParts(earliest, input.timezone) : null;
    const floor = nowMinutes && nowMinutes.year === day.year && nowMinutes.month === day.month && nowMinutes.day === day.day
      ? Math.max(start, nowMinutes.hour * 60 + nowMinutes.minute + 1)
      : start;
    if (floor >= end) continue;

    const minute = floor + Math.floor(random() * (end - floor));
    const at = zonedTimeToUtc(day.year, day.month, day.day, Math.floor(minute / 60), minute % 60, input.timezone);
    const key = localDateKey(at, CAP_TIMEZONE);
    if ((input.dayCounts.get(key) ?? 0) >= input.capFor(key)) continue;
    return at;
  }
  return null;
}

/**
 * Today's email cap under the warm-up ramp: the ramp entry for the
 * current week since `rampStartedOn`, never above the hard cap.
 */
export function rampCap(dayKey: string, rampStartedOn: string | null, ramp: number[], hardCap: number): number {
  if (ramp.length === 0) return hardCap;
  const week = rampStartedOn
    ? Math.max(0, Math.floor((Date.parse(`${dayKey}T00:00:00Z`) - Date.parse(`${rampStartedOn}T00:00:00Z`)) / (7 * DAY_MS)))
    : 0;
  return Math.min(hardCap, ramp[Math.min(week, ramp.length - 1)]!);
}
