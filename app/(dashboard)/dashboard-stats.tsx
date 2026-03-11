'use client'

import { Loader2, TrendingUp, TrendingDown } from 'lucide-react'

interface DashboardStatsProps {
  totalCouples: number
  couplesChange: number
  couplesPercent: number
  activeVendors: number
  weddingsThisMonth: number
  weddingsChange: number
  weddingsPercent: number
  isLoading: boolean
}

export function DashboardStats({
  totalCouples,
  couplesChange,
  couplesPercent,
  activeVendors,
  weddingsThisMonth,
  weddingsChange,
  weddingsPercent,
  isLoading,
}: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Total Couples */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="text-xs font-medium text-gray-500 mb-3">Total Couples</div>
        {isLoading ? (
          <div className="flex items-center justify-center h-16">
            <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
          </div>
        ) : (
          <>
            <div className="text-3xl font-semibold text-gray-900 mb-2">{totalCouples}</div>
            <div className="flex items-center gap-1">
              {couplesChange >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
              <span
                className={`text-xs font-medium ${
                  couplesChange >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {couplesChange >= 0 ? '+' : ''}{couplesChange} ({couplesPercent >= 0 ? '+' : ''}{couplesPercent}%)
              </span>
              <span className="text-xs text-gray-500">vs last month</span>
            </div>
          </>
        )}
      </div>

      {/* Active Vendors */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="text-xs font-medium text-gray-500 mb-3">Active Vendors</div>
        {isLoading ? (
          <div className="flex items-center justify-center h-16">
            <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
          </div>
        ) : (
          <div className="text-3xl font-semibold text-gray-900">{activeVendors}</div>
        )}
      </div>

      {/* Weddings This Month */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="text-xs font-medium text-gray-500 mb-3">Weddings This Month</div>
        {isLoading ? (
          <div className="flex items-center justify-center h-16">
            <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
          </div>
        ) : (
          <>
            <div className="text-3xl font-semibold text-gray-900 mb-2">{weddingsThisMonth}</div>
            <div className="flex items-center gap-1">
              {weddingsChange >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
              <span
                className={`text-xs font-medium ${
                  weddingsChange >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {weddingsChange >= 0 ? '+' : ''}{weddingsChange} ({weddingsPercent >= 0 ? '+' : ''}{weddingsPercent}%)
              </span>
              <span className="text-xs text-gray-500">vs last month</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
