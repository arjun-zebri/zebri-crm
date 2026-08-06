'use client'

import { ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

import { Card } from '@/components/ui/card'

import { useRevenueChart, useLeadsChart, DashboardPeriod } from './use-dashboard'

type ChartMode = 'revenue' | 'leads'

const formatAUD = (value: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value)

const periodLabels: Record<DashboardPeriod, string> = {
  week: 'Weekly',
  month: 'Monthly',
  quarter: 'Quarterly',
  year: 'Yearly',
}

const previousPeriodLabels: Record<DashboardPeriod, string> = {
  week: 'last week',
  month: 'last month',
  quarter: 'last quarter',
  year: 'last year',
}

interface DashboardRevenueChartProps {
  period: DashboardPeriod;
}

export function DashboardRevenueChart({ period }: DashboardRevenueChartProps) {
  const [mode, setMode] = useState<ChartMode>('revenue')
  const [modeOpen, setModeOpen] = useState(false)
  const modeRef = useRef<HTMLDivElement>(null)

  const { data: revenueData, isLoading: revenueLoading } = useRevenueChart(period)
  const { data: leadsData, isLoading: leadsLoading } = useLeadsChart(period)

  const data = mode === 'revenue' ? revenueData : leadsData
  const isLoading = mode === 'revenue' ? revenueLoading : leadsLoading

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (modeRef.current && !modeRef.current.contains(e.target as Node)) {
        setModeOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const dataKey = mode === 'revenue' ? 'revenue' : 'leads'
  const label = mode === 'revenue' ? 'Revenue' : 'Leads'

  return (
    <Card className="h-[260px] sm:h-[340px] lg:h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        {/* Mode dropdown */}
        <div className="relative" ref={modeRef}>
          <button
            onClick={() => { setModeOpen(!modeOpen) }}
            className="flex items-center gap-1 text-base sm:text-section font-semibold text-text cursor-pointer hover:text-gray-700 transition"
          >
            {label}
            <ChevronDown className="w-4 h-4 text-text-subtle" strokeWidth={1.5} />
          </button>
          {modeOpen && (
            <div className="absolute top-full left-0 mt-1 bg-surface border border-border rounded-control shadow-lg z-10 min-w-[120px]">
              <button
                onClick={() => { setMode('revenue'); setModeOpen(false) }}
                className={`block w-full text-left px-3 py-2 text-body cursor-pointer hover:bg-gray-50 transition rounded-t-control ${mode === 'revenue' ? 'font-medium text-text' : 'text-gray-600'}`}
              >
                Revenue
              </button>
              <button
                onClick={() => { setMode('leads'); setModeOpen(false) }}
                className={`block w-full text-left px-3 py-2 text-body cursor-pointer hover:bg-gray-50 transition rounded-b-control ${mode === 'leads' ? 'font-medium text-text' : 'text-gray-600'}`}
              >
                Leads
              </button>
            </div>
          )}
        </div>

      </div>

      {isLoading ? (
        <div className="animate-pulse flex flex-col flex-1 min-h-0">
          <div className="h-8 w-32 bg-surface-emphasis rounded-control mb-4" />
          <div className="flex-1 min-h-0 bg-surface-emphasis rounded-control" />
        </div>
      ) : !data || data.chartData.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-text-muted text-body">No {label.toLowerCase()} data yet.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-2 mb-4">
            <span className="text-2xl sm:text-display font-semibold text-text">
              {mode === 'revenue' ? formatAUD(data.total) : data.total}
            </span>
            {data.percentChange !== 0 && (
              <span
                className={`inline-flex items-center text-caption font-medium px-1.5 py-0.5 rounded-control ${
                  data.percentChange > 0
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-red-50 text-red-600'
                }`}
              >
                {data.percentChange > 0 ? '+' : ''}{data.percentChange}%
              </span>
            )}
            <span className="text-caption text-text-muted whitespace-nowrap">vs {previousPeriodLabels[period]}</span>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.chartData as any[]} margin={{ bottom: 20 }}>
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#A7F3D0" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#A7F3D0" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#9CA3AF', dy: 8 }}
                  interval={data.chartData.length > 8 ? 1 : 0}
                  padding={{ right: 16 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  tickFormatter={(v) =>
                    mode === 'revenue'
                      ? v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`
                      : String(v)
                  }
                  tickCount={4}
                  width={40}
                />
                <Tooltip
                  formatter={(value) => [
                    mode === 'revenue' ? formatAUD(Number(value)) : Number(value),
                    label,
                  ]}
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #E5E7EB',
                    fontSize: '14px',
                    color: '#111827',
                  }}
                  itemStyle={{ color: '#111827' }}
                />
                <Area
                  type="monotone"
                  dataKey={dataKey}
                  stroke="#A7F3D0"
                  strokeWidth={2}
                  fill="url(#chartGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Card>
  )
}
