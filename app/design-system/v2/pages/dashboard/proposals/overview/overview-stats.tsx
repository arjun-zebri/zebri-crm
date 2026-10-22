import { Stat, StatStrip } from '@/components/ui-v2/stat-strip';

import { COLUMNS } from '../../payments/overview/overview-stats';
import { money } from '../../payments/payments-data';
import type { summary } from '../insights';

/**
 * The Proposals Overview's four figures, on the v2 `StatStrip` straight
 * on the backdrop (`bare`), as on the Payments Overview, two over the
 * chart and two over the What's next rail ({@link COLUMNS}): the
 * acceptance rate (of the proposals sent in the period that have an
 * answer), the value won (accepted in the period), what is out now
 * waiting on an answer (as of today), and the typical days from sent to
 * accepted. Each carries one line on what the figure is made of, so a
 * percentage is never read without its count. Won value and Out now
 * carry swatches (the chart's booked green, and amber for waiting on
 * the couple) and open the Proposals list, as Payments' figures open
 * Invoices.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/overview/overview-stats
 */

type Summary = ReturnType<typeof summary>;

/** The Overview's two columns: Payments' own, so both Overviews match. */
export { COLUMNS };

/**
 * The figures' swatches, the fills the sent-to-booked chart uses (as
 * Payments' figures share its chart's `SWATCH`): booked green, and amber
 * for waiting on the couple.
 */
export const SWATCH = { won: 'bg-grass-900', out: 'bg-warning' } as const;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The Overview's figures. */
export function OverviewStats({ s, onOpen }: { s: Summary; onOpen: () => void }) {
  return (
    <StatStrip bare columns={COLUMNS}>
      <Stat label="Acceptance rate" value={s.rate === null ? 'None yet' : `${s.rate}%`}>
        {s.answered ? `${s.accepted} of ${s.answered} said yes` : 'No answers in this period'}
      </Stat>
      <Stat label="Won value" swatch={SWATCH.won} value={money(s.won)} onClick={onOpen}>
        {plural(s.wonCount, 'booking')}
      </Stat>
      <Stat label="Out now" swatch={SWATCH.out} value={money(s.out)} onClick={onOpen}>
        {s.outCount
          ? `${plural(s.outCount, 'proposal')} · ${s.outOpened} opened`
          : 'Nothing waiting on an answer'}
      </Stat>
      <Stat
        label="Time to accept"
        value={s.daysToAccept === null ? 'None yet' : plural(s.daysToAccept, 'day')}
      >
        Typical, from sent to accepted
      </Stat>
    </StatStrip>
  );
}
