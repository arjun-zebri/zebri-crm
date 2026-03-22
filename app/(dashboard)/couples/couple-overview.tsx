'use client'

import { Couple, CoupleStatusRecord, getStatusClasses } from './couples-types'
import { formatDate } from '@/lib/utils'

interface CoupleOverviewProps {
  couple: Couple
  statuses: CoupleStatusRecord[]
}

export function CoupleOverview({ couple, statuses }: CoupleOverviewProps) {
  const status = statuses.find(s => s.slug === couple.status)
  const statusName = status?.name || couple.status.charAt(0).toUpperCase() + couple.status.slice(1)
  const statusClasses = status ? getStatusClasses(status.color) : getStatusClasses('gray')

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
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusClasses.pill}`}>
              {statusName}
            </span>
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
