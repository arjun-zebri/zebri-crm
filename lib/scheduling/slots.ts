/**
 * Slot-computation engine for the scheduler: given availability windows,
 * busy intervals, and constraints, generates a list of bookable time slots.
 *
 * @module lib/scheduling/slots
 */

import type { BusyInterval } from '@/lib/calendar/intervals';

import { zonedDateParts, zonedTimeToUtc } from './timezone';

/** Step size for slot generation, minutes. Spec: Phase B slot engine (task 3). */
const SLOT_STEP_MINUTES = 30;

/**
 * Recurring weekly availability window.
 * Weekday 0=Sunday through 6=Saturday. Times in HH:mm format, 24-hour, in the MC's local timezone.
 */
export interface WeeklyRule {
  weekday: number;
  start_time: string;
  end_time: string;
}

/**
 * Single-day override: either a full-day block (available=false) or custom window (available=true, times set).
 * Date in YYYY-MM-DD format. Times in HH:mm format, 24-hour, in the MC's local timezone.
 */
export interface DateOverride {
  date: string;
  available: boolean;
  start_time: string | null;
  end_time: string | null;
}

/**
 * Configuration for slot computation: availability rules, busy intervals, and constraints.
 * Timezone as IANA identifier. Buffers and durations in minutes. Constraints in hours/days.
 */
export interface SlotEngineConfig {
  timezone: string;
  rules: WeeklyRule[];
  overrides: DateOverride[];
  busy: BusyInterval[];
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minNoticeHours: number;
  maxAdvanceDays: number;
  now: Date;
}

/**
 * Bookable time slot. Start and end are ISO 8601 UTC strings without milliseconds.
 */
export interface Slot {
  start: string;
  end: string;
}

/**
 * Compute available booking slots given MC availability, busy intervals, and constraints.
 * Implements the 6-step algorithm in the Phase B slot-engine spec (task 3).
 */
export function computeSlots(
  config: SlotEngineConfig,
  range: { start: Date; end: Date },
): Slot[] {
  // Step 1: Effective window [from, to].
  const from = new Date(
    Math.max(
      range.start.getTime(),
      config.now.getTime() + config.minNoticeHours * 60 * 60 * 1000,
    ),
  );
  const to = new Date(
    Math.min(
      range.end.getTime(),
      config.now.getTime() + config.maxAdvanceDays * 24 * 60 * 60 * 1000,
    ),
  );
  if (from >= to) return [];

  // Step 2: Enumerate calendar days [from, to).
  const dates = new Set<string>();
  let cursor = new Date(from);
  while (cursor < to) {
    dates.add(zonedDateParts(cursor, config.timezone).date);
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }

  // Steps 3-6: For each date, generate slots and apply constraints.
  const slots: Slot[] = [];
  const slotDurationMs = config.durationMinutes * 60 * 1000;
  for (const date of dates) {
    for (const win of windowsForDate(date, config)) {
      // Step 4: Convert to UTC.
      const windowStart = zonedTimeToUtc(date, win.start, config.timezone);
      const windowEnd = zonedTimeToUtc(date, win.end, config.timezone);

      // Generate slots every SLOT_STEP_MINUTES, each lasting durationMinutes.
      // Why: Fit-inside-window rule requires slotEnd <= windowEnd.
      let slotStart = new Date(windowStart);
      while (slotStart.getTime() + slotDurationMs <= windowEnd.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + slotDurationMs);
        // Step 5: Keep slot if it fits [from, to) and doesn't overlap buffered busy.
        if (
          slotStart.getTime() >= from.getTime() &&
          slotEnd.getTime() <= to.getTime() &&
          !overlapsBusy(slotStart, slotEnd, config)
        ) {
          slots.push({
            start: slotStart.toISOString().replace(/\.000Z$/, 'Z'),
            end: slotEnd.toISOString().replace(/\.000Z$/, 'Z'),
          });
        }
        slotStart = new Date(slotStart.getTime() + SLOT_STEP_MINUTES * 60 * 1000);
      }
    }
  }
  // Step 6: Return sorted (already in order from enumeration).
  return slots;
}

/** Windows for a day: override takes precedence over weekly rules. */
function windowsForDate(
  date: string,
  config: SlotEngineConfig,
): Array<{ start: string; end: string }> {
  const override = config.overrides.find((o) => o.date === date);
  if (override) {
    if (!override.available) return [];
    if (override.start_time && override.end_time) {
      return [{ start: override.start_time, end: override.end_time }];
    }
  }
  // No override: weekly rules matching local weekday.
  const { weekday } = zonedDateParts(
    zonedTimeToUtc(date, '12:00', config.timezone),
    config.timezone,
  );
  return config.rules
    .filter((r) => r.weekday === weekday)
    .map((r) => ({ start: r.start_time, end: r.end_time }));
}

/** Check if slot's buffered span overlaps any busy interval (epoch-millis). */
function overlapsBusy(slotStart: Date, slotEnd: Date, config: SlotEngineConfig): boolean {
  const bufferedStart = slotStart.getTime() - config.bufferBeforeMinutes * 60_000;
  const bufferedEnd = slotEnd.getTime() + config.bufferAfterMinutes * 60_000;
  // Why: Two-sided check (A.start < B.end && B.start < A.end) ensures no overlap.
  for (const busy of config.busy) {
    const busyStart = Date.parse(busy.start);
    const busyEnd = Date.parse(busy.end);
    if (bufferedStart < busyEnd && busyStart < bufferedEnd) return true;
  }
  return false;
}
