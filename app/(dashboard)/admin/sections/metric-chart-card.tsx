'use client';

import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';

import type { MetricSeries } from '@/lib/admin/admin-analytics';

interface MetricChartCardProps {
  label: string;
  series: MetricSeries;
  /** Format the headline number (e.g. `$1,234` or `5.2%`). */
  format: (value: number) => string;
  /** Optional detail line below the value. */
  detail?: string;
  /** When true, a rising percentChange paints `danger` instead of
   *  `success`. Use for churn — a churn increase is bad news. */
  invertSentiment?: boolean;
  /** When true, the headline value renders in the danger tone
   *  regardless of trend (e.g. churn ≥5%). */
  headlineDanger?: boolean;
}

const tooltipStyle = {
  borderRadius: '12px',
  border: '1px solid #E5E7EB',
  fontSize: '14px',
  color: '#111827',
  padding: '6px 10px',
};

/**
 * One hero metric — value + diff badge + 12-week area sparkline.
 * Matches the `/dashboard` visual language (mint-green
 * `#A7F3D0` area chart, emerald/danger diff badges, bordered
 * `bg-surface rounded-control` card).
 */
export function MetricChartCard({
  label,
  series,
  format,
  detail,
  invertSentiment = false,
  headlineDanger = false,
}: MetricChartCardProps) {
  const { current, percentChange, points } = series;
  const isPositive = percentChange > 0;
  const isNeutral = percentChange === 0;
  // "good" = green badge; "bad" = red. For churn, rising % is bad.
  const isGood = isNeutral
    ? false
    : invertSentiment
      ? !isPositive
      : isPositive;

  return (
    <div className="bg-surface rounded-control border border-border p-4 sm:p-5 flex flex-col gap-3 h-[180px]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {label}
          </p>
          <p
            className={`mt-1 text-2xl font-semibold ${
              headlineDanger ? 'text-danger' : 'text-text'
            }`}
          >
            {format(current)}
          </p>
        </div>
        {!isNeutral && (
          <span
            className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded-control ${
              isGood ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
            }`}
          >
            {isPositive ? '+' : ''}
            {percentChange}%
          </span>
        )}
      </div>

      <div className="flex-1 min-h-0 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient
                id={`gradient-${label.replace(/\s+/g, '-').toLowerCase()}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor="#A7F3D0" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#A7F3D0" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Tooltip
              formatter={(v) => [format(Number(v)), label]}
              labelFormatter={(_, payload) => {
                const point = payload?.[0]?.payload as { label?: string } | undefined;
                return point?.label ?? '';
              }}
              contentStyle={tooltipStyle}
              itemStyle={{ color: '#111827' }}
              cursor={{ stroke: '#E5E7EB', strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#A7F3D0"
              strokeWidth={2}
              fill={`url(#gradient-${label.replace(/\s+/g, '-').toLowerCase()})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {detail && (
        <p className="text-xs text-text-muted truncate -mt-1">{detail}</p>
      )}
    </div>
  );
}
