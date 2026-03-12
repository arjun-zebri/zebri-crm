'use client'

import { Event } from './events/events-types'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { CoupleStatus, STATUS_LABELS } from './couples/couples-types'

interface DashboardUpcomingWeddingsProps {
  events: Event[]
  isLoading: boolean
  onEventClick: (couple: { id: string; name: string }) => void
}

export function DashboardUpcomingWeddings({
  events,
  isLoading,
  onEventClick,
}: DashboardUpcomingWeddingsProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">Upcoming Weddings</h2>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">Upcoming Weddings</h2>
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">No upcoming weddings this month.</p>
          <p className="text-gray-400 text-xs mt-1">Time to grow!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col">
      <h2 className="text-xl font-semibold text-gray-900 mb-3 shrink-0">Upcoming Weddings</h2>
      <div className="space-y-1 overflow-y-auto flex-1">
        {events.map((event) => {
          const coupleStatus = (event.couple?.status || 'new') as CoupleStatus
          return (
            <div
              key={event.id}
              onClick={() => {
                if (event.couple) {
                  onEventClick(event.couple)
                }
              }}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition cursor-pointer text-sm"
            >
              <span className="font-medium text-gray-900 w-32 shrink-0 truncate">
                {event.couple?.name || 'Unknown'}
              </span>
              <span className="text-gray-500 shrink-0 text-xs">
                {new Date(event.date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <span className="text-gray-400 text-xs shrink-0 max-w-xs truncate">{event.venue}</span>
              <Badge variant={coupleStatus}>
                {STATUS_LABELS[coupleStatus]}
              </Badge>
            </div>
          )
        })}
      </div>
    </div>
  )
}
