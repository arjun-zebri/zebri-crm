'use client'

import { Couple, STATUS_LABELS } from './couples-types'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

interface CoupleOverviewProps {
  couple: Couple
}

export function CoupleOverview({ couple }: CoupleOverviewProps) {
  return (
    <div className="space-y-6">
      {/* Contact details */}
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-4">Details</h3>
        <div className="space-y-3">
          {couple.phone && (
            <div className="flex items-start justify-between">
              <span className="text-sm text-gray-500">Phone</span>
              <a href={`tel:${couple.phone}`} className="text-sm text-gray-900 hover:text-blue-600 transition">{couple.phone}</a>
            </div>
          )}
          {couple.email && (
            <div className="flex items-start justify-between">
              <span className="text-sm text-gray-500">Email</span>
              <a href={`mailto:${couple.email}`} className="text-sm text-gray-900 hover:text-blue-600 transition">{couple.email}</a>
            </div>
          )}
          {couple.event_date && (
            <div className="flex items-start justify-between">
              <span className="text-sm text-gray-500">Event date</span>
              <span className="text-sm text-gray-900">{formatDate(couple.event_date)}</span>
            </div>
          )}
          {couple.venue && (
            <div className="flex items-start justify-between">
              <span className="text-sm text-gray-500">Venue</span>
              <span className="text-sm text-gray-900">{couple.venue}</span>
            </div>
          )}
          <div className="flex items-start justify-between">
            <span className="text-sm text-gray-500">Status</span>
            <Badge variant={couple.status as any}>
              {STATUS_LABELS[couple.status]}
            </Badge>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-4">Notes</h3>
        {couple.notes ? (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{couple.notes}</p>
        ) : (
          <p className="text-sm text-gray-400 italic">No notes yet.</p>
        )}
      </div>
    </div>
  )
}
