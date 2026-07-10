/**
 * Branding preview-state types.
 *
 * The editable brand-kit shape (fonts, density, colour, block tree) that
 * drives the branding editor and the public-surface preview. The block AST
 * itself stays co-located with its renderers in branding/blocks.
 *
 * @module types/branding-preview
 */

import type { HeadingFont, BodyFont, FontWeight } from '@/lib/branding/fonts'
import type { Density } from '@/lib/branding/themes'
import type { Block } from '@/app/(dashboard)/branding/blocks/types'

export interface BrandPreviewState {
  logoUrl: string
  faviconUrl: string
  headerImageUrl: string
  brandColor: string
  accentColor: string
  surfaceColor: string
  textColor: string
  mutedColor: string
  secondaryColor: string
  secondaryTextColor: string
  tagline: string
  footerText: string
  abn: string
  showContactOnDocuments: boolean
  fontHeading: HeadingFont
  fontBody: BodyFont
  fontWeight: FontWeight
  fontBodyWeight: FontWeight
  fontScale: number
  density: Density
  cornerRadius: number
  docPadding: number
  businessName: string
  phone: string
  website: string
  instagramUrl: string
  facebookUrl: string
  /** Which couple-portal sections are enabled. Drives the couplePortal block preview. */
  portalSections?: {
    timeline: boolean
    contacts: boolean
    payments: boolean
    contracts: boolean
    songs: boolean
    files: boolean
  }
}

export interface BrandPreviewActions {
  onEditLogo: () => void
  onEditHeader: () => void
  onEditColor: () => void
  setTagline: (v: string) => void
}

export type SurfaceTab = 'proposal' | 'invoice' | 'contract' | 'portal'

export const NOOP_ACTIONS: BrandPreviewActions = {
  onEditLogo: () => {},
  onEditHeader: () => {},
  onEditColor: () => {},
  setTagline: () => {},
}

// Canonical map lives in lib/branding/density.ts now (used by both the editor
// renderer and the public couple-facing pages). Re-export for callers.
export { DENSITY_PADDING } from '@/lib/branding/density'

export interface BrandKit {
  id: string
  name: string
  brandColor: string
  accentColor: string
  surfaceColor: string
  textColor: string
  mutedColor: string
  secondaryColor: string
  secondaryTextColor: string
  fontHeading: HeadingFont
  fontBody: BodyFont
  fontWeight: FontWeight
  fontBodyWeight: FontWeight
  fontScale: number
  density: Density
  cornerRadius: number
  docPadding?: number
  tagline?: string
  logoUrl?: string
  faviconUrl?: string
  headerImageUrl?: string
  /** Per-surface block trees. `quote` is the LEGACY key from before
   *  the proposals rollout — kits saved earlier still carry it; the
   *  editor normalises it into `proposal` on apply. */
  blocks?: {
    proposal?: Block[]
    quote?: Block[]
    invoice: Block[]
    contract: Block[]
    portal: Block[]
  }
  createdAt: string
}
