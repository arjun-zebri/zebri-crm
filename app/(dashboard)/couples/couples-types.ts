export type CoupleStatus = 'new' | 'contacted' | 'confirmed' | 'paid' | 'complete'

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
  created_at: string
}

export type ViewMode = 'list' | 'kanban'

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
