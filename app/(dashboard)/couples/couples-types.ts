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
  status: string
  lead_source: string | null
  kanban_position: number
  created_at: string
  portal_token?: string
  portal_token_enabled?: boolean
}

export interface CoupleStatusRecord {
  id: string
  user_id: string
  name: string
  slug: string
  color: string
  position: number
  created_at: string
}

export type ViewMode = 'list' | 'kanban'

export const COLOR_PALETTE = ['amber', 'blue', 'purple', 'emerald', 'gray', 'green', 'red', 'orange', 'pink', 'indigo'] as const
export type StatusColor = typeof COLOR_PALETTE[number]

export const STATUS_CLASSES: Record<StatusColor, { pill: string; dot: string; border: string; text: string }> = {
  amber: { pill: 'bg-amber-50 text-amber-600', dot: 'bg-amber-400', border: 'border-amber-300', text: 'text-amber-500' },
  blue: { pill: 'bg-blue-50 text-blue-600', dot: 'bg-blue-400', border: 'border-blue-300', text: 'text-blue-500' },
  purple: { pill: 'bg-purple-50 text-purple-600', dot: 'bg-purple-400', border: 'border-purple-300', text: 'text-purple-500' },
  emerald: { pill: 'bg-emerald-50 text-emerald-600', dot: 'bg-emerald-400', border: 'border-emerald-300', text: 'text-emerald-500' },
  gray: { pill: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400', border: 'border-gray-300', text: 'text-gray-400' },
  green: { pill: 'bg-green-50 text-green-600', dot: 'bg-green-400', border: 'border-green-300', text: 'text-green-500' },
  red: { pill: 'bg-red-50 text-red-600', dot: 'bg-red-400', border: 'border-red-300', text: 'text-red-500' },
  orange: { pill: 'bg-orange-50 text-orange-600', dot: 'bg-orange-400', border: 'border-orange-300', text: 'text-orange-500' },
  pink: { pill: 'bg-pink-50 text-pink-600', dot: 'bg-pink-400', border: 'border-pink-300', text: 'text-pink-500' },
  indigo: { pill: 'bg-indigo-50 text-indigo-600', dot: 'bg-indigo-400', border: 'border-indigo-300', text: 'text-indigo-500' },
}

export function getStatusClasses(color: string) {
  return STATUS_CLASSES[color as StatusColor] ?? STATUS_CLASSES.gray
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
