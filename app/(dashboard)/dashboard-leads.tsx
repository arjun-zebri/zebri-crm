"use client";

import { Card } from "@/components/ui/card";

import { useLeadsManagement, DashboardPeriod } from "./use-dashboard";

interface DashboardLeadsProps {
  period: DashboardPeriod;
}

export function DashboardLeads({ period }: DashboardLeadsProps) {
  const { data, isLoading } = useLeadsManagement(period);

  return (
    <Card className="flex flex-col max-h-80">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base sm:text-xl font-semibold text-gray-900">Leads</h2>
        {data && (
          <span className="text-sm text-gray-500">{data.total} total</span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4 flex-1 min-h-0">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse flex items-center gap-3">
              <div className="h-3.5 bg-gray-100 rounded-md w-24 shrink-0" />
              <div className="flex-1 h-2 bg-gray-100 rounded-full" />
              <div className="h-3.5 bg-gray-100 rounded-md w-6 shrink-0" />
              <div className="h-3 bg-gray-100 rounded-md w-8 shrink-0" />
            </div>
          ))}
        </div>
      ) : !data || data.total === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">No leads yet.</p>
        </div>
      ) : (
        <div className="space-y-4 flex-1 min-h-0 scrollbar-thin pr-1">
          {data.statuses.map((status) => {
            const count = data.counts[status.slug];
            const prevCount = data.prevCounts[status.slug];
            const pct =
              data.total > 0 ? Math.round((count / data.total) * 100) : 0;
            const diff = count - prevCount;

            return (
              <div key={status.slug} className="flex items-center gap-3">
                <span className="text-xs sm:text-sm text-gray-700 w-24 shrink-0">
                  {status.name}
                </span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all bg-gray-900"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs sm:text-sm font-medium text-gray-900 w-6 text-right shrink-0">
                  {count}
                </span>
                <span className="text-xs text-gray-400 w-10 text-right shrink-0">
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
