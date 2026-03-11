'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Event } from '../events/events-types'

interface CouplesCalendarProps {
  onSelectCouple: (coupleId: string) => void
}

interface EventWithCouple extends Event {
  couple?: {
    id: string
    name: string
    status?: string
  }
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function CouplesCalendar({ onSelectCouple }: CouplesCalendarProps) {
  const supabase = createClient()
  const [currentDate, setCurrentDate] = useState(new Date())

  const { data: events, isLoading } = useQuery({
    queryKey: ['calendar-events'],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('events')
        .select('id, user_id, date, couple_id, status, created_at, venue, timeline_notes, couples(id, name, status)')
        .eq('user_id', user.user.id)
        .not('date', 'is', null)

      if (error) throw error
      // Map couples relationship to couple property for consistency
      return ((data || []) as any[]).map(event => ({
        ...event,
        couple: event.couples
      })) as EventWithCouple[]
    },
  })

  const eventsByDate = useMemo(() => {
    if (!events) return {}
    const grouped: Record<string, EventWithCouple[]> = {}
    events.forEach((event) => {
      const dateStr = event.date
      if (!grouped[dateStr]) grouped[dateStr] = []
      grouped[dateStr].push(event)
    })
    return grouped
  }, [events])

  // Build calendar grid: 6 weeks (42 days) starting from the first Sunday on or before the 1st of the month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay())

    const days = []
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      days.push(date)
    }
    return days
  }, [currentDate])

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const formatDateKey = (date: Date): string => {
    return date.toISOString().split('T')[0]
  }

  const isCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear()
  }

  const isToday = (date: Date): boolean => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const PILL_COLORS: Record<string, string> = {
    new: 'bg-amber-100 text-amber-700',
    contacted: 'bg-blue-100 text-blue-700',
    confirmed: 'bg-purple-100 text-purple-700',
    paid: 'bg-emerald-100 text-emerald-700',
    complete: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-4 mb-8">
        <button
          onClick={handlePrevMonth}
          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition"
          title="Previous month"
        >
          <ChevronLeft size={18} />
        </button>
        <h2 className="text-lg font-semibold text-gray-900">
          {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <button
          onClick={handleNextMonth}
          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition"
          title="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 flex-shrink-0 mb-2">
          {WEEKDAYS.map((day) => (
            <div key={day} className="text-center text-xs font-medium text-gray-600 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-7 gap-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {calendarDays.map((date, idx) => {
            const dateKey = formatDateKey(date)
            const dayEvents = eventsByDate[dateKey] || []
            const isCurrent = isCurrentMonth(date)
            const isCurrentDay = isToday(date)

            return (
              <div
                key={idx}
                className={`border rounded-lg p-2 text-xs flex flex-col gap-1 ${
                  isCurrent ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'
                } ${isCurrentDay ? 'ring-2 ring-green-500' : ''}`}
              >
                <div
                  className={`font-medium ${
                    isCurrent ? 'text-gray-900' : 'text-gray-300'
                  }`}
                >
                  {date.getDate()}
                </div>

                <div className="flex-1 flex flex-col gap-0.5">
                  {dayEvents.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => event.couple && onSelectCouple(event.couple.id)}
                      className={`text-left px-1.5 py-0.5 rounded text-sm font-medium truncate hover:shadow-sm transition cursor-pointer ${PILL_COLORS[event.couple?.status || 'new'] || 'bg-gray-100 text-gray-700'}`}
                    >
                      {event.couple?.name || 'Unnamed'}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
