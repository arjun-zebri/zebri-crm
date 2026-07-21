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
import type { ProposalLabels } from '@/lib/branding/proposal-labels'
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
  /** Which couple-portal sections are enabled. Drives the couplePortal block preview. */
  portalSections?: {
    timeline: boolean
    contacts: boolean
    payments: boolean
    contracts: boolean
    songs: boolean
    files: boolean
  }
  /** Editable proposal section wording — drives the proposalBody block. */
  proposalLabels?: ProposalLabels
  /** Preview-only: show the proposalBody core with one package (no
   *  chooser) or several (with chooser). Not persisted. */
  proposalPreviewMode?: 'single' | 'multi'
  /** Preview-only: show the questionnaireBody sample in form or typeform mode.
   *  Not persisted. */
  questionnairePreviewMode?: 'form' | 'typeform'
}

export interface BrandPreviewActions {
  onEditLogo: () => void
  onEditHeader: () => void
  onEditColor: () => void
  setTagline: (v: string) => void
}

export type SurfaceTab = 'proposal' | 'invoice' | 'contract' | 'portal' | 'vendorTimeline' | 'questionnaire'

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
  /** Per-surface block trees. `quote` is the LEGACY key from before
   *  the proposals rollout — kits saved earlier still carry it; the
   *  editor normalises it into `proposal` on apply. */
  blocks?: {
    proposal?: Block[]
    quote?: Block[]
    invoice: Block[]
    contract: Block[]
    portal: Block[]
    vendorTimeline?: Block[]
    questionnaire?: Block[]
  }
  createdAt: string
}
