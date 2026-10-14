'use client';

/**
 * Deliverability: sends per day by channel, plus bounce and opt-out rates.
 *
 * Bars take their colour from a Tailwind class rather than an SVG fill
 * prop, so they follow the theme tokens and dark mode like everything else.
 *
 * @module features/outreach/views/analytics/deliverability-card
 */
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Card } from '@/components/ui/card';
import type { AnalyticsData } from '@/lib/outreach/services/queries';

import { formatDay, formatPct } from './format';

/** Above this share of bounced emails, the number is shown as a warning. */
const BOUNCE_WARN = 0.03;

type DailyRow = AnalyticsData['daily'][number];

interface DeliverabilityCardProps {
  daily: DailyRow[];
  bounceRate: number | null;
  optOutRate: number | null;
}

/** Last 14 days of sends, plus the two rates that signal list health. */
export function DeliverabilityCard({ daily, bounceRate, optOutRate }: DeliverabilityCardProps) {
  const recent = daily.slice(-14);
  const bounceWarn = bounceRate !== null && bounceRate > BOUNCE_WARN;
  return (
    <Card padding="md" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="text-body font-medium text-text">Deliverability</p>
        <div className="flex flex-wrap gap-6">
          <Stat label="Bounce rate" value={formatPct(bounceRate)} tone={bounceWarn ? 'warning' : 'default'} />
          <Stat label="Opt-out rate" value={formatPct(optOutRate)} />
        </div>
      </div>
      {bounceWarn && (
        <p className="text-body text-warning">Bounces are above 3%. Check the email list before sending more.</p>
      )}
      {recent.length === 0 ? (
        <p className="text-body text-text-muted">No sends in the last 14 days.</p>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-4 text-body text-text-muted">
            <Legend swatch="bg-info" label="Email" />
            <Legend swatch="bg-text-subtle" label="Instagram" />
          </div>
          {/* Why: the chart is decorative for screen readers; the summary and the sr-only table carry the same numbers. */}
          <div role="img" aria-label={chartSummary(recent)} className="h-48 text-text-muted">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={recent} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <XAxis dataKey="day" tickFormatter={formatDay} tick={{ fill: 'currentColor', fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} width={28} tick={{ fill: 'currentColor', fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip cursor={false} content={<DailyTooltip />} />
                <Bar dataKey="email" stackId="sends" shape={(p) => <BarRect {...p} className="fill-info" />} />
                <Bar dataKey="instagram" stackId="sends" shape={(p) => <BarRect {...p} className="fill-text-subtle" />} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="sr-only">
            <caption>Sends per day, last {recent.length} days</caption>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Email</th>
                <th scope="col">Instagram</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((row) => (
                <tr key={row.day}>
                  <td>{formatDay(row.day)}</td>
                  <td>{row.email}</td>
                  <td>{row.instagram}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'warning' }) {
  return (
    <div className="space-y-0.5">
      <p className="text-body text-text-muted">{label}</p>
      <p className={`text-section font-semibold tabular-nums ${tone === 'warning' ? 'text-warning' : 'text-text'}`}>{value}</p>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className={`size-2 rounded-pill ${swatch}`} />
      {label}
    </span>
  );
}

/** One-sentence text alternative for the chart, read out instead of the bars. */
function chartSummary(rows: DailyRow[]): string {
  const email = rows.reduce((sum, r) => sum + r.email, 0);
  const instagram = rows.reduce((sum, r) => sum + r.instagram, 0);
  return `Sends for the last ${rows.length} days: ${email} email and ${instagram} Instagram in total.`;
}

/** A rounded bar. Recharts passes the geometry; the class sets the colour. */
function BarRect({ x, y, width, height, className }: { x?: number; y?: number; width?: number; height?: number; className: string }) {
  if (!width || !height || height <= 0) return null;
  return <rect x={x} y={y} width={width} height={height} rx={2} className={className} />;
}

/** Tooltip body in card style. Recharts calls it with the hovered day's values. */
function DailyTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey?: string | number; value?: number | string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-control border border-border bg-card p-2 shadow-sm text-body text-text space-y-1">
      <p className="font-medium">{formatDay(String(label ?? ''))}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="text-text-muted tabular-nums">
          {p.dataKey === 'email' ? 'Email' : 'Instagram'}: {p.value}
        </p>
      ))}
    </div>
  );
}
