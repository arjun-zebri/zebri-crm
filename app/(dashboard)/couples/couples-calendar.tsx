'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, MapPin, Check, Users, CheckSquare, Calendar, SlidersHorizontal, X } from 'lucide-react'
import { Event } from '../events/events-types'
import { CoupleStatusRecord, getStatusClasses } from './couples-types'
import { useCoupleStatuses } from './use-couple-statuses'

interface CouplesCalendarProps {
  onSelectCouple: (coupleId: string) => void
}

interface EventWithCouple extends Event {
  couple?: {
    id: string
    name: string
    status?: string
  }
  event_contacts?: { count: number }[]
  tasks?: { count: number }[]
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type CalendarView = 'month' | 'week' | 'day'

const CHECKBOX_COLOR_MAP: Record<string, string> = {
  amber: 'bg-amber-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  emerald: 'bg-emerald-500',
  gray: 'bg-gray-400',
  green: 'bg-green-500',
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  pink: 'bg-pink-500',
  indigo: 'bg-indigo-500',
}

function StatusCheckbox({ checked, color }: { checked: boolean; color: string }) {
  return (
    <div
      className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 pointer-events-none transition ${
        checked ? `${color} border-transparent` : 'border-2 border-gray-300 bg-white'
      }`}
    >
      {checked && <Check size={10} strokeWidth={2.5} className="text-white" />}
    </div>
  )
}

export function CouplesCalendar({ onSelectCouple }: CouplesCalendarProps) {
  const supabase = createClient()
  const { data: statuses } = useCoupleStatuses()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [calendarView, setCalendarView] = useState<CalendarView>('week')
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set(statuses.map(s => s.slug)))
  const [miniNavDate, setMiniNavDate] = useState(new Date())
  const [coupleSearch, setCoupleSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { data: events } = useQuery({
    queryKey: ['calendar-events'],
    queryFn: async () => {
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('events')
        .select('id, user_id, date, couple_id, status, created_at, venue, timeline_notes, couples(id, name, status), event_contacts(count), tasks!tasks_related_event_id_fkey(count)')
        .eq('user_id', user.user.id)
        .not('date', 'is', null)

      if (error) throw error
      return ((data || []) as any[]).map(event => ({
        ...event,
        couple: event.couples
      })) as EventWithCouple[]
    },
  })

  const filteredEvents = useMemo(() => {
    if (!events) return []
    return events.filter(event => {
      const status = event.couple?.status || 'new'
      const hasStatus = activeStatuses.has(status)
      const hasSearch = coupleSearch === '' || event.couple?.name?.toLowerCase().includes(coupleSearch.toLowerCase())
      return hasStatus && hasSearch
    })
  }, [events, activeStatuses, coupleSearch])

  const eventsByDate = useMemo(() => {
    const grouped: Record<string, EventWithCouple[]> = {}
    filteredEvents.forEach((event) => {
      const dateStr = event.date
      if (!grouped[dateStr]) grouped[dateStr] = []
      grouped[dateStr].push(event)
    })
    return grouped
  }, [filteredEvents])

  const formatDateKey = (date: Date): string => {
    return date.toISOString().split('T')[0]
  }

  const isToday = (date: Date): boolean => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const toggleStatus = (statusSlug: string) => {
    const newStatuses = new Set(activeStatuses)
    if (newStatuses.has(statusSlug)) {
      newStatuses.delete(statusSlug)
    } else {
      newStatuses.add(statusSlug)
    }
    setActiveStatuses(newStatuses)
  }

  const handlePrev = () => {
    if (calendarView === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    } else if (calendarView === 'week') {
      const d = new Date(currentDate)
      d.setDate(d.getDate() - 7)
      setCurrentDate(d)
    } else {
      const d = new Date(currentDate)
      d.setDate(d.getDate() - 1)
      setCurrentDate(d)
    }
  }

  const handleNext = () => {
    if (calendarView === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    } else if (calendarView === 'week') {
      const d = new Date(currentDate)
      d.setDate(d.getDate() + 7)
      setCurrentDate(d)
    } else {
      const d = new Date(currentDate)
      d.setDate(d.getDate() + 1)
      setCurrentDate(d)
    }
  }

  const getHeaderLabel = (): string => {
    if (calendarView === 'month') {
      return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    }
    if (calendarView === 'week') {
      const weekStart = getWeekStart(currentDate)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      if (weekStart.getMonth() === weekEnd.getMonth()) {
        return `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}\u2013${weekEnd.getDate()}, ${weekStart.getFullYear()}`
      }
      return `${MONTHS_SHORT[weekStart.getMonth()]} ${weekStart.getDate()} \u2013 ${MONTHS_SHORT[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`
    }
    return `${WEEKDAYS[currentDate.getDay()]}, ${MONTHS[currentDate.getMonth()]} ${currentDate.getDate()}`
  }

  const miniMonthDays = getMonthDays(miniNavDate)
  const daysWithEvents = new Set(
    (events || [])
      .filter(e => e.couple && activeStatuses.has(e.couple.status || 'new'))
      .map(e => e.date)
  )

  return (
    <div className="flex h-full">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-10 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <div className={`
        flex-col gap-5 pb-6 overflow-y-auto
        ${sidebarOpen
          ? 'fixed top-0 left-0 h-full w-[280px] z-20 bg-white shadow-xl p-5 flex'
          : 'hidden md:flex md:w-56 md:flex-shrink-0 border-r border-gray-200 pr-5'}
      `}>
        {/* Mobile close button */}
        <div className="flex justify-end md:hidden mb-1">
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 text-gray-400 hover:text-gray-600 transition cursor-pointer"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Mini Month */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setMiniNavDate(new Date(miniNavDate.getFullYear(), miniNavDate.getMonth() - 1, 1))}
              className="p-1 text-gray-500 hover:bg-gray-100 rounded-md transition cursor-pointer"
            >
              <ChevronLeft size={14} strokeWidth={1.5} />
            </button>
            <span className="text-sm font-medium text-gray-900">
              {MONTHS_SHORT[miniNavDate.getMonth()]} {miniNavDate.getFullYear()}
            </span>
            <button
              onClick={() => setMiniNavDate(new Date(miniNavDate.getFullYear(), miniNavDate.getMonth() + 1, 1))}
              className="p-1 text-gray-500 hover:bg-gray-100 rounded-md transition cursor-pointer"
            >
              <ChevronRight size={14} strokeWidth={1.5} />
            </button>
          </div>

          {/* Mini weekday headers */}
          <div className="grid grid-cols-7">
            {WEEKDAYS_SHORT.map((day, i) => (
              <div key={i} className="text-center text-xs text-gray-400 py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Mini calendar grid */}
          <div className="grid grid-cols-7">
            {miniMonthDays.map((date, idx) => {
              const dateKey = formatDateKey(date)
              const hasEvents = daysWithEvents.has(dateKey)
              const isMiniMonth = date.getMonth() === miniNavDate.getMonth()
              const isCurrentDay = isToday(date)

              return (
                <button
                  key={idx}
                  onClick={() => setCurrentDate(new Date(date))}
                  className={`h-7 w-7 mx-auto flex flex-col items-center justify-center text-xs rounded-md transition cursor-pointer relative ${
                    isMiniMonth ? 'text-gray-900 hover:bg-gray-100' : 'text-gray-300'
                  } ${isCurrentDay ? 'bg-gray-900 text-white hover:bg-gray-800' : ''}`}
                >
                  {date.getDate()}
                  {hasEvents && !isCurrentDay && (
                    <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-emerald-500"></div>
                  )}
                  {hasEvents && isCurrentDay && (
                    <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-white"></div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex flex-col gap-2 border-t border-gray-200 pt-4">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Status</h3>
          {statuses.map((status) => (
            <button
              key={status.slug}
              onClick={() => toggleStatus(status.slug)}
              className="flex items-center gap-2.5 text-sm hover:bg-gray-50 rounded-md px-1.5 py-1 transition cursor-pointer"
            >
              <StatusCheckbox
                checked={activeStatuses.has(status.slug)}
                color={CHECKBOX_COLOR_MAP[status.color] || 'bg-gray-400'}
              />
              <span className="text-sm text-gray-700">{status.name}</span>
            </button>
          ))}
        </div>

        {/* Couple Search */}
        <div className="flex flex-col gap-2 border-t border-gray-200 pt-4">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Search</h3>
          <input
            type="text"
            placeholder="Filter by couple..."
            value={coupleSearch}
            onChange={(e) => setCoupleSearch(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-200 outline-none"
          />
        </div>
      </div>

      {/* Main Calendar Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden pl-6">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between mb-5 pb-4 border-b border-gray-200">
          {/* Left: Filter toggle (mobile) + Nav */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition cursor-pointer"
            >
              <SlidersHorizontal size={16} strokeWidth={1.5} />
            </button>
            <button
              data-testid="calendar-prev-btn"
              onClick={handlePrev}
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition cursor-pointer"
            >
              <ChevronLeft size={16} strokeWidth={1.5} />
            </button>
            <h2 data-testid="calendar-header" className="text-sm font-semibold text-gray-900 min-w-32 sm:min-w-44 text-center select-none">
              {getHeaderLabel()}
            </h2>
            <button
              data-testid="calendar-next-btn"
              onClick={handleNext}
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition cursor-pointer"
            >
              <ChevronRight size={16} strokeWidth={1.5} />
            </button>
          </div>

          {/* Right: View tabs */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {(['day', 'week', 'month'] as const).map((view) => (
              <button
                key={view}
                onClick={() => setCalendarView(view)}
                className={`px-2 sm:px-3 py-1 text-sm rounded-md transition cursor-pointer font-medium ${
                  calendarView === view
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="sm:hidden">{view[0].toUpperCase()}</span>
                <span className="hidden sm:inline capitalize">{view}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Calendar Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {calendarView === 'month' && (
            <MonthView currentDate={currentDate} eventsByDate={eventsByDate} onSelectCouple={onSelectCouple} statuses={statuses} />
          )}
          {calendarView === 'week' && (
            <WeekView currentDate={currentDate} eventsByDate={eventsByDate} onSelectCouple={onSelectCouple} statuses={statuses} />
          )}
          {calendarView === 'day' && (
            <DayView currentDate={currentDate} eventsByDate={eventsByDate} onSelectCouple={onSelectCouple} statuses={statuses} />
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Helpers ──────────────────────────────────────────── */

function getMonthDays(date: Date): Date[] {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
  const startDate = new Date(firstDay)
  startDate.setDate(startDate.getDate() - firstDay.getDay())
  const days = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    days.push(d)
  }
  return days
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  return d
}

function getWeekDays(date: Date): Date[] {
  const start = getWeekStart(date)
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    days.push(d)
  }
  return days
}

function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0]
}

function isTodayFn(date: Date): boolean {
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

function EventPill({ event, onSelectCouple, statuses }: { event: EventWithCouple; onSelectCouple: (id: string) => void; statuses: CoupleStatusRecord[] }) {
  const statusSlug = event.couple?.status || 'new'
  const status = statuses.find(s => s.slug === statusSlug)
  const classes = status ? getStatusClasses(status.color) : getStatusClasses('gray')
  return (
    <button
      onClick={() => event.couple && onSelectCouple(event.couple.id)}
      className={`text-left w-full px-2.5 py-1.5 rounded-md text-xs font-medium truncate border transition hover:shadow-sm cursor-pointer ${classes.pill} border-gray-200`}
    >
      {event.couple?.name || 'Unnamed'}
    </button>
  )
}

/* ─── Month View ───────────────────────────────────────── */

function MonthView({
  currentDate,
  eventsByDate,
  onSelectCouple,
  statuses,
}: {
  currentDate: Date
  eventsByDate: Record<string, EventWithCouple[]>
  onSelectCouple: (coupleId: string) => void
  statuses: CoupleStatusRecord[]
}) {
  const monthDays = getMonthDays(currentDate)

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-7 flex-shrink-0 border-b border-gray-200">
        {WEEKDAYS.map((day) => (
          <div key={day} data-testid={`weekday-${day}`} className="text-center text-xs font-medium text-gray-500 py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-7 auto-rows-fr">
        {monthDays.map((date, idx) => {
          const dateKey = formatDateKey(date)
          const dayEvents = eventsByDate[dateKey] || []
          const isCurrent = date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear()
          const isCurrentDay = isTodayFn(date)

          return (
            <div
              key={idx}
              className={`border-b border-r border-gray-100 p-1.5 flex flex-col gap-0.5 min-h-[80px] ${
                !isCurrent ? 'bg-gray-50/50' : ''
              }`}
            >
              <div className={`text-xs font-medium mb-0.5 ${isCurrent ? 'text-gray-900' : 'text-gray-300'}`}>
                <span className={isCurrentDay ? 'bg-gray-900 text-white rounded-full w-5 h-5 inline-flex items-center justify-center' : ''}>
                  {date.getDate()}
                </span>
              </div>
              {dayEvents.slice(0, 3).map((event) => (
                <EventPill key={event.id} event={event} onSelectCouple={onSelectCouple} statuses={statuses} />
              ))}
              {dayEvents.length > 3 && (
                <div className="text-xs text-gray-400 px-1">+{dayEvents.length - 3} more</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Week View ────────────────────────────────────────── */

function WeekView({
  currentDate,
  eventsByDate,
  onSelectCouple,
  statuses,
}: {
  currentDate: Date
  eventsByDate: Record<string, EventWithCouple[]>
  onSelectCouple: (coupleId: string) => void
  statuses: CoupleStatusRecord[]
}) {
  const weekDays = getWeekDays(currentDate)

  return (
    <div className="grid grid-cols-7 h-full">
      {weekDays.map((date, idx) => {
        const dateKey = formatDateKey(date)
        const dayEvents = eventsByDate[dateKey] || []
        const isCurrentDay = isTodayFn(date)

        return (
          <div key={idx} className="flex flex-col border-r border-gray-100 last:border-r-0 min-h-0">
            {/* Day header */}
            <div className={`px-2 py-3 text-center border-b border-gray-200 flex-shrink-0 ${isCurrentDay ? 'bg-green-50/50' : ''}`}>
              <div className="text-xs text-gray-500 font-medium">{WEEKDAYS[date.getDay()]}</div>
              <div className={`text-sm font-semibold mt-0.5 ${isCurrentDay ? 'text-gray-900' : 'text-gray-900'}`}>
                <span className={isCurrentDay ? 'bg-gray-900 text-white rounded-full w-6 h-6 inline-flex items-center justify-center text-xs' : ''}>
                  {date.getDate()}
                </span>
              </div>
            </div>

            {/* Events */}
            <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-1.5">
              {dayEvents.length === 0 ? (
                <div className="flex-1" />
              ) : (
                dayEvents.map((event) => {
                  const statusSlug = event.couple?.status || 'new'
                  const status = statuses.find(s => s.slug === statusSlug)
                  const classes = status ? getStatusClasses(status.color) : getStatusClasses('gray')
                  return (
                    <button
                      key={event.id}
                      onClick={() => event.couple && onSelectCouple(event.couple.id)}
                      className={`text-left w-full px-2.5 py-2 rounded-lg border transition hover:shadow-md cursor-pointer ${classes.pill} border-gray-200`}
                    >
                      <div className={`text-xs font-semibold truncate text-gray-900`}>
                        {event.couple?.name || 'Unnamed'}
                      </div>
                      {event.venue && (
                        <div className="text-xs text-gray-500 truncate mt-0.5 flex items-center gap-1">
                          <MapPin size={10} strokeWidth={1.5} />
                          {event.venue}
                        </div>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Day View ─────────────────────────────────────────── */

const EVENT_STATUS_LABELS: Record<string, string> = {
  upcoming: 'Upcoming',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const ACCENT_BAR_COLOR_MAP: Record<string, string> = {
  amber: 'bg-amber-400',
  blue: 'bg-blue-400',
  purple: 'bg-purple-400',
  emerald: 'bg-emerald-400',
  gray: 'bg-gray-400',
  green: 'bg-green-400',
  red: 'bg-red-400',
  orange: 'bg-orange-400',
  pink: 'bg-pink-400',
  indigo: 'bg-indigo-400',
}

function DayView({
  currentDate,
  eventsByDate,
  onSelectCouple,
  statuses,
}: {
  currentDate: Date
  eventsByDate: Record<string, EventWithCouple[]>
  onSelectCouple: (coupleId: string) => void
  statuses: CoupleStatusRecord[]
}) {
  const dateKey = formatDateKey(currentDate)
  const dayEvents = eventsByDate[dateKey] || []

  return (
    <div className="flex flex-col h-full">
      {dayEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-3">
          <Calendar size={40} strokeWidth={1} />
          <p className="text-sm text-gray-400">No events on this day</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 p-6">
          {dayEvents.map((event) => {
            const coupleStatusSlug = event.couple?.status || 'new'
            const coupleStatus = statuses.find(s => s.slug === coupleStatusSlug)
            const accentColor = coupleStatus ? ACCENT_BAR_COLOR_MAP[coupleStatus.color] : ACCENT_BAR_COLOR_MAP.gray
            const classes = coupleStatus ? getStatusClasses(coupleStatus.color) : getStatusClasses('gray')
            const statusName = coupleStatus?.name || coupleStatusSlug.charAt(0).toUpperCase() + coupleStatusSlug.slice(1)
            const vendorCount = event.event_contacts?.[0]?.count || 0
            const taskCount = event.tasks?.[0]?.count || 0
            const eventStatus = event.status || 'upcoming'

            return (
              <div
                key={event.id}
                onClick={() => event.couple && onSelectCouple(event.couple.id)}
                className="relative bg-white border border-gray-200 rounded-xl overflow-hidden transition hover:shadow-md cursor-pointer"
              >
                {/* Left accent bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentColor}`} />

                <div className="pl-6 pr-6 py-5">
                  {/* Top row: name + status badge */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="text-base font-semibold text-gray-900">
                        {event.couple?.name || 'Unnamed'}
                      </h4>
                      {event.venue && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-sm text-gray-500">
                          <MapPin size={14} strokeWidth={1.5} className="flex-shrink-0" />
                          {event.venue}
                        </div>
                      )}
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 capitalize border border-gray-200 ${classes.pill}`}>
                      {statusName}
                    </span>
                  </div>

                  {/* Timeline notes */}
                  {event.timeline_notes && (
                    <p className="text-sm text-gray-500 mt-3 whitespace-pre-line leading-relaxed">{event.timeline_notes}</p>
                  )}

                  {/* Footer: counts */}
                  <div className="flex items-center gap-5 mt-4 pt-4 border-t border-gray-100 text-xs">
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <Users size={14} strokeWidth={1.5} />
                      <span className="font-medium">{vendorCount}</span>
                      <span className="text-gray-400">contact{vendorCount !== 1 ? 's' : ''}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <CheckSquare size={14} strokeWidth={1.5} />
                      <span className="font-medium">{taskCount}</span>
                      <span className="text-gray-400">task{taskCount !== 1 ? 's' : ''}</span>
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
