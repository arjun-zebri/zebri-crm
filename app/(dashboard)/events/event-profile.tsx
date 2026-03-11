'use client'

import { useState } from 'react'
import { X, Pencil } from 'lucide-react'
import { Event, STATUS_LABELS } from './events-types'
import { Badge } from '@/components/ui/badge'
import { EventOverview } from './event-overview'
import { EventVendors } from './event-vendors'
import { EventTasks } from './event-tasks'

interface EventProfileProps {
  event: Event | null
  onClose: () => void
  onEdit: (event: Event) => void
}

export function EventProfile({ event, onClose, onEdit }: EventProfileProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'vendors' | 'tasks'>('overview')

  if (!event) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-[640px] bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex-shrink-0 px-8 pt-6 pb-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold text-gray-900 mb-1">{event.couple?.name}</h1>
              {event.date && (
                <p className="text-sm text-gray-500">{new Date(event.date).toLocaleDateString()}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 transition cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 mb-5">
            <Badge variant={event.status as any}>
              {STATUS_LABELS[event.status]}
            </Badge>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(event)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition cursor-pointer ml-auto"
            >
              <Pencil size={14} />
              Edit
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 border-t border-b border-gray-200 px-8">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-3 text-sm font-medium border-b-2 -mb-px transition cursor-pointer ${
                activeTab === 'overview'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('vendors')}
              className={`py-3 text-sm font-medium border-b-2 -mb-px transition cursor-pointer ${
                activeTab === 'vendors'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              Vendors
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`py-3 text-sm font-medium border-b-2 -mb-px transition cursor-pointer ${
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
        <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
          {activeTab === 'overview' && <EventOverview event={event} />}
          {activeTab === 'vendors' && <EventVendors eventId={event.id} />}
          {activeTab === 'tasks' && <EventTasks eventId={event.id} />}
        </div>
      </div>
    </>
  )
}
