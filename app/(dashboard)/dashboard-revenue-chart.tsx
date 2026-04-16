'use client'

import { useState, useRef, useEffect } from 'react'
import { Loader2, ChevronDown } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useRevenueChart, useLeadsChart, ChartPeriod } from './use-dashboard'

const PERIODS: ChartPeriod[] = ['1m', '3m', '6m', '1Y']

type ChartMode = 'revenue' | 'leads'

const formatAUD = (value: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value)

export function DashboardRevenueChart() {
  const [period, setPeriod] = useState<ChartPeriod>('6m')
  const [mode, setMode] = useState<ChartMode>('revenue')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { data: revenueData, isLoading: revenueLoading } = useRevenueChart(period)
  const { data: leadsData, isLoading: leadsLoading } = useLeadsChart(period)

  const data = mode === 'revenue' ? revenueData : leadsData
  const isLoading = mode === 'revenue' ? revenueLoading : leadsLoading

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const dataKey = mode === 'revenue' ? 'revenue' : 'leads'
  const label = mode === 'revenue' ? 'Revenue' : 'Leads'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 h-[300px] lg:h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1 text-xl font-semibold text-gray-900 cursor-pointer hover:text-gray-700 transition"
          >
            {label}
            <ChevronDown className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
          </button>
          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[120px]">
              <button
                onClick={() => { setMode('revenue'); setDropdownOpen(false) }}
                className={`block w-full text-left px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 transition rounded-t-lg ${mode === 'revenue' ? 'font-medium text-gray-900' : 'text-gray-600'}`}
              >
                Revenue
              </button>
              <button
                onClick={() => { setMode('leads'); setDropdownOpen(false) }}
                className={`block w-full text-left px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 transition rounded-b-lg ${mode === 'leads' ? 'font-medium text-gray-900' : 'text-gray-600'}`}
              >
                Leads
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition cursor-pointer ${
                period === p
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p}
            </button>
          ))}
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
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-3xl font-semibold text-gray-900">
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
            <span className="text-xs text-gray-500">vs previous period</span>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.chartData as any[]}>
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
                  tick={{ fontSize: 12, fill: '#9CA3AF' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#9CA3AF' }}
                  tickFormatter={(v) =>
                    mode === 'revenue'
                      ? v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`
                      : String(v)
                  }
                  width={50}
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
                  }}
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
