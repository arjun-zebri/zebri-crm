import type { CSSProperties } from 'react';

/**
 * Design system v2 mirror chart (preview): how two people spent their
 * time down an ordered list (the sections of a proposal, read top to
 * bottom). A smooth shape runs down the left, one person to the left of
 * a thin seam in grass-800 and the other to the right in grass-200, each
 * as wide as their time on the row beside it (square-root scaled, so
 * short rows keep some body), so where they lingered and which of them
 * did reads at a glance. The rows sit to the right with the combined
 * time ("4m 22s"); the longest row is bold and black, the rest grey so
 * it stands out, unless `active` names another row to bold (the section
 * being read in a live preview), and `marker` draws a line across the
 * shape at a point down it (how far through the preview the reader is).
 * A legend names the two colours. Screen readers also hear each
 * person's time per row.
 *
 * @example
 * ```tsx
 * <MirrorChart
 *   people={['Sophie', 'Max']}
 *   rows={[{ label: 'Welcome', a: 30, b: 18 }, { label: 'Packages', a: 200, b: 62 }]}
 * />
 * ```
 *
 * @module components/ui-v2/mirror-chart
 */

/** One row: its name, and each person's seconds on it. */
export interface MirrorRow {
  label: string;
  a: number;
  b: number;
}

export interface MirrorChartProps {
  /** The two people, first drawn left in the darker green. */
  people: readonly [string, string];
  rows: readonly MirrorRow[];
  /**
   * The row to bold, following something outside the chart (the section
   * of a proposal being read); `null` bolds none. Left out, the longest
   * row is bold.
   */
  active?: number | null | undefined;
  /**
   * Where to draw a horizontal line across the shape, in rows from the
   * top (0.5 is level with the first row, 1.5 with the second); held
   * between the first and last rows' middles. `null` or left out draws
   * none. It moves with no easing, so it keeps pace with a scroll that
   * drives it.
   */
  marker?: number | null | undefined;
}

/** "48s", "4m 22s", "5m". */
export const clock = (s: number) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${s % 60 ? ` ${s % 60}s` : ''}`);

// Drawing units: 100 wide with the seam at 50, and ROW tall per row.
const ROW = 20;
const MID = 50;
const HALF = 47;
const SEAM = 0.8;

/**
 * A smooth path through the points, top to bottom (Catmull-Rom turned
 * into cubic Béziers), so the shape swells between rows instead of
 * stepping. Control points are clamped to one side of the seam, so a row
 * nobody read pinches to the seam instead of bulging across it.
 */
function smooth(points: [number, number][], clampX: (x: number) => number) {
  let d = '';
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const [p1, p2] = [points[i]!, points[i + 1]!];
    const p3 = points[i + 2] ?? p2;
    const c1 = [clampX(p1[0] + (p2[0] - p0[0]) / 6), p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [clampX(p2[0] - (p3[0] - p1[0]) / 6), p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/** One person's half: out from the seam through each row's width, back up the seam. */
function half(widths: number[], side: -1 | 1) {
  const edge = MID + side * SEAM;
  const bottom = widths.length * ROW;
  const points: [number, number][] = [[edge, 0], ...widths.map((w, i): [number, number] => [edge + side * w, (i + 0.5) * ROW]), [edge, bottom]];
  const clampX = (x: number) => (side < 0 ? Math.min(x, edge) : Math.max(x, edge));
  return `M ${edge} 0${smooth(points, clampX)} L ${edge} 0 Z`;
}

/** v2 mirror chart. See {@link MirrorChartProps}. */
export function MirrorChart({ people, rows, active, marker }: MirrorChartProps) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.a, r.b]));
  // Square-root scale: a 30s row next to a 4 min one still reads as a
  // shape, not a hairline, while the long row stays clearly the widest.
  const width = (s: number) => Math.sqrt(s / max) * (HALF - SEAM);
  const top = rows.reduce((best, r, i) => (r.a + r.b > rows[best]!.a + rows[best]!.b ? i : best), 0);
  const bold = active === undefined ? top : active;
  // The line never goes above the first row's middle or below the last's,
  // so it always sits level with a row, never over the shape's tips.
  const y = marker === null || marker === undefined ? null : Math.min(Math.max(marker, 0.5), rows.length - 0.5) / rows.length;
  return (
    <figure className="space-y-4">
      <div className="flex gap-4">
        <div aria-hidden="true" className="relative w-14 shrink-0">
          <svg viewBox={`0 0 100 ${rows.length * ROW}`} preserveAspectRatio="none" className="absolute inset-0 size-full">
            <path d={half(rows.map((r) => width(r.a)), -1)} className="fill-grass-800" />
            <path d={half(rows.map((r) => width(r.b)), 1)} className="fill-grass-200" />
          </svg>
          {y !== null ? (
            <span
              style={{ '--y': `${y * 100}%` } as CSSProperties}
              className="absolute -inset-x-1 top-[var(--y)] h-px bg-zebra-950"
            />
          ) : null}
        </div>
        <ol className="min-w-0 flex-1">
          {rows.map((r, i) => (
            <li key={r.label} className="flex h-10 items-center justify-between gap-3 type-body">
              <span className="min-w-0">
                <span className={`block truncate ${i === bold ? 'type-label text-zebra-950' : 'text-zebra-500'}`}>{r.label}</span>
                <span className="sr-only">
                  {people[0]} {clock(r.a)}, {people[1]} {clock(r.b)}
                </span>
              </span>
              <span className={`shrink-0 tabular-nums ${i === bold ? 'type-label text-zebra-950' : r.a + r.b ? 'text-zebra-500' : 'text-zebra-300'}`}>
                {r.a + r.b ? clock(r.a + r.b) : 'Not read'}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <ul aria-hidden="true" className="flex gap-5 type-body text-zebra-500">
        <li className="flex items-center gap-2">
          <span className="size-2.5 rounded-check bg-grass-800" />
          {people[0]}
        </li>
        <li className="flex items-center gap-2">
          <span className="size-2.5 rounded-check bg-grass-200" />
          {people[1]}
        </li>
      </ul>
    </figure>
  );
}
