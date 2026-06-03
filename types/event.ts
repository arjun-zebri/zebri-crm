/**
 * Event domain types and constants.
 *
 * Wedding/event shapes owned by a couple (an event always belongs to a
 * couple - there is no standalone events surface). Used by couple profile,
 * calendar, timeline, and the dashboard.
 *
 * @module types/event
 */

export type EventStatus = 'upcoming' | 'completed' | 'cancelled'

export interface Event {
  id: string
  user_id: string
  couple_id: string
  date: string
  title?: string | null
  venue: string
  venue_phone?: string | null
  venue_website?: string | null
  venue_lat?: number | null
  venue_lng?: number | null
  drive_time_from_home_seconds?: number | null
  drive_time_to_next_event_seconds?: number | null
  drive_distance_from_home_meters?: number | null
  drive_distance_to_next_event_meters?: number | null
  timeline_notes: string
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
