"use client";

import type { GlobalStats } from "@/lib/admin-analytics";

export function StatsTab({ stats }: { stats: GlobalStats }) {
  const { health, planDistribution, funnel, activity } = stats;

  return (
    <div className="space-y-8 max-w-5xl">
      <Section title="Subscription health">
        <CardGrid>
          <Card label="Total users" value={health.total} />
          <Card label="Active" value={health.active} />
          <Card label="Trialing" value={health.trialing} />
          <Card label="Past due" value={health.past_due} accent="red" />
          <Card label="Cancelled" value={health.cancelled} />
          <Card label="MRR" value={`$${health.mrr.toLocaleString()}`} />
        </CardGrid>
      </Section>

      <Section title="Plan distribution">
        <CardGrid>
          <Card label="Starter" value={planDistribution.starter} />
          <Card label="Pro" value={planDistribution.pro} />
          <Card label="Max" value={planDistribution.max} />
        </CardGrid>
      </Section>

      <Section title="Signup funnel">
        <CardGrid>
          <Card label="This week" value={funnel.signupsThisWeek} />
          <Card label="This month" value={funnel.signupsThisMonth} />
          <Card label="All time" value={funnel.allTime} />
          <Card
            label="Trial → Paid"
            value={`${(funnel.trialToPaidRate * 100).toFixed(1)}%`}
          />
        </CardGrid>
      </Section>

      <Section title="Activity volume">
        <CardGrid>
          <Card label="Couples" value={activity.couples} />
          <Card label="Events" value={activity.events} />
          <Card label="Invoices" value={activity.invoices} />
          <Card label="Contracts" value={activity.contracts} />
        </CardGrid>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-sm font-medium text-gray-500 mb-3">{title}</h2>
      {children}
    </div>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {children}
    </div>
  );
}

function Card({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: "red";
}) {
  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div
        className={`text-2xl font-semibold ${
          accent === "red" && value !== 0 ? "text-red-600" : "text-gray-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
