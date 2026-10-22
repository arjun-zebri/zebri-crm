/**
 * Small display formatters for the Checks view. Australian English
 * dates and dollars, since every prospect and invoice is AU.
 *
 * @module features/outreach/views/checks/format
 */

/** Short date and time, e.g. "12 Oct, 9:05 am". */
export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** Short date, e.g. "3 Sep 2024". */
export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Cents to a US-dollar string, e.g. 1250 becomes "US$12.50". The prefix
 * is "US$" rather than "$" because the Settings page states the budget in
 * USD, and a bare "$" on this AU-based screen reads as Australian dollars.
 */
export function formatUsd(cents: number): string {
  return `US$${(cents / 100).toFixed(2)}`;
}
