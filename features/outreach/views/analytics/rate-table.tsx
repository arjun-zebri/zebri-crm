'use client';

/**
 * One comparison table: a group per row, one column per outcome.
 *
 * Groups under MIN_SAMPLE show plain counts ("2 of 9") instead of a rate.
 * With a handful of sends a percentage and its 95% range ("0% (0% to 79%)")
 * say nothing and bury the numbers that do, so the rate only appears once
 * a group is big enough for it to mean something. A single note above the
 * table says so, rather than repeating it on every row.
 *
 * @module features/outreach/views/analytics/rate-table
 */
import type { BreakdownRow } from '@/lib/outreach/analytics/compute';
import { MIN_SAMPLE, type RateWithInterval } from '@/lib/outreach/analytics/wilson';

import { formatPct } from './format';

/**
 * Column headers in plain words. "Sample size" is the count the rates are
 * worked out from; the explainer above the tables says what it counts.
 */
const COLUMNS = ['Sample size', 'Replied', 'Positive reply', 'Demo booked', 'Paying', 'Opted out'] as const;

/** The outcome columns, in header order after "Sample size". */
const OUTCOMES = ['reply', 'positive', 'booked', 'paying', 'optOut'] as const;

interface RateTableProps {
  /** Accessible name for the table, e.g. "Sequences". */
  title: string;
  rows: BreakdownRow[];
}

/** A table of groups. Empty groups show a single line rather than an empty table. */
export function RateTable({ title, rows }: RateTableProps) {
  if (rows.length === 0) return <p className="text-body text-text-muted">Nothing to compare yet.</p>;
  const anyThin = rows.some((r) => r.metrics.n < MIN_SAMPLE);

  return (
    <div className="space-y-2">
      {anyThin && (
        <p className="text-body text-text-muted">
          Under {MIN_SAMPLE} sends, a group shows counts, not rates.
        </p>
      )}
      <div className="overflow-x-auto rounded-control border border-border bg-card">
        <table aria-label={title} className="w-full min-w-160 text-left text-body">
          <thead className="border-b border-border bg-surface-muted">
            <tr className="text-text-muted">
              <th scope="col" className="px-4 py-2.5 font-medium">Group</th>
              {COLUMNS.map((c) => (
                <th key={c} scope="col" className="px-4 py-2.5 text-right font-medium whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const thin = row.metrics.n < MIN_SAMPLE;
              return (
                <tr key={row.key} className="text-text">
                  <td className="px-4 py-3 align-top font-medium">{row.label}</td>
                  <td className="px-4 py-3 text-right align-top tabular-nums">{row.metrics.n}</td>
                  {OUTCOMES.map((o) => (
                    <td key={o} className="px-4 py-3 text-right align-top">
                      <RateCell rate={row.metrics[o]} thin={thin} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * A small group reads "2 of 9". A big enough one reads "12%" with its 95%
 * range ("6% to 21%") on a muted line under it.
 */
function RateCell({ rate, thin }: { rate: RateWithInterval; thin: boolean }) {
  if (rate.rate === null) return <span className="text-text-subtle">–</span>;
  if (thin) {
    return (
      <span className="whitespace-nowrap tabular-nums text-text-muted">
        {rate.successes} of {rate.n}
      </span>
    );
  }
  return (
    <span className="block whitespace-nowrap tabular-nums">
      <span className="block">{formatPct(rate.rate)}</span>
      <span className="block text-text-muted">
        {formatPct(rate.low)} to {formatPct(rate.high)}
      </span>
    </span>
  );
}
