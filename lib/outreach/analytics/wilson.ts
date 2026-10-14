/**
 * Wilson score interval for a proportion.
 *
 * Outreach samples are small (a few hundred sends, a handful of replies),
 * where the naive "3 / 40 = 7.5%" badly overstates certainty. Wilson
 * stays sensible at small n and at 0% / 100%, so the analytics can show
 * an honest range next to every rate.
 *
 * Pure.
 *
 * @module lib/outreach/analytics/wilson
 */

/** A rate with its 95% interval, all as fractions 0-1. */
export interface RateWithInterval {
  successes: number;
  n: number;
  rate: number | null;
  low: number | null;
  high: number | null;
}

/** Rows below this size are flagged "too early to call" in the UI. */
export const MIN_SAMPLE = 30;

/** 95% Wilson interval for `successes` out of `n`. */
export function wilson(successes: number, n: number, z = 1.96): RateWithInterval {
  if (n <= 0) return { successes, n, rate: null, low: null, high: null };
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { successes, n, rate: p, low: Math.max(0, centre - margin), high: Math.min(1, centre + margin) };
}
