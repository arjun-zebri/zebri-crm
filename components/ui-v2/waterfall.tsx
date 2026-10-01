import type { CSSProperties } from 'react';

/**
 * Design system v2 waterfall chart (preview): a starting total, the
 * amounts lost along the way as floating bars, and what is left at the
 * end. The start is grass-700, each loss a quiet grey bar hanging from
 * where the last one ended, and the end grass-900, so the eye reads
 * "from this many, down to this many". One loss can be `highlight`ed in
 * amber (bar, figure and label) for the step the page is talking about;
 * say why in words beside the chart, never colour one without a reason.
 * A dashed rule at each loss's lower edge carries the level across to
 * the next column (none over the start: its top needs no marking). The figure sits above each bar ("−4" for a loss),
 * the name and one quiet line ("17 left") below; phones show each
 * column's `short` name and drop the quiet line.
 *
 * `focus` lights one loss while the rest fade back, for a list beside
 * the chart pointing at the step a row belongs to (as the Payments cash
 * flow chart lights a month).
 *
 * The plot takes the height of its `plotClassName` (give it one), and
 * columns share the width. Screen readers get the same figures as a list.
 *
 * @example
 * ```tsx
 * <Waterfall
 *   label="Proposals from sent to booked"
 *   start={{ label: 'Sent', sub: 'proposals', value: 21 }}
 *   drops={[{ label: "Didn't open", value: 4 }, { label: 'Saw packages, didn’t accept', value: 8 }]}
 *   end={{ label: 'Booked', sub: 'deposit paid' }}
 *   highlight={1}
 *   plotClassName="h-56"
 * />
 * ```
 *
 * @module components/ui-v2/waterfall
 */

/** One column's words: its name, and the quiet line under it. */
export interface WaterfallLabel {
  label: string;
  /** A shorter name for phones, where six columns leave little room. */
  short?: string | undefined;
  sub?: string | undefined;
}

export interface WaterfallProps {
  /** Names the chart for screen readers. */
  label: string;
  start: WaterfallLabel & { value: number };
  /** Each loss in order; its line reads "N left" unless given a `sub`. */
  drops: readonly (WaterfallLabel & { value: number })[];
  /** The end column; its value is what is left after the drops. */
  end: WaterfallLabel;
  /** Index into `drops` to pick out in amber. */
  highlight?: number | undefined;
  /** Index into `drops` to keep lit while every other column fades back. */
  focus?: number | null | undefined;
  /** Sizing for the plot area, usually a height. */
  plotClassName?: string | undefined;
}


const FILL = { start: 'bg-grass-700', drop: 'bg-zebra-200', hot: 'bg-warning-muted', end: 'bg-grass-900' } as const;
const FIGURE = { start: 'text-zebra-950', drop: 'text-zebra-600', hot: 'text-warning-ink', end: 'text-zebra-950' } as const;

type Column = { label: string; short: string; sub: string; top: number; bottom: number; figure: string; tone: 'start' | 'drop' | 'hot' | 'end' };

/** v2 waterfall. See {@link WaterfallProps}. */
export function Waterfall({ label, start, drops, end, highlight, focus, plotClassName }: WaterfallProps) {
  const max = Math.max(start.value, 1);
  let level = start.value;
  const columns: Column[] = [{ label: start.label, short: start.short ?? start.label, sub: start.sub ?? '', top: start.value, bottom: 0, figure: String(start.value), tone: 'start' }];
  drops.forEach((d, i) => {
    const after = Math.max(0, level - d.value);
    columns.push({ label: d.label, short: d.short ?? d.label, sub: d.sub ?? `${after} left`, top: level, bottom: after, figure: d.value ? `−${d.value}` : '0', tone: i === highlight ? 'hot' : 'drop' });
    level = after;
  });
  columns.push({ label: end.label, short: end.short ?? end.label, sub: end.sub ?? '', top: level, bottom: 0, figure: String(level), tone: 'end' });
  const pct = (n: number) => `${(n / max) * 100}%`;
  return (
    <figure aria-label={label}>
      <div aria-hidden="true" className="flex gap-2 sm:gap-4">
        {columns.map((c, i) => (
          <div
            key={c.label}
            className={`flex min-w-0 flex-1 flex-col transition-opacity duration-200 motion-reduce:transition-none ${
              // Column 0 is the start, so loss `focus` is column focus + 1.
              focus != null && i !== focus + 1 ? 'opacity-35' : ''
            }`}
          >
            {/* Room above the tallest bar for its figure. */}
            <div className={`relative mt-9 border-b border-zebra-950/5 ${plotClassName ?? 'h-48'}`}>
              {c.tone === 'drop' || c.tone === 'hot' ? (
                <span
                  style={{ '--y': pct(c.bottom) } as CSSProperties}
                  className="absolute -inset-x-1 bottom-[var(--y)] border-t border-dashed border-zebra-300 sm:-inset-x-2"
                />
              ) : null}
              <div
                style={{ '--b': pct(c.bottom), '--h': pct(c.top - c.bottom) } as CSSProperties}
                className="absolute inset-x-[12%] bottom-[var(--b)] h-[var(--h)] min-h-1"
              >
                <span className={`absolute inset-0 rounded-check ${FILL[c.tone]}`} />
                <span className={`absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap type-heading tabular-nums ${FIGURE[c.tone]}`}>
                  {c.figure}
                </span>
              </div>
            </div>
            <div className="pt-3 text-center">
              <span className={`block text-balance type-body [overflow-wrap:anywhere] ${c.tone === 'hot' ? 'text-warning-ink' : c.tone === 'drop' ? 'text-zebra-700' : 'text-zebra-950'}`}>
                <span className="sm:hidden">{c.short}</span>
                <span className="hidden sm:inline">{c.label}</span>
              </span>
              {c.sub ? <span className="hidden type-body text-zebra-400 sm:block">{c.sub}</span> : null}
            </div>
          </div>
        ))}
      </div>
      <ol className="sr-only">
        {columns.map((c) => (
          <li key={c.label}>
            {c.label}: {c.figure}
            {c.sub ? `, ${c.sub}` : ''}
          </li>
        ))}
      </ol>
    </figure>
  );
}
