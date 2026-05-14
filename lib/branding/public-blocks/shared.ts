// Shared helpers + types for the public block renderers. Each block component
// lives in its own file; this is the common surface they all import.

import { DENSITY_PADDING } from '../density'
import type { PublicBranding } from '../public-surface'

export const HEADER_HEIGHTS = { sm: 80, md: 128, lg: 192 } as const

export function fmt(n: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)
}

export function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export function pad(branding: PublicBranding) {
  return DENSITY_PADDING[branding.density]
}

export interface PublicDocItem {
  id: string
  description: string
  quantity?: number
  unit_price?: number
  amount: number
}

export interface PublicDocData {
  title: string
  refNumber: string
  expiresAt: string | null
  items: PublicDocItem[]
  subtotal: number
  taxRate: number
  discountType?: 'percentage' | 'fixed' | null
  discountValue?: number | null
}

export interface ActionSlotProps {
  onPrimary?: () => void
  onSecondary?: () => void
  primaryLabel?: string
  secondaryLabel?: string | null
  primaryDisabled?: boolean
  primaryLoading?: boolean
  hideAction?: boolean
}
