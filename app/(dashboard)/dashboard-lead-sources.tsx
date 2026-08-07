"use client";

import { Card } from '@/components/ui/card';
import { LEAD_SOURCES, LEAD_SOURCE_LABELS } from '@/types/couple';

import { useLeadSources, DashboardPeriod } from "./use-dashboard";

interface DashboardLeadSourcesProps {
  period: DashboardPeriod;
}

export function DashboardLeadSources({ period }: DashboardLeadSourcesProps) {
  const { data, isLoading } = useLeadSources(period);

  const allSources = [...LEAD_SOURCES, "unknown" as const];
  const allLabels: Record<string, string> = {
    ...LEAD_SOURCE_LABELS,
    unknown: "Unknown",
  };

  return (
    <Card className="flex flex-col max-h-80">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base sm:text-section font-semibold text-text">Lead Sources</h2>
        {data && (
          <span className="text-body text-text-muted">{data.total} total</span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4 flex-1 min-h-0">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse flex items-center gap-3">
              <div className="h-3.5 bg-surface-emphasis rounded-control w-28 shrink-0" />
              <div className="flex-1 h-2 bg-surface-emphasis rounded-pill" />
              <div className="h-3.5 bg-surface-emphasis rounded-control w-6 shrink-0" />
              <div className="h-3 bg-surface-emphasis rounded-control w-8 shrink-0" />
            </div>
          ))}
        </div>
      ) : !data || data.total === 0 ? (
        <div className="text-center py-12">
          <p className="text-text-muted text-body">No lead source data yet.</p>
        </div>
      ) : (
        <div className="space-y-4 flex-1 min-h-0 scrollbar-thin pr-1">
          {allSources
            .filter((source) => (data.counts[source] || 0) > 0)
            .sort((a, b) => (data.counts[b] || 0) - (data.counts[a] || 0))
            .map((source) => {
              const count = data.counts[source] || 0;
              const prevCount = data.prevCounts[source] || 0;
              const pct =
                data.total > 0 ? Math.round((count / data.total) * 100) : 0;
              const diff = count - prevCount;

              return (
                <div key={source} className="flex items-center gap-3">
                  <span className="text-body sm:text-body text-gray-700 w-28 shrink-0">
                    {allLabels[source]}
                  </span>
                  <div className="flex-1 h-2 bg-surface-emphasis rounded-pill overflow-hidden">
                    <div
                      className="h-full rounded-pill transition-all bg-gray-900"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-body sm:text-body font-medium text-text w-6 text-right shrink-0">
                    {count}
                  </span>
                  <span className="text-body text-text-subtle w-10 text-right shrink-0">
                    {pct}%
                  </span>
                </div>
              );
            })}
        </div>
      )}
    </Card>
  );
}
