'use client'

import { Loader2 } from 'lucide-react'
import { useLeadsManagement } from './use-dashboard'

export function DashboardLeads() {
  const { data, isLoading } = useLeadsManagement()

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col max-h-80">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Leads</h2>
        {data && (
          <span className="text-sm text-gray-500">{data.total} total</span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" strokeWidth={1.5} />
        </div>
      ) : !data || data.total === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">No leads yet.</p>
        </div>
      ) : (
        <div className="space-y-4 flex-1 min-h-0 scrollbar-thin pr-1">
          {data.statuses.map((status) => {
            const count = data.counts[status.slug]
            const prevCount = data.prevCounts[status.slug]
            const pct = data.total > 0 ? Math.round((count / data.total) * 100) : 0
            const diff = count - prevCount

            return (
              <div key={status.slug} className="flex items-center gap-3">
                <span className="text-sm text-gray-700 w-24 shrink-0">
                  {status.name}
                </span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all bg-gray-900"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-900 w-6 text-right shrink-0">
                  {count}
                </span>
                <span className="text-xs text-gray-400 w-10 text-right shrink-0">
                  {pct}%
                </span>
                {diff !== 0 && (
                  <span className={`text-xs w-8 text-right shrink-0 ${
                    diff > 0 ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {diff > 0 ? `+${diff}` : String(diff)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
