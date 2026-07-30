import { describe, expect, it } from 'vitest';

import {
  MAX_BREAKDOWN_SEGMENTS,
  OTHER_LABEL,
  breakdownSegments,
  isBreakdownWorthDrawing,
} from '@/lib/time-tracking/breakdown';
import { UNCATEGORISED_COLOR } from '@/lib/time-tracking/colors';
import { UNCATEGORISED_LABEL } from '@/lib/time-tracking/format';
import type { TimeEntry } from '@/types/time-tracking';

const NOW = Date.parse('2026-07-30T12:00:00.000Z');

/** An entry of `minutes` length in `category`, finished. */
function entry(
  minutes: number,
  category: string | null,
  color: string | null = null,
): TimeEntry {
  return {
    id: `e-${category ?? 'none'}-${minutes}`,
    couple_id: 'c1',
    started_at: new Date(NOW - minutes * 60_000).toISOString(),
    ended_at: new Date(NOW).toISOString(),
    category_id: category,
    category_name: category,
    category_color: color,
    note: null,
    auto_stopped: false,
  };
}

describe('breakdownSegments', () => {
  it('returns nothing when there is no tracked time', () => {
    expect(breakdownSegments([], NOW)).toEqual([]);
  });

  it('orders categories largest first', () => {
    const segments = breakdownSegments(
      [entry(10, 'Admin'), entry(60, 'Meeting'), entry(30, 'Travel')],
      NOW,
    );
    expect(segments.map((s) => s.label)).toEqual(['Meeting', 'Travel', 'Admin']);
  });

  it('computes each share against the whole', () => {
    const segments = breakdownSegments(
      [entry(75, 'Meeting'), entry(25, 'Travel')],
      NOW,
    );
    expect(segments[0]?.share).toBeCloseTo(0.75);
    expect(segments[1]?.share).toBeCloseTo(0.25);
  });

  it('sums repeated sessions in one category into a single segment', () => {
    const segments = breakdownSegments(
      [entry(20, 'Meeting'), entry(40, 'Meeting'), entry(30, 'Travel')],
      NOW,
    );
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ label: 'Meeting', ms: 60 * 60_000 });
  });

  it('carries the category colour onto its segment', () => {
    const segments = breakdownSegments(
      [entry(30, 'Meeting', '#2A78D6'), entry(10, 'Travel', '#EB6834')],
      NOW,
    );
    expect(segments[0]?.color).toBe('#2A78D6');
    expect(segments[1]?.color).toBe('#EB6834');
  });

  it('falls back to the neutral fill for a category with no colour', () => {
    const segments = breakdownSegments(
      [entry(30, 'Meeting'), entry(10, 'Travel')],
      NOW,
    );
    expect(segments[0]?.color).toBe(UNCATEGORISED_COLOR);
  });

  it('pins uncategorised last however large it is', () => {
    const segments = breakdownSegments(
      [entry(300, null), entry(10, 'Meeting', '#2A78D6')],
      NOW,
    );
    expect(segments.map((s) => s.label)).toEqual([
      'Meeting',
      UNCATEGORISED_LABEL,
    ]);
    expect(segments[1]?.color).toBe(UNCATEGORISED_COLOR);
  });

  it('folds the tail past the segment cap into Other', () => {
    const entries = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((name, i) =>
      entry(70 - i * 10, name, '#2A78D6'),
    );
    const segments = breakdownSegments(entries, NOW);

    expect(segments).toHaveLength(MAX_BREAKDOWN_SEGMENTS + 1);
    expect(segments.at(-1)?.label).toBe(OTHER_LABEL);
    // F (20m) + G (10m).
    expect(segments.at(-1)?.ms).toBe(30 * 60_000);
    expect(segments.at(-1)?.color).toBe(UNCATEGORISED_COLOR);
  });

  it('keeps uncategorised after Other when both are present', () => {
    const entries = [
      ...['A', 'B', 'C', 'D', 'E', 'F'].map((name, i) =>
        entry(70 - i * 10, name, '#2A78D6'),
      ),
      entry(5, null),
    ];
    const segments = breakdownSegments(entries, NOW);
    expect(segments.at(-2)?.label).toBe(OTHER_LABEL);
    expect(segments.at(-1)?.label).toBe(UNCATEGORISED_LABEL);
  });

  it('shares always add up to the whole', () => {
    const segments = breakdownSegments(
      [entry(45, 'Meeting'), entry(30, 'Travel'), entry(15, null)],
      NOW,
    );
    const total = segments.reduce((sum, s) => sum + s.share, 0);
    expect(total).toBeCloseTo(1);
  });

  it('drops a zero-length session rather than adding an empty segment', () => {
    const running: TimeEntry = { ...entry(0, 'Meeting'), ended_at: null };
    const segments = breakdownSegments([entry(30, 'Travel'), running], NOW);
    expect(segments.map((s) => s.label)).toEqual(['Travel']);
  });
});

describe('isBreakdownWorthDrawing', () => {
  it('refuses a single segment, which a solid block cannot explain', () => {
    const segments = breakdownSegments([entry(30, 'Meeting')], NOW);
    expect(segments).toHaveLength(1);
    expect(isBreakdownWorthDrawing(segments)).toBe(false);
  });

  it('refuses an empty timesheet', () => {
    expect(isBreakdownWorthDrawing([])).toBe(false);
  });

  it('draws once a second category exists', () => {
    const segments = breakdownSegments(
      [entry(30, 'Meeting'), entry(10, 'Travel')],
      NOW,
    );
    expect(isBreakdownWorthDrawing(segments)).toBe(true);
  });
});
