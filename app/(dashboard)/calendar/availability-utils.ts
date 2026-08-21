/**
 * Pure helpers for the weekly-availability editor: the in-memory week
 * shape, the transforms behind the bulk actions ("Copy Monday to
 * weekdays", "Clear week"), duration maths for the per-day and weekly
 * totals, and the dirty check that drives Save / Discard.
 *
 * Kept free of React so the editor's behaviour can be unit-tested
 * without rendering, and so the tab component stays an orchestrator.
 *
 * @module app/(dashboard)/calendar/availability-utils
 */

/** One bookable window inside a day, times as 24h `HH:mm`. */
export interface TimeWindow {
  start: string;
  end: string;
}

/**
 * The editor's whole working state for the weekly schedule.
 *
 * `enabled` is the set of weekdays that contribute rules on save;
 * `windowsByDay` keeps a disabled day's windows around so toggling a
 * day off and on again does not lose what was typed.
 */
export interface WeekState {
  /** Weekday numbers (0 = Sunday) that are currently bookable. */
  enabled: number[];
  /** Windows per weekday, retained even while a day is disabled. */
  windowsByDay: Record<number, TimeWindow[]>;
}

/** Display names indexed by the DB's weekday number (0 = Sunday). */
export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/**
 * Three-letter names for narrow layouts, same indexing as
 * {@link WEEKDAY_NAMES}. The full names truncate in a modal-width row.
 */
export const WEEKDAY_SHORT_NAMES = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
] as const;

/** Row order for the editor: Monday first, Sunday last. */
export const MON_FIRST_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** Mon-Fri, the days "Copy Monday to weekdays" writes to. */
const WEEKDAYS = [2, 3, 4, 5];

/** The window a day starts with when it is first switched on. */
export const DEFAULT_WINDOW: TimeWindow = { start: '09:00', end: '17:00' };

/** A rule row as the save action expects it. */
export interface WeekRule {
  weekday: number;
  start_time: string;
  end_time: string;
}

/** Empty week: nothing bookable, no windows retained. */
export function emptyWeek(): WeekState {
  return { enabled: [], windowsByDay: {} };
}

/**
 * Build editor state from the rules returned by the DB.
 *
 * Postgres `time` columns come back as `HH:MM:SS`; the editor and the
 * save schema both speak `HH:mm`, so normalise on the way in.
 */
export function weekFromRules(rules: readonly WeekRule[]): WeekState {
  const windowsByDay: Record<number, TimeWindow[]> = {};
  const enabled: number[] = [];

  for (const rule of rules) {
    if (!windowsByDay[rule.weekday]) {
      windowsByDay[rule.weekday] = [];
      enabled.push(rule.weekday);
    }
    windowsByDay[rule.weekday]!.push({
      start: rule.start_time.slice(0, 5),
      end: rule.end_time.slice(0, 5),
    });
  }

  return { enabled, windowsByDay };
}

/** Flatten editor state into the rule rows the save action persists. */
export function rulesFromWeek(week: WeekState): WeekRule[] {
  const rules: WeekRule[] = [];
  for (const weekday of week.enabled) {
    for (const window of week.windowsByDay[weekday] ?? []) {
      rules.push({
        weekday,
        start_time: window.start,
        end_time: window.end,
      });
    }
  }
  return rules;
}

/** Windows for a weekday, empty when the day has never been touched. */
export function windowsFor(week: WeekState, weekday: number): TimeWindow[] {
  return week.windowsByDay[weekday] ?? [];
}

/** Whether a weekday is currently bookable. */
export function isEnabled(week: WeekState, weekday: number): boolean {
  return week.enabled.includes(weekday);
}

/** Minutes from midnight for a 24h `HH:mm` string. */
function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/**
 * Bookable minutes in a set of windows.
 *
 * Backwards windows (end before start) contribute nothing rather than a
 * negative total: the save schema rejects them, and a "-2h" in the row
 * while someone is mid-edit reads as a bug.
 */
export function windowsMinutes(windows: readonly TimeWindow[]): number {
  return windows.reduce((total, window) => {
    const span = toMinutes(window.end) - toMinutes(window.start);
    return total + Math.max(0, span);
  }, 0);
}

/** Bookable minutes across every enabled day. */
export function weekMinutes(week: WeekState): number {
  return week.enabled.reduce(
    (total, weekday) => total + windowsMinutes(windowsFor(week, weekday)),
    0,
  );
}

/**
 * Compact hours label: `8h`, `7.5h`, `45h`.
 *
 * Half-hours are the finest granularity the time selects offer, so one
 * decimal place is enough and trailing `.0` is dropped.
 */
export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  const rounded = Math.round(hours * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}h`;
}

/** Enable or disable a weekday, seeding a default window on first enable. */
export function setDayEnabled(
  week: WeekState,
  weekday: number,
  enabled: boolean,
): WeekState {
  if (!enabled) {
    return { ...week, enabled: week.enabled.filter((d) => d !== weekday) };
  }
  if (isEnabled(week, weekday)) return week;

  const existing = windowsFor(week, weekday);
  return {
    enabled: [...week.enabled, weekday],
    windowsByDay: {
      ...week.windowsByDay,
      [weekday]: existing.length > 0 ? existing : [{ ...DEFAULT_WINDOW }],
    },
  };
}

/** Replace the windows of one weekday. */
export function setDayWindows(
  week: WeekState,
  weekday: number,
  windows: TimeWindow[],
): WeekState {
  return {
    ...week,
    windowsByDay: { ...week.windowsByDay, [weekday]: windows },
  };
}

/**
 * Apply Monday's windows and on/off state to Tuesday-Friday.
 *
 * Weekends are deliberately untouched: an MC's Saturday is a wedding
 * day, and copying a weekday schedule over it is almost never what the
 * button was pressed for.
 */
export function copyMondayToWeekdays(week: WeekState): WeekState {
  const mondayEnabled = isEnabled(week, 1);
  const mondayWindows = windowsFor(week, 1);

  const windowsByDay = { ...week.windowsByDay };
  for (const weekday of WEEKDAYS) {
    windowsByDay[weekday] = mondayWindows.map((w) => ({ ...w }));
  }

  const enabled = week.enabled.filter((d) => !WEEKDAYS.includes(d));
  if (mondayEnabled) enabled.push(...WEEKDAYS);

  return { enabled, windowsByDay };
}

/**
 * Switch every day off, keeping their windows so Discard is not the
 * only way back from a mis-click.
 */
export function clearWeek(week: WeekState): WeekState {
  return { ...week, enabled: [] };
}

/**
 * Whether two week states would save identically.
 *
 * Compares the flattened rule rows rather than the raw objects, so
 * retained windows on a disabled day and the order days were switched
 * on in do not count as unsaved changes.
 */
export function isSameWeek(a: WeekState, b: WeekState): boolean {
  const key = (week: WeekState) =>
    rulesFromWeek(week)
      .map((r) => `${r.weekday} ${r.start_time} ${r.end_time}`)
      .sort()
      .join('|');
  return key(a) === key(b);
}

/**
 * 12-hour label for a 24h `HH:mm` string: `09:00` becomes `9:00 AM`.
 *
 * Matches how `TimeSelect` renders its options, so a saved override
 * reads the same way it was picked.
 */
export function formatTimeLabel(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const h = hours ?? 0;
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(minutes ?? 0).padStart(2, '0')} ${period}`;
}

/**
 * Short date label for an override row: `Sat 12 Sep`.
 *
 * The `T00:00:00` suffix forces local-time parsing; bare `YYYY-MM-DD`
 * is parsed as UTC and renders as the previous day west of Greenwich.
 */
export function formatOverrideDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed
    .toLocaleDateString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
    .replace(',', '');
}
