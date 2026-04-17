'use client'

import { useState, useRef, useEffect } from 'react'
import { Loader2, ChevronDown } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useRevenueChart, useLeadsChart, ChartPeriod } from './use-dashboard'

const PERIODS: { value: ChartPeriod; label: string; shortLabel: string }[] = [
  { value: '1m', label: '1 month',  shortLabel: '1m' },
  { value: '3m', label: '3 months', shortLabel: '3m' },
  { value: '6m', label: '6 months', shortLabel: '6m' },
  { value: '1Y', label: '1 year',   shortLabel: '1y' },
]

type ChartMode = 'revenue' | 'leads'

const formatAUD = (value: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value)

export function DashboardRevenueChart() {
  const [period, setPeriod] = useState<ChartPeriod>('6m')
  const [mode, setMode] = useState<ChartMode>('revenue')
  const [modeOpen, setModeOpen] = useState(false)
  const [periodOpen, setPeriodOpen] = useState(false)
  const modeRef = useRef<HTMLDivElement>(null)
  const periodRef = useRef<HTMLDivElement>(null)

  const { data: revenueData, isLoading: revenueLoading } = useRevenueChart(period)
  const { data: leadsData, isLoading: leadsLoading } = useLeadsChart(period)

  const data = mode === 'revenue' ? revenueData : leadsData
  const isLoading = mode === 'revenue' ? revenueLoading : leadsLoading

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (modeRef.current && !modeRef.current.contains(e.target as Node)) {
        setModeOpen(false)
      }
      if (periodRef.current && !periodRef.current.contains(e.target as Node)) {
        setPeriodOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const dataKey = mode === 'revenue' ? 'revenue' : 'leads'
  const label = mode === 'revenue' ? 'Revenue' : 'Leads'
  const currentPeriod = PERIODS.find(p => p.value === period)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 h-[260px] sm:h-[340px] lg:h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        {/* Mode dropdown */}
        <div className="relative" ref={modeRef}>
          <button
            onClick={() => { setModeOpen(!modeOpen); setPeriodOpen(false) }}
            className="flex items-center gap-1 text-base sm:text-xl font-semibold text-gray-900 cursor-pointer hover:text-gray-700 transition"
          >
            {label}
            <ChevronDown className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
          </button>
          {modeOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[120px]">
              <button
                onClick={() => { setMode('revenue'); setModeOpen(false) }}
                className={`block w-full text-left px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 transition rounded-t-lg ${mode === 'revenue' ? 'font-medium text-gray-900' : 'text-gray-600'}`}
              >
                Revenue
              </button>
              <button
                onClick={() => { setMode('leads'); setModeOpen(false) }}
                className={`block w-full text-left px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 transition rounded-b-lg ${mode === 'leads' ? 'font-medium text-gray-900' : 'text-gray-600'}`}
              >
                Leads
              </button>
            </div>
          )}
        </div>

        {/* Period dropdown */}
        <div className="relative" ref={periodRef}>
          <button
            onClick={() => { setPeriodOpen(!periodOpen); setModeOpen(false) }}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
          >
            <span className="sm:hidden">{currentPeriod?.shortLabel ?? period}</span>
            <span className="hidden sm:inline">{currentPeriod?.label ?? period}</span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.5} />
          </button>
          {periodOpen && (
            <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[120px]">
              {PERIODS.map((p, i) => (
                <button
                  key={p.value}
                  onClick={() => { setPeriod(p.value); setPeriodOpen(false) }}
                  className={`block w-full text-left px-3 py-2 text-xs sm:text-sm cursor-pointer hover:bg-gray-50 transition ${
                    i === 0 ? 'rounded-t-lg' : i === PERIODS.length - 1 ? 'rounded-b-lg' : ''
                  } ${period === p.value ? 'font-medium text-gray-900' : 'text-gray-600'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" strokeWidth={1.5} />
        </div>
      ) : !data || data.chartData.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 text-sm">No {label.toLowerCase()} data yet.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-2 mb-4">
            <span className="text-2xl sm:text-3xl font-semibold text-gray-900">
              {mode === 'revenue' ? formatAUD(data.total) : data.total}
            </span>
            {data.percentChange !== 0 && (
              <span
                className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded-md ${
                  data.percentChange > 0
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-red-50 text-red-600'
                }`}
              >
                {data.percentChange > 0 ? '+' : ''}{data.percentChange}%
              </span>
            )}
            <span className="text-xs text-gray-500 whitespace-nowrap">vs previous period</span>
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
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#9CA3AF', dy: 8 }}
                  interval={1}
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
    </div>
  )
}
