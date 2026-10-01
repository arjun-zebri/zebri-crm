import { Children, createContext, use, type ReactNode } from 'react';

import { Panel } from '@/components/ui-v2/panel';

/**
 * Design system v2 stat strip (preview): a few headline figures on one
 * glass `Panel`, split by the panel's own 5% hairline rather than boxed
 * as separate cards (a row of cards reads as a dashboard of widgets).
 * Each `Stat` is a label, the figure in `type-heading`, and one line that
 * says what the figure means right now ("$7,450 in the next 30 days").
 * A label can carry a swatch so the strip doubles as a chart's key, and
 * `danger` turns the figure red for money or time that has gone wrong
 * (only while it has: an overdue of $0 stays black). One stat per column
 * from `lg`, two by two below, stacked on phones. `bare` drops the panel
 * so the figures sit straight on the backdrop, each led by a thin rule
 * down its left side, for a page with no panels. With
 * `onClick` a stat is a button that goes to what the figure counts
 * (Overdue opens the overdue invoices), stepping its fill on hover.
 *
 * The figure is `type-heading`, not the page title's size: four figures
 * as big as the heading above them competed with it and with the card
 * below. A bare strip over a two-column page takes `columns`, the page's
 * own grid classes, so the first two stats sit over the left column and
 * the last two over the right, and every edge on the page is shared.
 *
 * @example
 * ```tsx
 * <StatStrip>
 *   <Stat label="Received" swatch="bg-grass-700" value="$10,600">↑ 13% on this time last year</Stat>
 *   <Stat label="Overdue" value="$2,100" danger>2 invoices · oldest 12 days</Stat>
 * </StatStrip>
 * ```
 *
 * @module components/ui-v2/stat-strip
 */

export interface StatProps {
  label: string;
  /** Background utility for a swatch before the label, e.g. a chart series fill. */
  swatch?: string | undefined;
  value: string;
  /** Red figure, for a stat that needs attention. */
  danger?: boolean | undefined;
  /** The one line under the figure. */
  children?: ReactNode;
  /** Makes the stat a button that goes to what it counts. */
  onClick?: (() => void) | undefined;
}

// On a panel the stats split by the panel's hairline. Bare, every stat
// leads with its own 10% rule, the first one included, so the strip has
// an edge on the left too and each rule is where its column starts.
const CELL = {
  panel:
    'border-zebra-950/5 px-5 py-4 max-sm:border-t max-sm:first:border-t-0 sm:even:border-l sm:[&:nth-child(n+3)]:border-t lg:border-l lg:first:border-l-0 lg:[&:nth-child(n+3)]:border-t-0',
  // Padded both sides so a clickable one's hover fill has room; the left
  // corners are square so that fill meets the rule flush.
  bare: 'rounded-r-button border-l border-zebra-950/10 px-4 py-2',
} as const;

const CLICKABLE =
  'cursor-pointer text-left transition-colors duration-150 hover:bg-zebra-950/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500 motion-reduce:transition-none';

/** One figure. See {@link StatProps}. */
export function Stat({ label, swatch, value, danger = false, children, onClick }: StatProps) {
  const cell = `block space-y-1 ${CELL[use(BareContext) ? 'bare' : 'panel']}`;
  // Spans, not paragraphs, so the same markup is valid inside a button.
  const body = (
    <>
      <span className="flex items-center gap-2 type-body text-zebra-500">
        {swatch ? <span aria-hidden="true" className={`size-2.5 rounded-check ${swatch}`} /> : null}
        {label}
      </span>
      <span className={`block type-heading tabular-nums ${danger ? 'text-danger' : 'text-zebra-950'}`}>{value}</span>
      {children ? <span className="block type-body text-zebra-500">{children}</span> : null}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cell} ${CLICKABLE}`}>
      {body}
    </button>
  ) : (
    <div className={cell}>{body}</div>
  );
}

/** Tells each `Stat` whether its strip is bare, so the cells pick their rules. */
const BareContext = createContext(false);

export interface StatStripProps {
  /** No panel: the stats sit on the backdrop, each led by a hairline rule. */
  bare?: boolean | undefined;
  /**
   * Bare only: the grid classes of the two-column layout under the strip
   * (template and column gap, e.g. `lg:grid-cols-[minmax(0,1.2fr)_minmax(30rem,1fr)] gap-x-12`).
   * The stats go two to a column, so they line up with what is below.
   */
  columns?: string | undefined;
  children: ReactNode;
}

/** The strip: up to four `Stat`s. See {@link StatStripProps}. */
export function StatStrip({ bare = false, columns, children }: StatStripProps) {
  if (bare && columns) {
    const stats = Children.toArray(children);
    const pair = 'grid gap-x-6 gap-y-3 sm:grid-cols-2';
    return (
      <BareContext value>
        <div className={`grid gap-y-3 ${columns}`}>
          <div className={pair}>{stats.slice(0, 2)}</div>
          <div className={pair}>{stats.slice(2)}</div>
        </div>
      </BareContext>
    );
  }
  return bare ? (
    <BareContext value>
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </BareContext>
  ) : (
    <Panel className="grid sm:grid-cols-2 lg:grid-cols-4">{children}</Panel>
  );
}
