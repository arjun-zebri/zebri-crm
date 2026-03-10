'use client'

import { useState } from 'react'
import { X, Phone, Mail, Pencil } from 'lucide-react'
import { Vendor, CATEGORY_LABELS, STATUS_LABELS } from './vendors-types'
import { Badge } from '@/components/ui/badge'
import { VendorOverview } from './vendor-overview'
import { VendorEvents } from './vendor-events'
import { VendorTasks } from './vendor-tasks'

interface VendorProfileProps {
  vendor: Vendor | null
  onClose: () => void
  onEdit: (vendor: Vendor) => void
}

export function VendorProfile({ vendor, onClose, onEdit }: VendorProfileProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'tasks'>('overview')

  if (!vendor) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-[640px] bg-white shadow-2xl z-50 flex flex-col transform transition-all duration-300 ease-out">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-200 px-6 py-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-xl font-semibold text-gray-900">{vendor.name}</h1>
                <Badge variant={vendor.category as any}>
                  {CATEGORY_LABELS[vendor.category]}
                </Badge>
              </div>
              {vendor.contact_name && (
                <p className="text-sm text-gray-500">{vendor.contact_name}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 transition"
            >
              <X size={20} />
            </button>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2 mb-4">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                vendor.status === 'active' ? 'bg-emerald-400' : 'bg-gray-300'
              }`}
            />
            <span className="text-sm font-medium text-gray-900">{STATUS_LABELS[vendor.status]}</span>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-2">
            {vendor.phone && (
              <a
                href={`tel:${vendor.phone}`}
                title={vendor.phone}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
              >
                <Phone size={16} />
              </a>
            )}
            {vendor.email && (
              <a
                href={`mailto:${vendor.email}`}
                title={vendor.email}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
              >
                <Mail size={16} />
              </a>
            )}
            <button
              onClick={() => onEdit(vendor)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition ml-auto"
            >
              <Pencil size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 border-b border-gray-200 px-6 pt-4">
          <div className="flex gap-6 -mx-6 px-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'overview'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`pb-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'events'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              Events
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`pb-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'tasks'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              Tasks
            </button>
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <VendorOverview vendor={vendor} onEditClick={() => onEdit(vendor)} />
          )}
          {activeTab === 'events' && <VendorEvents vendorId={vendor.id} />}
          {activeTab === 'tasks' && <VendorTasks vendorId={vendor.id} />}
        </div>
      </div>
    </>
  )
}
