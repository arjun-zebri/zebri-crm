/**
 * Branding preview-state types.
 *
 * The editable brand-kit shape (fonts, density, colour, block tree) that
 * drives the branding editor and the public-surface preview. The block AST
 * itself stays co-located with its renderers in branding/blocks.
 *
 * @module types/branding-preview
 */

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import type { HeadingFont, BodyFont, FontWeight } from '@/lib/branding/fonts'
import type { TextCase } from '@/lib/branding/text-case'
import type { Density } from '@/lib/branding/themes'

export interface BrandPreviewState {
  logoUrl: string
  faviconUrl: string
  headerImageUrl: string
  brandColor: string
  headingColor: string
  subheadingColor: string
  surfaceColor: string
  textColor: string
  secondaryColor: string
  borderColor: string
  tagline: string
  footerText: string
  abn: string
  showContactOnDocuments: boolean
  fontHeading: HeadingFont
  fontBody: BodyFont
  fontWeight: FontWeight
  fontBodyWeight: FontWeight
  density: Density
  cornerRadius: number
  docPadding: number
  /**
   * Global type scale and style fields.
   *
   * These drive roleDefaults() in every renderer, so the canvas cannot show a
   * faithful preview without them. They were previously absent here, which
   * left publicBrandingFromEditorState with nothing to read and hardcoded
   * literals in their place: the Typography and Global styles controls
   * changed the saved document but never the preview.
   */
  headingSize: number
  bodySize: number
  headingCase: TextCase
  bodyCase: TextCase
  /** Subheading (section-label) type controls — size, weight, case. */
  subheadingSize: number
  subheadingWeight: FontWeight
  subheadingCase: TextCase
  headingLetterSpacing: number
  bodyLineHeight: number
  linkColor: string
  buttonVariant: 'fill' | 'outline'
  buttonSize: 'sm' | 'md' | 'lg'
  buttonRadius: number
  sectionSpacing: number
  businessName: string
  phone: string
  website: string
  instagramUrl: string
  facebookUrl: string
  twitterUrl: string
  pinterestUrl: string
  /** Bank-transfer details from Settings → Payments. Read-only in the branding
   *  editor; drive the paymentDetails block (real value when set, else a mint
   *  placeholder). */
  bankAccountName: string
  bankBsb: string
  bankAccountNumber: string
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

export type SurfaceTab = 'invoice' | 'contract' | 'portal' | 'vendorTimeline' | 'questionnaire'

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
  headingColor: string
  subheadingColor: string
  surfaceColor: string
  textColor: string
  secondaryColor: string
  borderColor: string
  fontHeading: HeadingFont
  fontBody: BodyFont
  fontWeight: FontWeight
  fontBodyWeight: FontWeight
  density: Density
  cornerRadius: number
  docPadding?: number
  tagline?: string
  logoUrl?: string
  faviconUrl?: string
  headerImageUrl?: string
  /** Per-surface block trees. */
  blocks?: {
    invoice: Block[]
    contract: Block[]
    portal: Block[]
    vendorTimeline?: Block[]
    questionnaire?: Block[]
  }
  createdAt: string
}
