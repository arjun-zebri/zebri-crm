'use client'

import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { Event, STATUS_LABELS } from '@/types/event'

interface EventOverviewProps {
  event: Event
}

export function EventOverview({ event }: EventOverviewProps) {
  return (
    <div className="space-y-6">
      {/* Details */}
      <div>
        <h3 className="text-sm font-medium text-text mb-4">Details</h3>
        <div className="space-y-3">
          {event.couple && (
            <div className="flex items-start justify-between">
              <span className="text-sm text-text-muted">Couple</span>
              <span className="text-sm text-text">{event.couple.name}</span>
            </div>
          )}
          <div className="flex items-start justify-between">
            <span className="text-sm text-text-muted">Date</span>
            <span className="text-sm text-text">{formatDate(event.date)}</span>
          </div>
          {event.venue && (
            <div className="flex items-start justify-between">
              <span className="text-sm text-text-muted">Venue</span>
              <span className="text-sm text-text">{event.venue}</span>
            </div>
          )}
          <div className="flex items-start justify-between">
            <span className="text-sm text-text-muted">Status</span>
            <Badge variant={event.status as any}>
              {STATUS_LABELS[event.status]}
            </Badge>
          </div>
        </div>
      </div>

      {/* Timeline Notes */}
      {event.timeline_notes && (
        <div>
          <h3 className="text-sm font-medium text-text mb-4">Timeline Notes</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{event.timeline_notes}</p>
        </div>
      )}
    </div>
  )
}
