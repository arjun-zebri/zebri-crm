/**
 * Functional document templates — one-click starting layouts per surface.
 *
 * Each template provides a pre-arranged block tree (banner, business name,
 * content, action, footer, etc.) configured for a specific document surface
 * (proposal, invoice, contract, portal). Applying a template replaces that
 * surface's block layout only; it does NOT touch global brand tokens or other
 * surfaces. Templates use `blockTemplate()` to generate fresh blocks with
 * unique ids, so applying the same template twice yields distinct trees.
 *
 * @module app/(dashboard)/branding/templates
 */

import type { SurfaceTab } from '@/types/branding-preview'

import { blockTemplate } from '../blocks/defaults'
import type { Block, TextBlock, ActionBlock, FooterBlock, TitleBlock, DividerBlock, BusinessNameBlock, HeaderBannerBlock, TextStyle } from '../blocks/types'

/**
 * A functional document template — a pre-designed block layout for one surface.
 */
export interface DocTemplate {
  /** Unique identifier. */
  id: string
  /** Display name shown in the template picker. */
  name: string
  /** One-line description shown under the card. */
  description: string
  /** Which document surface this template applies to. */
  surface: SurfaceTab
  /** Returns a fresh block tree for this template's surface.
   *  Each call generates new unique block ids. */
  build: () => Block[]
}

// ── TextStyle constants for templates ──────────────────────────────────────

const HERO_SUBTITLE: TextStyle = {
  fontSize: 12,
  color: '#9CA3AF',
  letterSpacing: 0.08,
  lineHeight: 1.4,
}

const FORMAL_TITLE: TextStyle = {
  fontSize: 38,
  fontWeight: 500 as const,
  letterSpacing: -0.015,
  lineHeight: 1.1,
}

const BOLD_TITLE: TextStyle = {
  fontSize: 44,
  fontWeight: 600 as const,
  letterSpacing: -0.02,
  lineHeight: 1.0,
}

const EMPHASIZED_TOTAL: TextStyle = {
  fontSize: 22,
  fontWeight: 700 as const,
  letterSpacing: -0.01,
}

const SOFT_MESSAGE: TextStyle = {
  fontSize: 13,
  lineHeight: 1.7,
  color: '#4B5563',
}

const SLIM_DIVIDER = { thickness: 1, color: '#F3F4F6', widthPct: 32 } as const

// ── Proposal Templates ────────────────────────────────────────────────────

/**
 * Build the proposal classic template layout.
 *
 * Includes: header banner, business name, proposal body (fixed marker),
 * action block (Accept & reserve), and footer.
 */
function buildProposalClassic(): Block[] {
  return [
    blockTemplate('headerBanner'),
    blockTemplate('businessName'),
    {
      ...blockTemplate('text'),
      text: 'We are delighted to have the opportunity to be part of your wedding day.',
    } as TextBlock,
    blockTemplate('proposalBody'),
    {
      ...blockTemplate('action'),
      primary: 'Accept & reserve our date',
      secondary: 'Decline',
    } as ActionBlock,
    {
      ...blockTemplate('footer'),
      closingNote: 'Thank you for thinking of us.',
    } as FooterBlock,
  ]
}

/**
 * Build the proposal minimal template layout.
 *
 * Includes: business name (name layout), slim divider, quiet welcome text,
 * proposal body, action, footer (contact only).
 */
function buildProposalMinimal(): Block[] {
  return [
    {
      ...blockTemplate('businessName'),
      layout: 'name',
    } as BusinessNameBlock,
    {
      ...blockTemplate('divider'),
      ...SLIM_DIVIDER,
    } as DividerBlock,
    {
      ...blockTemplate('text'),
      text: 'We are delighted to have the opportunity to be part of your wedding day.',
      textStyle: SOFT_MESSAGE,
    } as TextBlock,
    blockTemplate('proposalBody'),
    {
      ...blockTemplate('action'),
      primary: 'Accept & reserve our date',
      secondary: 'Decline',
    } as ActionBlock,
    {
      ...blockTemplate('footer'),
      closingNote: null,
    } as unknown as Block,
  ]
}

/**
 * Build the proposal bold template layout.
 *
 * Includes: large header banner with overlay, stacked business name,
 * proposal body, prominent action, footer with closing note.
 */
function buildProposalBold(): Block[] {
  return [
    {
      ...blockTemplate('headerBanner'),
      height: 'lg',
      overlayColor: '#000000',
      overlayOpacity: 0.25,
    } as HeaderBannerBlock,
    {
      ...blockTemplate('businessName'),
      layout: 'stacked',
    } as BusinessNameBlock,
    {
      ...blockTemplate('text'),
      text: 'Join us on your special day.',
      textStyle: SOFT_MESSAGE,
    } as TextBlock,
    blockTemplate('proposalBody'),
    {
      ...blockTemplate('action'),
      primary: 'Accept & reserve our date',
      secondary: 'Decline',
      variant: 'fill',
      size: 'lg',
    } as ActionBlock,
    {
      ...blockTemplate('footer'),
      closingNote: 'Looking forward to celebrating with you.',
    } as FooterBlock,
  ]
}

// ── Invoice Templates ────────────────────────────────────────────────────

/**
 * Build the invoice classic template layout.
 *
 * Includes: header banner, business name, title, line items, totals,
 * payment schedule marker, payment details, action (Pay deposit), footer.
 */
function buildInvoiceClassic(): Block[] {
  return [
    blockTemplate('headerBanner'),
    blockTemplate('businessName'),
    {
      ...blockTemplate('title'),
      title: 'Invoice',
      subtitle: 'Couple name · Wedding date',
      showRef: true,
      showExpires: true,
      showAbn: true,
      titleStyle: FORMAL_TITLE,
      subtitleStyle: HERO_SUBTITLE,
    } as TitleBlock,
    blockTemplate('lineItems'),
    {
      ...blockTemplate('totals'),
      taxRate: 10,
      showSubtotal: true,
      colSpread: true,
      totalStyle: EMPHASIZED_TOTAL,
    } as Block,
    blockTemplate('paymentSchedule'),
    {
      ...blockTemplate('text'),
      text: 'Payment due within 14 days. Pay by card or by bank transfer using the details below.',
      textStyle: SOFT_MESSAGE,
    } as TextBlock,
    blockTemplate('paymentDetails'),
    {
      ...blockTemplate('action'),
      primary: 'Pay with card',
      secondary: null,
    } as ActionBlock,
    {
      ...blockTemplate('footer'),
      closingNote: 'Questions? Reply any time and we will sort it.',
    } as unknown as Block,
  ]
}

/**
 * Build the invoice minimal template layout.
 *
 * Includes: business name (name layout), slim divider, line items, totals,
 * payment schedule marker, quiet payment note, payment details, action, footer (contact only).
 */
function buildInvoiceMinimal(): Block[] {
  return [
    {
      ...blockTemplate('businessName'),
      layout: 'name',
    } as BusinessNameBlock,
    {
      ...blockTemplate('divider'),
      ...SLIM_DIVIDER,
    } as DividerBlock,
    blockTemplate('lineItems'),
    {
      ...blockTemplate('totals'),
      taxRate: 10,
      showSubtotal: true,
      colSpread: true,
    } as Block,
    blockTemplate('paymentSchedule'),
    {
      ...blockTemplate('text'),
      text: 'Payment due within 14 days. Pay by card or by bank transfer.',
      textStyle: SOFT_MESSAGE,
    } as TextBlock,
    blockTemplate('paymentDetails'),
    {
      ...blockTemplate('action'),
      primary: 'Pay with card',
      secondary: null,
    } as ActionBlock,
    {
      ...blockTemplate('footer'),
      closingNote: null,
    } as unknown as Block,
  ]
}

/**
 * Build the invoice bold template layout.
 *
 * Includes: large header banner with overlay, stacked business name, bold title,
 * line items, totals, payment schedule marker, payment details, prominent action, footer.
 */
function buildInvoiceBold(): Block[] {
  return [
    {
      ...blockTemplate('headerBanner'),
      height: 'lg',
      overlayColor: '#000000',
      overlayOpacity: 0.25,
    } as HeaderBannerBlock,
    {
      ...blockTemplate('businessName'),
      layout: 'stacked',
    } as BusinessNameBlock,
    {
      ...blockTemplate('title'),
      title: 'Invoice',
      subtitle: 'Couple name · Wedding date',
      showRef: true,
      showExpires: true,
      showAbn: true,
      titleStyle: BOLD_TITLE,
      subtitleStyle: HERO_SUBTITLE,
    } as TitleBlock,
    blockTemplate('lineItems'),
    {
      ...blockTemplate('totals'),
      taxRate: 10,
      showSubtotal: true,
      colSpread: true,
      totalStyle: EMPHASIZED_TOTAL,
    } as Block,
    blockTemplate('paymentSchedule'),
    {
      ...blockTemplate('text'),
      text: 'Payment due within 14 days. Pay by card or by bank transfer using the details below.',
      textStyle: SOFT_MESSAGE,
    } as TextBlock,
    blockTemplate('paymentDetails'),
    {
      ...blockTemplate('action'),
      primary: 'Pay with card',
      secondary: null,
      variant: 'fill',
      size: 'lg',
    } as ActionBlock,
    {
      ...blockTemplate('footer'),
      closingNote: 'Thank you for your business.',
    } as unknown as Block,
  ]
}

// ── Contract Templates ────────────────────────────────────────────────────

/**
 * Build the contract classic template layout.
 *
 * Includes: header banner, business name, title, contract body marker,
 * action (Review & sign), footer.
 */
function buildContractClassic(): Block[] {
  return [
    blockTemplate('headerBanner'),
    blockTemplate('businessName'),
    {
      ...blockTemplate('title'),
      title: 'Service Contract',
      subtitle: 'Couple name · Wedding date',
      showRef: true,
      showExpires: false,
      showAbn: false,
      titleStyle: FORMAL_TITLE,
      subtitleStyle: HERO_SUBTITLE,
    } as TitleBlock,
    blockTemplate('contractBody'),
    {
      ...blockTemplate('action'),
      primary: 'Review & sign',
      secondary: null,
    } as ActionBlock,
    {
      ...blockTemplate('footer'),
      closingNote: 'We look forward to making your day perfect.',
    } as FooterBlock,
  ]
}

/**
 * Build the contract minimal template layout.
 *
 * Includes: business name (name layout), slim divider, contract body marker,
 * action, footer (contact only).
 */
function buildContractMinimal(): Block[] {
  return [
    {
      ...blockTemplate('businessName'),
      layout: 'name',
    } as BusinessNameBlock,
    {
      ...blockTemplate('divider'),
      ...SLIM_DIVIDER,
    } as DividerBlock,
    blockTemplate('contractBody'),
    {
      ...blockTemplate('action'),
      primary: 'Review & sign',
      secondary: null,
    } as ActionBlock,
    {
      ...blockTemplate('footer'),
      closingNote: null,
    } as unknown as Block,
  ]
}

/**
 * Build the contract bold template layout.
 *
 * Includes: large header banner with overlay, stacked business name, bold title,
 * contract body marker, prominent action, footer with closing note.
 */
function buildContractBold(): Block[] {
  return [
    {
      ...blockTemplate('headerBanner'),
      height: 'lg',
      overlayColor: '#000000',
      overlayOpacity: 0.25,
    } as HeaderBannerBlock,
    {
      ...blockTemplate('businessName'),
      layout: 'stacked',
    } as BusinessNameBlock,
    {
      ...blockTemplate('title'),
      title: 'Service Contract',
      subtitle: 'Couple name · Wedding date',
      showRef: true,
      showExpires: false,
      showAbn: false,
      titleStyle: BOLD_TITLE,
      subtitleStyle: HERO_SUBTITLE,
    } as TitleBlock,
    blockTemplate('contractBody'),
    {
      ...blockTemplate('action'),
      primary: 'Review & sign',
      secondary: null,
      variant: 'fill',
      size: 'lg',
    } as ActionBlock,
    {
      ...blockTemplate('footer'),
      closingNote: 'We look forward to making your day perfect.',
    } as FooterBlock,
  ]
}

// ── Portal Templates ──────────────────────────────────────────────────────

/**
 * Build the couple portal classic template layout.
 *
 * Includes: header banner, business name, couple portal marker, footer.
 */
function buildPortalClassic(): Block[] {
  return [
    blockTemplate('headerBanner'),
    blockTemplate('businessName'),
    blockTemplate('couplePortal'),
    {
      ...blockTemplate('footer'),
      closingNote: 'Questions? We are here to help.',
    } as FooterBlock,
  ]
}

/**
 * Build the couple portal minimal template layout.
 *
 * Includes: business name (name layout), slim divider, couple portal marker,
 * footer (contact only).
 */
function buildPortalMinimal(): Block[] {
  return [
    {
      ...blockTemplate('businessName'),
      layout: 'name',
    } as BusinessNameBlock,
    {
      ...blockTemplate('divider'),
      ...SLIM_DIVIDER,
    } as DividerBlock,
    blockTemplate('couplePortal'),
    {
      ...blockTemplate('footer'),
      closingNote: null,
    } as unknown as Block,
  ]
}

/**
 * Build the couple portal bold template layout.
 *
 * Includes: large header banner with overlay, stacked business name,
 * couple portal marker, footer with closing note.
 */
function buildPortalBold(): Block[] {
  return [
    {
      ...blockTemplate('headerBanner'),
      height: 'lg',
      overlayColor: '#000000',
      overlayOpacity: 0.25,
    } as HeaderBannerBlock,
    {
      ...blockTemplate('businessName'),
      layout: 'stacked',
    } as BusinessNameBlock,
    blockTemplate('couplePortal'),
    {
      ...blockTemplate('footer'),
      closingNote: 'We are here to help whenever you need us.',
    } as FooterBlock,
  ]
}

// ── Vendor Timeline Templates ────────────────────────────────────────────

/**
 * Build the vendor timeline classic template layout.
 *
 * Includes: header banner, business name, vendor timeline body marker, footer.
 */
function buildVendorTimelineClassic(): Block[] {
  return [
    blockTemplate('headerBanner'),
    blockTemplate('businessName'),
    blockTemplate('vendorTimelineBody'),
    {
      ...blockTemplate('footer'),
      closingNote: 'Thank you for being part of their day.',
    } as FooterBlock,
  ]
}

/**
 * Build the vendor timeline minimal template layout.
 *
 * Includes: business name (name layout), slim divider, vendor timeline body marker,
 * footer (contact only).
 */
function buildVendorTimelineMinimal(): Block[] {
  return [
    {
      ...blockTemplate('businessName'),
      layout: 'name',
    } as BusinessNameBlock,
    {
      ...blockTemplate('divider'),
      ...SLIM_DIVIDER,
    } as DividerBlock,
    blockTemplate('vendorTimelineBody'),
    {
      ...blockTemplate('footer'),
      closingNote: null,
    } as unknown as Block,
  ]
}

/**
 * Build the vendor timeline bold template layout.
 *
 * Includes: large header banner with overlay, stacked business name,
 * vendor timeline body marker, footer with closing note.
 */
function buildVendorTimelineBold(): Block[] {
  return [
    {
      ...blockTemplate('headerBanner'),
      height: 'lg',
      overlayColor: '#000000',
      overlayOpacity: 0.25,
    } as HeaderBannerBlock,
    {
      ...blockTemplate('businessName'),
      layout: 'stacked',
    } as BusinessNameBlock,
    blockTemplate('vendorTimelineBody'),
    {
      ...blockTemplate('footer'),
      closingNote: 'Thank you for being part of their special day.',
    } as FooterBlock,
  ]
}

// ── Questionnaire Templates ──────────────────────────────────────────────

/**
 * Build the questionnaire classic template layout.
 *
 * Includes: business name, questionnaire body marker, footer.
 */
function buildQuestionnaireClassic(): Block[] {
  return [
    blockTemplate('businessName'),
    blockTemplate('questionnaireBody'),
    {
      ...blockTemplate('footer'),
      closingNote: 'Thank you for your thoughtful responses.',
    } as FooterBlock,
  ]
}

/**
 * Build the questionnaire minimal template layout.
 *
 * Includes: business name (name layout), slim divider, questionnaire body marker,
 * footer (contact only).
 */
function buildQuestionnaireMinimal(): Block[] {
  return [
    {
      ...blockTemplate('businessName'),
      layout: 'name',
    } as BusinessNameBlock,
    {
      ...blockTemplate('divider'),
      ...SLIM_DIVIDER,
    } as DividerBlock,
    blockTemplate('questionnaireBody'),
    {
      ...blockTemplate('footer'),
      closingNote: null,
    } as unknown as Block,
  ]
}

/**
 * Build the questionnaire bold template layout.
 *
 * Includes: stacked business name, questionnaire body marker, footer with closing note.
 */
function buildQuestionnaireBold(): Block[] {
  return [
    {
      ...blockTemplate('businessName'),
      layout: 'stacked',
    } as BusinessNameBlock,
    blockTemplate('questionnaireBody'),
    {
      ...blockTemplate('footer'),
      closingNote: 'Thank you for taking the time to share your vision with us.',
    } as FooterBlock,
  ]
}


/**
 * All available templates, keyed by surface. Each surface has three variants:
 * classic (traditional with header banner), minimal (name only, quiet), and bold (prominent header).
 */
export const TEMPLATES: DocTemplate[] = [
  // Proposal
  {
    id: 'proposal-classic',
    name: 'Classic',
    description: 'Traditional layout with header banner',
    surface: 'proposal',
    build: buildProposalClassic,
  },
  {
    id: 'proposal-minimal',
    name: 'Minimal',
    description: 'Clean and understated',
    surface: 'proposal',
    build: buildProposalMinimal,
  },
  {
    id: 'proposal-bold',
    name: 'Bold',
    description: 'Eye catching with prominent header',
    surface: 'proposal',
    build: buildProposalBold,
  },

  // Invoice
  {
    id: 'invoice-classic',
    name: 'Classic',
    description: 'Traditional layout with header banner',
    surface: 'invoice',
    build: buildInvoiceClassic,
  },
  {
    id: 'invoice-minimal',
    name: 'Minimal',
    description: 'Clean and understated',
    surface: 'invoice',
    build: buildInvoiceMinimal,
  },
  {
    id: 'invoice-bold',
    name: 'Bold',
    description: 'Eye catching with prominent header',
    surface: 'invoice',
    build: buildInvoiceBold,
  },

  // Contract
  {
    id: 'contract-classic',
    name: 'Classic',
    description: 'Traditional layout with header banner',
    surface: 'contract',
    build: buildContractClassic,
  },
  {
    id: 'contract-minimal',
    name: 'Minimal',
    description: 'Clean and understated',
    surface: 'contract',
    build: buildContractMinimal,
  },
  {
    id: 'contract-bold',
    name: 'Bold',
    description: 'Eye catching with prominent header',
    surface: 'contract',
    build: buildContractBold,
  },

  // Portal
  {
    id: 'portal-classic',
    name: 'Classic',
    description: 'Traditional layout with header banner',
    surface: 'portal',
    build: buildPortalClassic,
  },
  {
    id: 'portal-minimal',
    name: 'Minimal',
    description: 'Clean and understated',
    surface: 'portal',
    build: buildPortalMinimal,
  },
  {
    id: 'portal-bold',
    name: 'Bold',
    description: 'Eye catching with prominent header',
    surface: 'portal',
    build: buildPortalBold,
  },

  // Vendor Timeline
  {
    id: 'vendorTimeline-classic',
    name: 'Classic',
    description: 'Traditional layout with header banner',
    surface: 'vendorTimeline',
    build: buildVendorTimelineClassic,
  },
  {
    id: 'vendorTimeline-minimal',
    name: 'Minimal',
    description: 'Clean and understated',
    surface: 'vendorTimeline',
    build: buildVendorTimelineMinimal,
  },
  {
    id: 'vendorTimeline-bold',
    name: 'Bold',
    description: 'Eye catching with prominent header',
    surface: 'vendorTimeline',
    build: buildVendorTimelineBold,
  },

  // Questionnaire
  {
    id: 'questionnaire-classic',
    name: 'Classic',
    description: 'Traditional layout with business name',
    surface: 'questionnaire',
    build: buildQuestionnaireClassic,
  },
  {
    id: 'questionnaire-minimal',
    name: 'Minimal',
    description: 'Clean and understated',
    surface: 'questionnaire',
    build: buildQuestionnaireMinimal,
  },
  {
    id: 'questionnaire-bold',
    name: 'Bold',
    description: 'Eye catching and confident',
    surface: 'questionnaire',
    build: buildQuestionnaireBold,
  },
]

/**
 * Returns templates that apply to a given surface.
 *
 * @param surface - The document surface ('proposal', 'invoice', 'contract', or 'portal').
 * @returns Array of templates matching that surface.
 *
 * @example
 * const proposalTemplates = templatesForSurface('proposal')
 */
export function templatesForSurface(surface: SurfaceTab): DocTemplate[] {
  return TEMPLATES.filter((t) => t.surface === surface)
}
