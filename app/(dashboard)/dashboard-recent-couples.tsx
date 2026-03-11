'use client'

import { Couple } from './couples/couples-types'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'

interface DashboardRecentCouplesProps {
  couples: Couple[]
  isLoading: boolean
  onCoupleClick: (couple: Couple) => void
}

export function DashboardRecentCouples({
  couples,
  isLoading,
  onCoupleClick,
}: DashboardRecentCouplesProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Recent Couples</h2>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      </div>
    )
  }

  if (couples.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Recent Couples</h2>
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">No couples yet.</p>
          <p className="text-gray-400 text-xs mt-1">Ready to onboard your first enquiry?</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <h2 className="text-xl font-semibold text-gray-900 p-6 pb-3">Recent Couples</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-6 py-3 text-left font-medium text-gray-900">Name</th>
            <th className="px-6 py-3 text-left font-medium text-gray-900">Email</th>
            <th className="px-6 py-3 text-left font-medium text-gray-900">Status</th>
            <th className="px-6 py-3 text-left font-medium text-gray-900">Added</th>
          </tr>
        </thead>
        <tbody>
          {couples.map((couple) => (
            <tr
              key={couple.id}
              onClick={() => onCoupleClick(couple)}
              className="border-b border-gray-100 last:border-0 cursor-pointer transition hover:bg-gray-50"
            >
              <td className="px-6 py-3.5 text-gray-900">{couple.name}</td>
              <td className="px-6 py-3.5 text-gray-500 truncate">{couple.email || '–'}</td>
              <td className="px-6 py-3.5">
                <Badge variant={couple.status}>{couple.status}</Badge>
              </td>
              <td className="px-6 py-3.5 text-gray-500 text-xs whitespace-nowrap">
                {getRelativeDate(couple.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function getRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return `${Math.floor(diffDays / 30)} months ago`
}
