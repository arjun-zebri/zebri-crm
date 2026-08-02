/**
 * Shaping the Time tab's per-category totals into bar segments.
 *
 * Kept apart from the component so the folding and share maths can be
 * unit-tested directly, and so the rules that make the bar honest live
 * in one readable place rather than inside JSX.
 *
 * @module lib/time-tracking/breakdown
 */
import type { TimeEntry } from '@/types/time-tracking';

import { UNCATEGORISED_COLOR } from './colors';
import { UNCATEGORISED_LABEL, entryDurationMs } from './format';

/** One segment of the breakdown bar. */
export interface BreakdownSegment {
  label: string;
  ms: number;
  /** Share of the total, 0–1. */
  share: number;
  /** Resolved fill; never null, so the bar never renders a hole. */
  color: string;
}

/**
 * How many real categories the bar draws before folding the rest.
 *
 * The categorical palette is validated for adjacent pairs up to eight
 * slots, but a bar with eight segments is a rainbow nobody reads. Five
 * plus "Other" keeps the common case ("where did the hours go") legible
 * and matches the soft cap in the visualisation guidance.
 */
export const MAX_BREAKDOWN_SEGMENTS = 5;

/** Label for the folded tail. */
export const OTHER_LABEL = 'Other';

/**
 * Fewest segments worth drawing a bar for.
 *
 * One segment is a solid block that says nothing beyond the total
 * already printed beside it, so the caller renders the chips alone.
 */
export const MIN_BREAKDOWN_SEGMENTS = 2;

/**
 * Per-category segments, largest first, tail folded into "Other" and
 * uncategorised pinned last.
 *
 * Uncategorised never competes for the eye's first stop and never gets
 * folded away: it is the actionable gap, so it keeps its own segment in
 * the neutral fill even when it is small.
 */
export function breakdownSegments(
  entries: TimeEntry[],
  nowMs = Date.now(),
): BreakdownSegment[] {
  const buckets = new Map<string, { ms: number; color: string | null }>();
  for (const entry of entries) {
    const label = entry.category_name ?? UNCATEGORISED_LABEL;
    const existing = buckets.get(label);
    buckets.set(label, {
      ms: (existing?.ms ?? 0) + entryDurationMs(entry, nowMs),
      // First non-null wins; every row for a category carries the same
      // flattened colour, so this only picks a winner across the
      // uncategorised bucket where there is none.
      color: existing?.color ?? entry.category_color ?? null,
    });
  }

  const total = [...buckets.values()].reduce((sum, b) => sum + b.ms, 0);
  if (total === 0) return [];

  const named = [...buckets.entries()]
    .filter(([label]) => label !== UNCATEGORISED_LABEL)
    .map(([label, b]) => ({ label, ms: b.ms, color: b.color }))
    // Zero-length buckets would add a segment of no width and a legend
    // row saying nothing.
    .filter((b) => b.ms > 0)
    .sort((a, b) => b.ms - a.ms);

  const kept = named.slice(0, MAX_BREAKDOWN_SEGMENTS);
  const folded = named.slice(MAX_BREAKDOWN_SEGMENTS);

  const segments: BreakdownSegment[] = kept.map((b) => ({
    label: b.label,
    ms: b.ms,
    share: b.ms / total,
    color: b.color ?? UNCATEGORISED_COLOR,
  }));

  if (folded.length > 0) {
    const ms = folded.reduce((sum, b) => sum + b.ms, 0);
    segments.push({
      label: OTHER_LABEL,
      ms,
      share: ms / total,
      // Neutral, not a sixth hue: "Other" is a bucket, not a category,
      // and colouring it would imply it names one thing.
      color: UNCATEGORISED_COLOR,
    });
  }

  const uncategorised = buckets.get(UNCATEGORISED_LABEL);
  if (uncategorised && uncategorised.ms > 0) {
    segments.push({
      label: UNCATEGORISED_LABEL,
      ms: uncategorised.ms,
      share: uncategorised.ms / total,
      color: UNCATEGORISED_COLOR,
    });
  }

  return segments;
}

/** Whether a bar would tell the reader anything the total does not. */
export function isBreakdownWorthDrawing(
  segments: BreakdownSegment[],
): boolean {
  return segments.length >= MIN_BREAKDOWN_SEGMENTS;
}
