'use client'

import { PortalEvent } from './page'

interface OverviewSectionProps {
  coupleName: string
  coupleEmail: string | null
  events: PortalEvent[]
}

function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function daysUntil(dateStr: string): number | null {
  const eventDate = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffTime = eventDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

export function OverviewSection({ coupleName, coupleEmail, events }: OverviewSectionProps) {
  return (
    <div className="space-y-8">
      {/* Couple info card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-sm font-medium text-gray-500 mb-4">Your details</h3>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Name</p>
            <p className="text-lg font-semibold text-gray-900">{coupleName}</p>
          </div>
          {coupleEmail && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Email</p>
              <p className="text-sm text-gray-700">{coupleEmail}</p>
            </div>
          )}
        </div>
      </div>

      {/* Events */}
      {events.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-4">Your events</h3>
          <div className="space-y-3">
            {events.map((event) => {
              const days = daysUntil(event.date)
              const isUpcoming = days !== null && days > 0
              const daysText = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days !== null && isUpcoming ? `${days} days away` : null

              return (
                <div key={event.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{formatEventDate(event.date)}</p>
                      {event.venue && <p className="text-sm text-gray-500 mt-1">{event.venue}</p>}
                    </div>
                    {daysText && (
                      <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${
                        isUpcoming
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {daysText}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
          <p className="text-sm text-gray-600">No events yet. Check back when your MC adds an event.</p>
        </div>
      )}
    </div>
  )
}
