/**
 * Number formatting for the Analytics view.
 *
 * @module features/outreach/views/analytics/format
 */

/** A 0-1 fraction as a whole percent, e.g. 0.123 becomes "12%". A missing rate shows a dash. */
export function formatPct(v: number | null): string {
  return v === null ? '–' : `${Math.round(v * 100)}%`;
}

/** "3 Oct" from a "2026-10-03" day string. Parsed as local midnight so the day never shifts. */
export function formatDay(day: string): string {
  const d = new Date(`${day}T00:00:00`);
  return Number.isNaN(d.getTime()) ? day : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}
