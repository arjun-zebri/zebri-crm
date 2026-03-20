'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useCalendarEvents } from './use-dashboard'

interface DashboardCalendarProps {
  onEventClick: (couple: { id: string; name: string }) => void
}

export function DashboardCalendar({ onEventClick }: DashboardCalendarProps) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate())
  const { data: events, isLoading } = useCalendarEvents(year, month)

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11)
      setYear(year - 1)
    } else {
      setMonth(month - 1)
    }
    setSelectedDay(null)
  }

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0)
      setYear(year + 1)
    } else {
      setMonth(month + 1)
    }
    setSelectedDay(null)
  }

  const monthLabel = new Date(year, month).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })

  // Build event map: day number -> events
  const eventsByDay = new Map<number, typeof events>()
  for (const event of events || []) {
    const day = new Date(event.date).getDate()
    if (!eventsByDay.has(day)) eventsByDay.set(day, [])
    eventsByDay.get(day)!.push(event)
  }

  const isToday = (day: number) =>
    year === today.getFullYear() && month === today.getMonth() && day === today.getDate()

  const selectedEvents = selectedDay ? eventsByDay.get(selectedDay) || [] : []

  // Build cells: 42 slots (6 rows x 7 cols)
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length < 42) cells.push(null)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold text-gray-900">Calendar</h2>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-end gap-1 mb-2">
        <button
          onClick={prevMonth}
          className="p-1 rounded-lg hover:bg-gray-100 transition cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" strokeWidth={1.5} />
        </button>
        <span className="text-sm font-medium text-gray-900">{monthLabel}</span>
        <button
          onClick={nextMonth}
          className="p-1 rounded-lg hover:bg-gray-100 transition cursor-pointer"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" strokeWidth={1.5} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" strokeWidth={1.5} />
        </div>
      ) : (
        <>
          {/* Day headers */}
          <div className="grid grid-cols-7">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-px">
            {cells.map((day, i) => {
              if (day === null) {
                return <div key={i} className="h-7" />
              }
              const hasEvents = eventsByDay.has(day)
              const selected = selectedDay === day
              const todayHighlight = isToday(day)

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(day)}
                  className={`h-7 flex flex-col items-center justify-center rounded-lg text-xs transition cursor-pointer relative ${
                    selected
                      ? 'bg-black text-white'
                      : todayHighlight
                        ? 'ring-2 ring-green-500 text-gray-900'
                        : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {day}
                  {hasEvents && (
                    <span
                      className={`absolute bottom-0.5 w-1 h-1 rounded-full ${
                        selected ? 'bg-white' : 'bg-emerald-400'
                      }`}
                    />
                  )}
                </button>
              )
            })}
          </div>

          {/* All month events */}
          <div className="mt-3 flex-1 min-h-0 scrollbar-thin pr-1">
            {events && events.length > 0 ? (
              <div className="space-y-1">
                {events.map((event) => {
                  const d = new Date(event.date)
                  const eventDate = `${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })}`
                  return (
                    <div
                      key={event.id}
                      onClick={() => {
                        if (event.couple) onEventClick(event.couple)
                      }}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition cursor-pointer text-sm"
                    >
                      <span className="text-gray-900 truncate flex-1">
                        {event.couple?.name || 'Unknown'}
                      </span>
                      <span className="text-gray-400 text-xs shrink-0">
                        {eventDate}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-gray-400 text-xs text-center py-2">No events this month</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
