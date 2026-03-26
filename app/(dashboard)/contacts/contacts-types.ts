export type ContactCategory =
  | 'venue'
  | 'celebrant'
  | 'photographer'
  | 'videographer'
  | 'dj'
  | 'florist'
  | 'hair_makeup'
  | 'caterer'
  | 'photo_booth'
  | 'lighting_av'
  | 'planner'
  | 'other'

export type ContactStatus = 'active' | 'inactive'

export interface Contact {
  id: string
  user_id: string
  name: string
  contact_name: string
  email: string
  phone: string
  category: ContactCategory
  notes: string
  status: ContactStatus
  created_at: string
}

export const CATEGORIES: ContactCategory[] = [
  'venue',
  'celebrant',
  'photographer',
  'videographer',
  'dj',
  'florist',
  'hair_makeup',
  'caterer',
  'photo_booth',
  'lighting_av',
  'planner',
  'other',
]

export const CATEGORY_LABELS: Record<ContactCategory, string> = {
  venue: 'Venue',
  celebrant: 'Celebrant',
  photographer: 'Photographer',
  videographer: 'Videographer',
  dj: 'DJ',
  florist: 'Florist',
  hair_makeup: 'Hair & Makeup',
  caterer: 'Caterer',
  photo_booth: 'Photo Booth',
  lighting_av: 'Lighting / AV',
  planner: 'Planner',
  other: 'Other',
}

export const STATUSES: ContactStatus[] = ['active', 'inactive']

export const STATUS_LABELS: Record<ContactStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
}

export type SortField = 'name' | 'created_at'
export type SortDirection = 'asc' | 'desc'

export const SORT_OPTIONS: { label: string; field: SortField; direction: SortDirection }[] = [
  { label: 'Name A–Z', field: 'name', direction: 'asc' },
  { label: 'Name Z–A', field: 'name', direction: 'desc' },
  { label: 'Newest first', field: 'created_at', direction: 'desc' },
  { label: 'Oldest first', field: 'created_at', direction: 'asc' },
]
