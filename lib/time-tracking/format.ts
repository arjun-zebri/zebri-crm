/**
 * Pure duration maths and display formatting for time tracking.
 *
 * React-free and dependency-free so it can be unit-tested directly and
 * shared by the server actions (which apply the 8h cap) and the client
 * (which renders it).
 *
 * @module lib/time-tracking/format
 */
import type { TimeEntry } from '@/types/time-tracking';

/**
 * Maximum length of a single running session, 8 hours. A timer left on
 * overnight is a mistake, not 14 hours of work, so reads clamp it here
 * and flag the row for correction.
 */
export const TIMER_CAP_MS = 8 * 60 * 60 * 1000;

/** Label used wherever an entry has no category. */
export const UNCATEGORISED_LABEL = 'Uncategorised';

/**
 * Ticking stopwatch display, `HH:MM:SS`, hours unbounded (`26:01:01` for
 * a long manual entry). Negative input clamps to zero so residual clock
 * skew can never render a negative count.
 */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return [
    pad(Math.floor(total / 3600)),
    pad(Math.floor((total % 3600) / 60)),
    pad(total % 60),
  ].join(':');
}

/**
 * Human duration for lists and totals: `42s`, `48m`, `1h 15m`, `2h`.
 *
 * Sub-minute sessions report seconds rather than flooring to `0m`: a
 * quick phone call is real tracked time, and "0m" reads as a bug.
 */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** The instant an 8h cap would stop a session started at `startedAtIso`. */
export function capReachedAt(startedAtIso: string): string {
  return new Date(Date.parse(startedAtIso) + TIMER_CAP_MS).toISOString();
}

/** Whether a session started at `startedAtIso` has passed the cap. */
export function isOverCap(startedAtIso: string, nowMs: number): boolean {
  return nowMs - Date.parse(startedAtIso) > TIMER_CAP_MS;
}

/**
 * Length of one entry. A finished entry measures itself; a running one
 * measures against `nowMs` and never reports more than the cap, since
 * the next server read will clamp it anyway and showing more would be a
 * number the UI later retracts.
 */
export function entryDurationMs(entry: TimeEntry, nowMs: number): number {
  const start = Date.parse(entry.started_at);
  if (entry.ended_at) return Math.max(0, Date.parse(entry.ended_at) - start);
  return Math.min(TIMER_CAP_MS, Math.max(0, nowMs - start));
}

/** Sum of every entry, running ones measured to `nowMs`. */
export function totalMs(entries: TimeEntry[], nowMs = Date.now()): number {
  return entries.reduce((sum, e) => sum + entryDurationMs(e, nowMs), 0);
}

/**
 * Per-category totals for the Time tab sub-line, largest first with
 * uncategorised pinned last: it is a gap to fill in, not a category, so
 * it should not compete for the eye's first stop.
 */
export function sumByCategory(
  entries: TimeEntry[],
  nowMs = Date.now(),
): { label: string; ms: number }[] {
  const buckets = new Map<string, number>();
  for (const e of entries) {
    const label = e.category_name ?? UNCATEGORISED_LABEL;
    buckets.set(label, (buckets.get(label) ?? 0) + entryDurationMs(e, nowMs));
  }
  return [...buckets.entries()]
    .map(([label, ms]) => ({ label, ms }))
    .sort((a, b) => {
      if (a.label === UNCATEGORISED_LABEL) return 1;
      if (b.label === UNCATEGORISED_LABEL) return -1;
      return b.ms - a.ms;
    });
}
