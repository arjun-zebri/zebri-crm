import type { CSSProperties } from 'react';

/**
 * Design system v2 progress bar (preview): how far through something is,
 * as a thin grass bar on a zebra track, 4px tall with round ends, the
 * fill easing to its new width at the house speed. A real `progressbar`
 * with its label and values, so it reads as "Arjun, 2 of 20". Complete,
 * the fill is the full grass. For a count of things done (a couple's
 * answers), not for time passing.
 *
 * `edge` draws it as the bottom edge of a bar instead: 2px, square, on
 * the hairline, laid over the bar's own border (the couple's form on a
 * phone; user, 2026-10-15: a row of dashes looked "very old school").
 * Its parent must be `relative`.
 *
 * @example
 * ```tsx
 * <ProgressBar label="Arjun's answers" value={2} max={20} />
 * <header className="relative border-b border-hairline">
 *   …
 *   <ProgressBar edge label="Part 3 of 9" value={3} max={9} />
 * </header>
 * ```
 *
 * @module components/ui-v2/progress-bar
 */

export interface ProgressBarProps {
  /** What it measures, for screen readers. */
  label: string;
  value: number;
  max: number;
  /** The bottom edge of its `relative` parent, over its border. */
  edge?: boolean | undefined;
}

/** v2 progress bar. See {@link ProgressBarProps}. */
export function ProgressBar({ label, value, max, edge = false }: ProgressBarProps) {
  const share = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  // The width is data (a share of the track), so it rides in on a custom property.
  const width = { '--progress': `${share * 100}%` } as CSSProperties;
  const track = edge ? 'absolute inset-x-0 -bottom-px h-0.5 bg-hairline' : 'h-1 overflow-hidden rounded-pill bg-zebra-200';
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className={track}>
      <div
        style={width}
        className={`h-full w-[var(--progress)] bg-grass-500 transition-[width] duration-300 ease-out motion-reduce:transition-none ${edge ? '' : 'rounded-pill'}`}
      />
    </div>
  );
}
