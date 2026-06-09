'use client';

import type { AdminDashboard } from '@/lib/admin/admin-analytics';

import { MetricChartCard } from './metric-chart-card';

const formatAUD = (value: number) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value);

/**
 * Row 1 of the admin dashboard — 4 hero metric cards, each with a
 * 12-week area sparkline. MRR, active subscribers, churn rate, and
 * new signups. Churn uses inverted sentiment (rising = bad).
 */
export function MetricCards({ dashboard }: { dashboard: AdminDashboard }) {
  const churnRatePct =
    dashboard.churn.activeNow + dashboard.churn.cancelledLast30d > 0
      ? dashboard.churn.monthlyRate * 100
      : 0;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricChartCard
        label="MRR"
        series={dashboard.series.mrr}
        format={formatAUD}
        detail={`${formatAUD(dashboard.mrr.pro)} Pro · ${formatAUD(dashboard.mrr.max)} Max`}
      />
      <MetricChartCard
        label="Active subs"
        series={dashboard.series.activeSubs}
        format={(n) => String(Math.round(n))}
        detail={formatActiveDetail(dashboard)}
      />
      <MetricChartCard
        label="Churn (last 30d)"
        series={dashboard.series.churnRate}
        format={(n) => `${Math.round(n)} lost`}
        detail={formatChurnDetail(dashboard, churnRatePct)}
        invertSentiment
        headlineDanger={churnRatePct >= 5}
      />
      <MetricChartCard
        label="New signups"
        series={dashboard.series.signups}
        format={(n) => String(Math.round(n))}
        detail={`${dashboard.engagement.newThisWeek} this week`}
      />
    </div>
  );
}

function formatActiveDetail(dashboard: AdminDashboard): string {
  const parts: string[] = [];
  if (dashboard.subscribers.paying > 0) parts.push(`${dashboard.subscribers.paying} paying`);
  if (dashboard.subscribers.comped > 0) parts.push(`${dashboard.subscribers.comped} comped`);
  if (dashboard.subscribers.pastDue > 0) parts.push(`${dashboard.subscribers.pastDue} past-due`);
  if (parts.length === 0) parts.push(`${dashboard.subscribers.total} total users`);
  return parts.join(' · ');
}

function formatChurnDetail(dashboard: AdminDashboard, churnRatePct: number): string {
  const ratePart = `${churnRatePct.toFixed(1)}% rate`;
  if (dashboard.churn.pendingCancellations > 0) {
    return `${ratePart} · ${dashboard.churn.pendingCancellations} pending`;
  }
  return ratePart;
}
