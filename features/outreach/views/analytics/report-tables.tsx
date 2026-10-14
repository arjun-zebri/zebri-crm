'use client';

/**
 * The comparison table, one breakdown at a time.
 *
 * Why one at a time: ten stacked tables with identical headers made the
 * page a wall of numbers. A "Compare by" picker shows the one question
 * being asked (which sequence, which message, which step, when, then who),
 * in the order the founder usually asks them.
 *
 * @module features/outreach/views/analytics/report-tables
 */
import { useState } from 'react';

import { Select } from '@/components/ui/select';
import type { AnalyticsReport, BreakdownRow } from '@/lib/outreach/analytics/compute';

import { RateTable } from './rate-table';

interface ReportTablesProps {
  report: AnalyticsReport;
}

/** Every breakdown in picker order, keyed by its label. */
function breakdowns(report: AnalyticsReport): { label: string; rows: BreakdownRow[] }[] {
  return [
    { label: 'Sequence', rows: report.arms },
    { label: 'Message version', rows: report.variants },
    { label: 'Step', rows: report.steps },
    { label: 'Send hour', rows: report.hours },
    { label: 'Weekday', rows: report.weekdays },
    ...report.segments.map((seg) => ({ label: seg.dimension, rows: seg.rows })),
  ];
}

/** "Compare by" picker, a one-line explainer, and the chosen table. */
export function ReportTables({ report }: ReportTablesProps) {
  const all = breakdowns(report);
  const [picked, setPicked] = useState(all[0]?.label ?? '');
  const current = all.find((b) => b.label === picked) ?? all[0];
  if (!current) return null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-section font-semibold text-text">Compare</h3>
          <p className="max-w-2xl text-body text-text-muted">
            Under each rate is the range the true rate very likely falls in. When two groups&apos; ranges overlap a lot,
            the difference may be luck.
          </p>
        </div>
        <Select
          label="Compare by"
          options={all.map((b) => ({ value: b.label, label: b.label }))}
          value={current.label}
          onValueChange={(v) => v && setPicked(v)}
          className="w-56"
        />
      </div>
      <RateTable title={current.label} rows={current.rows} />
    </section>
  );
}
