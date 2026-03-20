'use client'

import { Loader2 } from 'lucide-react'

interface DashboardStatsProps {
  totalLeads: number
  leadsPercentChange: number
  leadsDiff: number
  conversionRate: number
  conversionDiff: number
  totalRevenue: number
  revenuePercentChange: number
  revenueDiff: number
  isLoading: boolean
}

const formatAUD = (value: number) =>
  value === 0
    ? '—'
    : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value)

const formatDiffAUD = (value: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(Math.abs(value))

function StatBadge({ percent }: { percent: number }) {
  if (percent === 0) return null
  const isPositive = percent > 0
  return (
    <span
      className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded-md ${
        isPositive
          ? 'bg-emerald-50 text-emerald-600'
          : 'bg-red-50 text-red-600'
      }`}
    >
      {isPositive ? '+' : ''}{percent}%
    </span>
  )
}

function DiffText({ diff, formatter }: { diff: number; formatter: (v: number) => string }) {
  if (diff === 0) return null
  const isPositive = diff > 0
  return (
    <span className="text-xs text-gray-500">
      {isPositive ? '+' : '-'}{formatter(Math.abs(diff))} vs last week
    </span>
  )
}

export function DashboardStats({
  totalLeads,
  leadsPercentChange,
  leadsDiff,
  conversionRate,
  conversionDiff,
  totalRevenue,
  revenuePercentChange,
  revenueDiff,
  isLoading,
}: DashboardStatsProps) {
  const cards = [
    {
      label: 'Leads',
      value: totalLeads === 0 ? '—' : String(totalLeads),
      percent: leadsPercentChange,
      diff: leadsDiff,
      diffFormatter: (v: number) => String(v),
    },
    {
      label: 'Conversion Rate',
      value: `${conversionRate}%`,
      percent: conversionDiff,
      diff: conversionDiff,
      diffFormatter: (v: number) => `${v}%`,
    },
    {
      label: 'Revenue',
      value: formatAUD(totalRevenue),
      percent: revenuePercentChange,
      diff: revenueDiff,
      diffFormatter: (v: number) => formatDiffAUD(v),
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-xl border border-gray-200 p-6"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {card.label}
            </span>
            {!isLoading && <StatBadge percent={card.percent} />}
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 text-gray-400 animate-spin" strokeWidth={1.5} />
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-gray-900">
                {card.value}
              </span>
              {card.diff !== 0 && (
                <DiffText diff={card.diff} formatter={card.diffFormatter} />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
