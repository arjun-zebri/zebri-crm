'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { EventDayCalendar } from '../events/event-day-calendar'

interface Event {
  id: string
  date: string
  venue: string | null
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface CoupleTimelineProps {
  coupleId: string
}

export function CoupleTimeline({ coupleId }: CoupleTimelineProps) {
  const supabase = createClient()
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['couple-events', coupleId],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('events')
        .select('id, date, venue')
        .eq('couple_id', coupleId)
        .eq('user_id', user.user.id)
        .order('date', { ascending: true })
      if (error) throw error
      return (data || []) as Event[]
    },
  })

  const activeEventId = selectedEventId ?? events[0]?.id ?? null

  if (eventsLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-gray-500">No events yet</p>
        <p className="text-sm text-gray-400 mt-1">Add an event to start building a timeline.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      {/* Event selector */}
      {events.length > 1 ? (
        <div className="relative inline-block shrink-0">
          <select
            value={activeEventId ?? ''}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="appearance-none border border-gray-200 rounded-xl px-3 py-2 pr-8 text-sm bg-white hover:bg-gray-50 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-200"
          >
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {formatDate(event.date)}{event.venue ? ` — ${event.venue}` : ''}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      ) : (
        <p className="text-sm text-gray-500 shrink-0">
          {formatDate(events[0].date)}{events[0].venue ? ` — ${events[0].venue}` : ''}
        </p>
      )}

      {/* Day calendar grid */}
      {activeEventId && <EventDayCalendar eventId={activeEventId} hideShareLink />}
    </div>
  )
}
