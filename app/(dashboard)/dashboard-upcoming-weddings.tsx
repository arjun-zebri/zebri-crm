'use client'

import { Event } from './events/events-types'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'

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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Upcoming Weddings</h2>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Upcoming Weddings</h2>
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">No upcoming weddings this month.</p>
          <p className="text-gray-400 text-xs mt-1">Time to grow!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Upcoming Weddings</h2>
      <div className="space-y-3">
        {events.map((event) => (
          <div
            key={event.id}
            onClick={() => {
              if (event.couple) {
                onEventClick(event.couple)
              }
            }}
            className="p-4 bg-gray-50 rounded-lg hover:shadow-md transition cursor-pointer"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {event.couple?.name || 'Unknown Couple'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(event.date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <Badge variant="upcoming">Upcoming</Badge>
            </div>
            {event.venue && (
              <p className="text-xs text-gray-500 truncate">{event.venue}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
