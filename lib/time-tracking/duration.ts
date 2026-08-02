/**
 * Parsing, formatting and stepping for the duration field on the manual
 * time-entry form.
 *
 * The form asks "how long did this take", not "when did it start and
 * stop": an MC writing up a venue walkthrough after the fact remembers
 * "about an hour and a half", not a pair of clock times. So the field
 * steps in quarter hours, which covers almost every entry in two
 * clicks, and stays free text so anyone who does want 1h 07m can type
 * it.
 *
 * React-free and dependency-free so the parsing rules can be unit
 * tested directly rather than through the field.
 *
 * @module lib/time-tracking/duration
 */

/** Quantum the stepper moves by, in minutes. */
export const DURATION_STEP_MINUTES = 15;

/** `1:30`, `0:20`. Minutes are constrained so `1:60` is a typo, not 2h. */
const CLOCK_RE = /^(\d+):([0-5]\d)$/;

/**
 * `1h`, `1.5h`, `1h30`, `1h 30m`, `1hr 30min`. The minutes unit is
 * optional because typing `1h30` is faster than `1h30m` and means the
 * same thing.
 */
const HOURS_RE =
  /^(\d+(?:\.\d+)?)\s*h(?:r|rs|our|ours)?\s*(?:(\d+)\s*(?:m|min|mins|minute|minutes)?)?$/;

/** `45m`, `45min`. */
const MINUTES_RE = /^(\d+)\s*m(?:in|ins|inute|inutes)?$/;

/** A bare number, read as minutes. */
const BARE_RE = /^\d+$/;

/**
 * Read a typed duration as whole minutes, or `null` if it isn't one.
 *
 * A bare number means minutes (`90` → 1h 30m). That is a guess either
 * way, but the field re-renders what it parsed as soon as it loses
 * focus, so a wrong guess is visible and one edit away rather than
 * silently saved.
 *
 * Zero is rejected along with the unparseable: a session of no length
 * is not a session, and saving one would put a `0m` row in the
 * timesheet that no one meant to create.
 */
export function parseDurationInput(raw: string): number | null {
  const text = raw.trim().toLowerCase();
  if (!text) return null;

  const minutes = readMinutes(text);
  if (minutes === null || minutes <= 0) return null;
  return minutes;
}

/** The pattern matching itself, split out to keep the guards above readable. */
function readMinutes(text: string): number | null {
  const clock = CLOCK_RE.exec(text);
  if (clock?.[1] !== undefined && clock[2] !== undefined) {
    return Number(clock[1]) * 60 + Number(clock[2]);
  }

  const hours = HOURS_RE.exec(text);
  if (hours?.[1] !== undefined) {
    // Decimal hours land off a whole minute (`0.4h`), so round rather
    // than truncate: 24 minutes reads as intended, 23 reads as a bug.
    return Math.round(Number(hours[1]) * 60) + Number(hours[2] ?? 0);
  }

  const mins = MINUTES_RE.exec(text);
  if (mins?.[1] !== undefined) return Number(mins[1]);

  if (BARE_RE.test(text)) return Number(text);

  return null;
}

/**
 * Render minutes the way the field displays them: `45m`, `1h`,
 * `2h 5m`.
 *
 * Long sessions stay in hours (`25h`) rather than growing a day unit.
 * A timesheet is read in hours, and "1d 1h" would have to be converted
 * back before it meant anything.
 */
export function formatDurationInput(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/**
 * Move one step up or down, snapping onto the quarter-hour grid.
 *
 * Stepping from an off-grid value (1h 07m, typed by hand or left by a
 * live timer) lands on 1h 15m rather than 1h 22m: the stepper exists to
 * get back to round numbers, so carrying the offset forward would
 * defeat it.
 *
 * The floor is one step. Zero is not a saveable duration, so offering
 * it as a stop on the way down only creates a state the Save button
 * rejects.
 */
export function stepDurationMinutes(minutes: number, direction: 1 | -1): number {
  const step = DURATION_STEP_MINUTES;
  const next =
    direction === 1
      ? Math.floor(minutes / step) * step + step
      : Math.ceil(minutes / step) * step - step;
  return Math.max(step, next);
}
