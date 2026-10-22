import { minutesOf, type Span, type Unit } from './booking-data';

/**
 * A span of time typed the way people say it, and read back the same
 * way: "90", "1 hr 30", "1h30m", "2 days", "3 months". A bare number
 * takes the setting's own unit (minutes for a length, days for notice).
 * Minutes and hours mixed come out as minutes, so "1 hr 30" is 90 min
 * and reads back "1 hr 30 min" (`spanLabel`). Each setting allows only units that make
 * sense for it (a length is never in months). Pure.
 *
 * @module app/design-system/v2/pages/dashboard/booking/span-text
 */

const WORDS: [RegExp, Unit][] = [
  [/^(m|mins?|minutes?)$/, 'min'],
  [/^(h|hrs?|hours?)$/, 'hr'],
  [/^(d|days?)$/, 'day'],
  [/^(w|wks?|weeks?)$/, 'week'],
  [/^(mo|mos|months?)$/, 'month'],
];

const unitOf = (word: string): Unit | null => WORDS.find(([re]) => re.test(word))?.[1] ?? null;

/** What a typed span reads as, or null when it cannot be read or uses a unit the setting does not allow. */
export function parseSpan(text: string, units: readonly Unit[], fallback: Unit): Span | null {
  const parts = [...text.toLowerCase().matchAll(/(\d+)\s*([a-z]*)/g)];
  if (!parts.length) return null;
  const read = parts.map(([, n, w]) => ({ n: Number(n), unit: w ? unitOf(w) : null }));
  if (read.some((p) => p.unit === null && read.length > 1 && p !== read[read.length - 1])) return null;
  // "1 hr 30": a trailing bare number after hours is minutes.
  const filled = read.map((p, i) => ({ n: p.n, unit: p.unit ?? (i > 0 && read[i - 1]?.unit === 'hr' ? 'min' : fallback) }));
  if (filled.length === 1) {
    const only = filled[0];
    return only && units.includes(only.unit) ? only : null;
  }
  // Several parts: only minutes and hours add up, into minutes.
  if (!filled.every((p) => p.unit === 'min' || p.unit === 'hr') || !units.includes('min')) return null;
  return { n: filled.reduce((sum, p) => sum + minutesOf(p), 0), unit: 'min' };
}
