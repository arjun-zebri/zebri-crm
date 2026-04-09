export type EventStatus = 'upcoming' | 'completed' | 'cancelled'

export interface Event {
  id: string
  user_id: string
  couple_id: string
  date: string
  venue: string
  timeline_notes: string
  price: number | null
  status: EventStatus
  share_token?: string | null
  share_token_enabled?: boolean
  created_at: string
  couple?: {
    id: string
    name: string
    status?: string
  }
}

export interface TimelineItem {
  id: string
  event_id: string
  user_id: string
  start_time: string | null
  title: string
  description: string | null
  duration_min: number | null
  contact_id: string | null
  position: number
  pending_review?: boolean
  created_at: string
  contact?: {
    id: string
    name: string
    category: string
  } | null
}

export const STATUS_LABELS: Record<EventStatus, string> = {
  upcoming: 'Upcoming',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const STATUS_DOT_COLORS: Record<EventStatus, string> = {
  upcoming: 'bg-blue-400',
  completed: 'bg-emerald-400',
  cancelled: 'bg-red-400',
}

export type SortField = 'date' | 'created_at'
export type SortDirection = 'asc' | 'desc'

export const SORT_OPTIONS: { label: string; field: SortField; direction: SortDirection }[] = [
  { label: 'Date (soonest)', field: 'date', direction: 'asc' },
  { label: 'Date (latest)', field: 'date', direction: 'desc' },
  { label: 'Newest first', field: 'created_at', direction: 'desc' },
  { label: 'Oldest first', field: 'created_at', direction: 'asc' },
]
