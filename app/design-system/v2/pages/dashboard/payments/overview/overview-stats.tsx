import { Stat, StatStrip } from '@/components/ui-v2/stat-strip';

import { TODAY } from '../dates';
import { money } from '../payments-data';
import type { Range, summary } from '../reports-data';

import { SWATCH } from './slices';

/**
 * The Overview's four figures for the period, on the v2 `StatStrip`,
 * two over the chart and two over the What's next rail ({@link COLUMNS}):
 * received (with how it compares to the same stretch last year), still
 * to come (and how much of it lands in the next 30 days), overdue and
 * the GST collected (with the BAS that is open). The first three carry
 * the chart's swatches and open the Invoices tab. Overdue's figure stays
 * black: the red dot, the red rows in Needs you and the red in the chart
 * already say it, and a big red number on top shouts. "Received so far"
 * while the period is still running, so the figure is not read as the
 * whole year.
 *
 * @module app/design-system/v2/pages/dashboard/payments/overview/overview-stats
 */

type Summary = ReturnType<typeof summary>;

/**
 * The Overview's two columns (chart, then rail), shared by the figures
 * and the row under them so their edges line up.
 */
export const COLUMNS = 'gap-x-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(30rem,1fr)]';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The Overview's figures. */
export function OverviewStats({ s, range, onOpen }: { s: Summary; range: Range; onOpen: () => void }) {
  const running = range.from <= TODAY && TODAY <= range.to;
  return (
    <StatStrip bare columns={COLUMNS}>
      <Stat label={running ? 'Received so far' : 'Received'} swatch={SWATCH.received} value={money(s.received)} onClick={onOpen}>
        {s.growth === null ? (
          plural(s.receivedCount, 'payment')
        ) : (
          <span className={s.growth >= 0 ? 'text-grass-800' : ''}>
            {s.growth >= 0 ? 'Up' : 'Down'} {Math.abs(s.growth)}% on last year
          </span>
        )}
      </Stat>
      <Stat label="To come" swatch={SWATCH.toCome} value={money(s.toCome)} onClick={onOpen}>
        {s.next30 !== null && s.toCome > 0 ? `${money(s.next30)} in the next 30 days` : plural(s.toComeCount, 'invoice')}
      </Stat>
      <Stat label="Overdue" swatch={SWATCH.overdue} value={money(s.overdue)} onClick={onOpen}>
        {s.overdueCount ? `${plural(s.overdueCount, 'invoice')} · oldest ${s.oldest} days` : 'Nothing overdue'}
      </Stat>
      <Stat label="GST collected" value={money(Math.round(s.gst))}>
        {s.bas ?? `On ${money(s.received)} received`}
      </Stat>
    </StatStrip>
  );
}
