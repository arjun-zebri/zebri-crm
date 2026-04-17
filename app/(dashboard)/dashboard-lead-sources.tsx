"use client";

import { Loader2 } from "lucide-react";
import { useLeadSources } from "./use-dashboard";
import { LEAD_SOURCES, LEAD_SOURCE_LABELS } from "./couples/couples-types";

export function DashboardLeadSources() {
  const { data, isLoading } = useLeadSources();

  const allSources = [...LEAD_SOURCES, "unknown" as const];
  const allLabels: Record<string, string> = {
    ...LEAD_SOURCE_LABELS,
    unknown: "Unknown",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col max-h-80">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base sm:text-xl font-semibold text-gray-900">Lead Sources</h2>
        {data && (
          <span className="text-sm text-gray-500">{data.total} total</span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2
            className="w-5 h-5 text-gray-400 animate-spin"
            strokeWidth={1.5}
          />
        </div>
      ) : !data || data.total === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">No lead source data yet.</p>
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
                  <span className="text-xs sm:text-sm text-gray-700 w-28 shrink-0">
                    {allLabels[source]}
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
    </div>
  );
}
