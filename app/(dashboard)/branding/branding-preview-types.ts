import type { HeadingFont, BodyFont, FontWeight } from '@/lib/branding/fonts'
import type { Density } from '@/lib/branding/themes'

export interface BrandPreviewState {
  logoUrl: string
  logoDarkUrl: string
  faviconUrl: string
  headerImageUrl: string
  brandColor: string
  accentColor: string
  surfaceColor: string
  textColor: string
  mutedColor: string
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

export const DENSITY_PADDING: Record<Density, { docX: string; docY: string; rowY: string; blockY: string }> = {
  compact: { docX: 'px-6',  docY: 'py-5', rowY: 'py-2', blockY: 'py-3' },
  cozy:    { docX: 'px-8',  docY: 'py-7', rowY: 'py-3', blockY: 'py-4' },
  roomy:   { docX: 'px-10', docY: 'py-9', rowY: 'py-4', blockY: 'py-5' },
}

export interface BrandKit {
  id: string
  name: string
  brandColor: string
  accentColor: string
  surfaceColor: string
  textColor: string
  mutedColor: string
  fontHeading: HeadingFont
  fontBody: BodyFont
  fontWeight: FontWeight
  fontBodyWeight: FontWeight
  fontScale: number
  density: Density
  cornerRadius: number
  logoUrl?: string
  logoDarkUrl?: string
  faviconUrl?: string
  headerImageUrl?: string
  createdAt: string
}
