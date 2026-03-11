'use client'

import { Plus, Users, Store } from 'lucide-react'
import Link from 'next/link'

interface DashboardQuickActionsProps {
  onAddCouple?: () => void
  onAddVendor?: () => void
}

export function DashboardQuickActions({
  onAddCouple,
  onAddVendor,
}: DashboardQuickActionsProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onAddCouple}
          className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition text-left"
        >
          <div className="p-2 bg-white rounded-lg border border-gray-200">
            <Plus className="w-4 h-4 text-gray-600" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">Add Couple</div>
            <div className="text-xs text-gray-500">New enquiry</div>
          </div>
        </button>

        <button
          onClick={onAddVendor}
          className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition text-left"
        >
          <div className="p-2 bg-white rounded-lg border border-gray-200">
            <Plus className="w-4 h-4 text-gray-600" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">Add Vendor</div>
            <div className="text-xs text-gray-500">Expand network</div>
          </div>
        </button>

        <Link
          href="/couples"
          className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
        >
          <div className="p-2 bg-white rounded-lg border border-gray-200">
            <Users className="w-4 h-4 text-gray-600" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">View Couples</div>
            <div className="text-xs text-gray-500">All enquiries</div>
          </div>
        </Link>

        <Link
          href="/vendors"
          className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
        >
          <div className="p-2 bg-white rounded-lg border border-gray-200">
            <Store className="w-4 h-4 text-gray-600" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">View Vendors</div>
            <div className="text-xs text-gray-500">Your network</div>
          </div>
        </Link>
      </div>
    </div>
  )
}
