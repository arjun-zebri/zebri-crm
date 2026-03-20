export type CoupleStatus = 'new' | 'contacted' | 'confirmed' | 'paid' | 'complete'

export type LeadSource = 'referral' | 'website' | 'social_media' | 'word_of_mouth' | 'wedding_expo' | 'venue_partner'

export const LEAD_SOURCES: LeadSource[] = ['referral', 'website', 'social_media', 'word_of_mouth', 'wedding_expo', 'venue_partner']

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  referral: 'Referral',
  website: 'Website',
  social_media: 'Social Media',
  word_of_mouth: 'Word of Mouth',
  wedding_expo: 'Wedding Expo',
  venue_partner: 'Venue Partner',
}

export interface Couple {
  id: string
  user_id: string
  name: string
  email: string
  phone: string
  event_date: string | null
  venue: string
  notes: string
  status: CoupleStatus
  lead_source: string | null
  created_at: string
}

export type ViewMode = 'list' | 'kanban' | 'calendar'

export const STATUSES: CoupleStatus[] = ['new', 'contacted', 'confirmed', 'paid', 'complete']

export const STATUS_LABELS: Record<CoupleStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  confirmed: 'Confirmed',
  paid: 'Paid',
  complete: 'Complete',
}

export const STATUS_DOT_COLORS: Record<CoupleStatus, string> = {
  new: 'bg-amber-400',
  contacted: 'bg-blue-400',
  confirmed: 'bg-purple-400',
  paid: 'bg-emerald-400',
  complete: 'bg-gray-400',
}

export const STATUS_TEXT_COLORS: Record<CoupleStatus, string> = {
  new: 'text-amber-500',
  contacted: 'text-blue-500',
  confirmed: 'text-purple-500',
  paid: 'text-emerald-500',
  complete: 'text-gray-400',
}

export const STATUS_BORDER_COLORS: Record<CoupleStatus, string> = {
  new: 'border-amber-300',
  contacted: 'border-blue-300',
  confirmed: 'border-purple-300',
  paid: 'border-emerald-300',
  complete: 'border-gray-300',
}

export const STATUS_PILL_BG: Record<CoupleStatus, string> = {
  new: 'bg-amber-50 text-amber-600',
  contacted: 'bg-blue-50 text-blue-600',
  confirmed: 'bg-purple-50 text-purple-600',
  paid: 'bg-emerald-50 text-emerald-600',
  complete: 'bg-gray-100 text-gray-500',
}

export type SortField = 'name' | 'event_date' | 'created_at'
export type SortDirection = 'asc' | 'desc'

export const SORT_OPTIONS: { label: string; field: SortField; direction: SortDirection }[] = [
  { label: 'Name A–Z', field: 'name', direction: 'asc' },
  { label: 'Name Z–A', field: 'name', direction: 'desc' },
  { label: 'Event date (soonest)', field: 'event_date', direction: 'asc' },
  { label: 'Event date (latest)', field: 'event_date', direction: 'desc' },
  { label: 'Newest first', field: 'created_at', direction: 'desc' },
  { label: 'Oldest first', field: 'created_at', direction: 'asc' },
]
