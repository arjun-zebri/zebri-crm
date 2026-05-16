import type { HeadingFont, BodyFont, FontWeight } from '@/lib/branding/fonts'
import type { Density } from '@/lib/branding/themes'
import type { Block } from './blocks/types'

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
}

export interface BrandPreviewActions {
  onEditLogo: () => void
  onEditHeader: () => void
  onEditColor: () => void
  setTagline: (v: string) => void
}

export type SurfaceTab = 'quote' | 'invoice' | 'contract' | 'portal'

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
  blocks?: { quote: Block[]; invoice: Block[]; contract: Block[]; portal: Block[] }
  createdAt: string
}
