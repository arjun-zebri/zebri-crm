/**
 * Utility functions for calendar operations.
 * Helpers for date calculations, formatting, and label generation.
 */

/**
 * Get all days for a month's calendar grid (42 days: 6 weeks).
 * Includes days from previous/next months to fill the grid.
 */
export function getMonthDays(date: Date): Date[] {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

/**
 * Get the Sunday (start) of the week containing the given date.
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

/**
 * Get all 7 days of the week starting from Sunday.
 */
export function getWeekDays(date: Date): Date[] {
  const start = getWeekStart(date);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

/**
 * Format a Date as YYYY-MM-DD string using local date components.
 * Uses local date components, not toISOString (UTC), so events stored as
 * bare Postgres `date` (e.g. "2026-06-07") line up with the cell the MC
 * sees as June 7 in their own timezone.
 */
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Generate event label: "Couple Name – Event Title", or just couple name if no title.
 */
export function formatEventLabel(event: { couple?: { name: string }; title?: string | null }): string {
  const name = event.couple?.name || "Unnamed";
  return event.title ? `${name} – ${event.title}` : name;
}

/**
 * Check if a given date is today.
 */
export function isTodayFn(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}
