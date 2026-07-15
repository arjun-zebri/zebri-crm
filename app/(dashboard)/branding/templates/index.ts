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
import type { Block, TextBlock, ActionBlock, FooterBlock, TitleBlock } from '../blocks/types'

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

/**
 * Build the wedding proposal template layout.
 *
 * Includes: header banner, business name, proposal body (fixed marker),
 * action block (Accept & reserve), and footer.
 */
function buildWeddingProposalTemplate(): Block[] {
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
 * Build the deposit invoice template layout.
 *
 * Includes: header banner, business name, title, line items, totals,
 * payment schedule (fixed marker), payment details, action (Pay deposit),
 * and footer.
 */
function buildDepositInvoiceTemplate(): Block[] {
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
    } as TitleBlock,
    blockTemplate('lineItems'),
    blockTemplate('totals'),
    blockTemplate('paymentSchedule'),
    {
      ...blockTemplate('text'),
      text: 'Payment due within 7 days. Pay by card or bank transfer.',
    } as TextBlock,
    blockTemplate('paymentDetails'),
    {
      ...blockTemplate('action'),
      primary: 'Pay deposit',
      secondary: null,
    } as ActionBlock,
    {
      ...blockTemplate('footer'),
      closingNote: 'Questions? Reply any time and we will sort it.',
    } as FooterBlock,
  ]
}

/**
 * Build the standard e-sign contract template layout.
 *
 * Includes: header banner, business name, title, contract body (fixed marker),
 * action block (Review & sign), and footer.
 */
function buildEsignContractTemplate(): Block[] {
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
 * Build the couple portal template layout.
 *
 * Includes: header banner, business name, couple portal block (fixed marker),
 * and footer.
 */
function buildCouplePortalTemplate(): Block[] {
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
 * All available templates, keyed by surface.
 */
export const TEMPLATES: DocTemplate[] = [
  {
    id: 'wedding-proposal',
    name: 'Wedding Proposal',
    description: 'Service proposal with acceptance prompt',
    surface: 'proposal',
    build: buildWeddingProposalTemplate,
  },
  {
    id: 'deposit-invoice',
    name: 'Deposit Invoice',
    description: 'Payment invoice with line items and deposit button',
    surface: 'invoice',
    build: buildDepositInvoiceTemplate,
  },
  {
    id: 'esign-contract',
    name: 'E-Sign Contract',
    description: 'Service contract with signature block',
    surface: 'contract',
    build: buildEsignContractTemplate,
  },
  {
    id: 'couple-portal',
    name: 'Couple Portal',
    description: 'Timeline, contacts, and payments hub',
    surface: 'portal',
    build: buildCouplePortalTemplate,
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
