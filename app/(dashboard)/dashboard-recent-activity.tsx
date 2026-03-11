'use client'

import { Couple } from './couples/couples-types'
import { Loader2 } from 'lucide-react'

interface RecentActivityItem {
  id: string
  name: string
  type: 'couple' | 'vendor'
  addedDate: string
}

interface DashboardRecentActivityProps {
  couples: Couple[]
  isLoading: boolean
  onCoupleClick: (couple: Couple) => void
}

export function DashboardRecentActivity({
  couples,
  isLoading,
  onCoupleClick,
}: DashboardRecentActivityProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Recent Activity</h2>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      </div>
    )
  }

  const recentCouples = couples.slice(0, 5)

  if (recentCouples.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Recent Activity</h2>
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">No recent activity yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
      <div className="space-y-2">
        {recentCouples.map((couple) => (
          <div
            key={couple.id}
            onClick={() => onCoupleClick(couple)}
            className="p-3 rounded-lg hover:bg-gray-50 transition cursor-pointer border border-gray-100"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{couple.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Added {getRelativeDate(couple.created_at)}
                </p>
              </div>
              <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded font-medium ml-2">
                Couple
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function getRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return `${Math.floor(diffDays / 30)} months ago`
}
