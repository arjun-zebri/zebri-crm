/**
 * Where this couple's tracked hours went, as one thin stacked bar.
 *
 * Part-to-whole with a handful of categories, so a stacked bar rather
 * than a donut: proportion is readable at a glance and it costs one row
 * of the tab header instead of a panel.
 *
 * The total stays a plain number beside it. A chart of a single value
 * is decoration, and "4h 12m tracked" is the number the MC actually
 * bills from.
 *
 * Colour is never the only carrier of identity: every segment has a
 * legend row with its name and duration underneath. Three of the palette
 * slots sit below 3:1 contrast on white, so those labels are what makes
 * the bar accessible rather than an optional nicety.
 *
 * @module app/(dashboard)/couples/couple-time-breakdown
 */
'use client';

import {
  type BreakdownSegment,
  breakdownSegments,
  isBreakdownWorthDrawing,
} from '@/lib/time-tracking/breakdown';
import { formatDuration } from '@/lib/time-tracking/format';
import type { TimeEntry } from '@/types/time-tracking';

export interface CoupleTimeBreakdownProps {
  entries: TimeEntry[];
}

/** `48%`, or `<1%` for a slice that would otherwise round away to nothing. */
function sharePercent(share: number): string {
  const percent = Math.round(share * 100);
  return percent < 1 ? '<1%' : `${percent}%`;
}

export function CoupleTimeBreakdown({ entries }: CoupleTimeBreakdownProps) {
  const segments = breakdownSegments(entries);
  if (!isBreakdownWorthDrawing(segments)) return null;

  return (
    <div className="mt-3">
      <div
        className="flex h-1.5 w-full max-w-md gap-0.5 overflow-hidden"
        role="img"
        aria-label={`Tracked time by category: ${segments
          .map((s) => `${s.label} ${formatDuration(s.ms)}`)
          .join(', ')}`}
      >
        {segments.map((segment) => (
          <Segment key={segment.label} segment={segment} />
        ))}
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {segments.map((segment) => (
          <li
            key={segment.label}
            className="flex items-center gap-1.5 text-caption text-text-muted"
          >
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: segment.color }}
            />
            <span className="text-text">{segment.label}</span>
            <span className="tabular-nums">{formatDuration(segment.ms)}</span>
            <span className="text-text-subtle tabular-nums">
              {sharePercent(segment.share)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One fill. A minimum width keeps a five-minute slice visible instead of
 * collapsing to a hairline the gap swallows; the legend carries the real
 * number either way.
 */
function Segment({ segment }: { segment: BreakdownSegment }) {
  return (
    <span
      className="h-full rounded-[2px] first:rounded-l-full last:rounded-r-full"
      style={{
        background: segment.color,
        width: `${Math.max(segment.share * 100, 1.5)}%`,
      }}
    />
  );
}
