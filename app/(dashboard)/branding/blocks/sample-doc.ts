/**
 * Sample document data for branding editor preview.
 *
 * The editor previews lineItems, totals, and paymentDetails blocks using realistic
 * sample data that matches the shapes on public surfaces (quote/invoice/contract/portal).
 * This ensures the editor preview looks identical to what the couple sees.
 *
 * @module app/(dashboard)/branding/blocks/sample-doc.ts
 */

import type { PublicDocData } from '@/lib/branding/public-blocks/shared'
import type { SurfaceTab } from '@/types/branding-preview'

/**
 * Sample invoice document data.
 * Used for invoice and contract surfaces since they share the same line-item table.
 */
function sampleInvoiceDoc(): PublicDocData {
  return {
    title: 'Invoice',
    refNumber: 'INV-2024-001',
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] ?? '',
    items: [
      { id: 'i1', description: 'Full Day MC Services', amount: 2500 },
      { id: 'i2', description: 'Pre-Wedding Consultation', amount: 200 },
      { id: 'i3', description: 'Travel & Setup', amount: 180 },
    ],
    subtotal: 2880,
    taxRate: 10,
  }
}

/**
 * Sample contract document data.
 * Contracts typically don't have line items, but we provide the same shape for consistency.
 */
function sampleContractDoc(): PublicDocData {
  return {
    title: 'Wedding Services Agreement',
    refNumber: 'CONTRACT-2024-001',
    expiresAt: null,
    items: [],
    subtotal: 0,
    taxRate: 0,
  }
}

/**
 * Sample portal document data (minimal, since portal doesn't show line items).
 */
function samplePortalDoc(): PublicDocData {
  return {
    title: 'Couple Portal',
    refNumber: '',
    expiresAt: null,
    items: [],
    subtotal: 0,
    taxRate: 0,
  }
}

/**
 * Sample data for vendor timeline surface (minimal, since it renders live data).
 */
function sampleVendorTimelineDoc(): PublicDocData {
  return {
    title: 'Run Sheet',
    refNumber: '',
    expiresAt: null,
    items: [],
    subtotal: 0,
    taxRate: 0,
  }
}

/**
 * Sample data for questionnaire surface (minimal, since it renders fixed steps).
 */
function sampleQuestionnaireDoc(): PublicDocData {
  return {
    title: 'Questionnaire',
    refNumber: '',
    expiresAt: null,
    items: [],
    subtotal: 0,
    taxRate: 0,
  }
}

/**
 * Map of surface tabs to their sample document data.
 * Proposal surface doesn't include lineItems/totals/paymentDetails blocks, so no sample needed.
 */
export const SAMPLE_DOC_BY_SURFACE: Record<SurfaceTab, PublicDocData> = {
  invoice: sampleInvoiceDoc(),
  contract: sampleContractDoc(),
  proposal: sampleInvoiceDoc(), // Fallback (not used by proposal blocks)
  portal: samplePortalDoc(),
  vendorTimeline: sampleVendorTimelineDoc(),
  questionnaire: sampleQuestionnaireDoc(),
}
