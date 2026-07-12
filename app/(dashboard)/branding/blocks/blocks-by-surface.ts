/**
 * Per-surface block availability map.
 *
 * Defines which block types are addable (non-fixed) on each document surface.
 * Fixed marker blocks (proposalBody, paymentSchedule, contractBody, couplePortal)
 * are seeded by defaults and not included in this map.
 *
 * @module app/(dashboard)/branding/blocks/blocks-by-surface
 */

import type { SurfaceTab } from '@/types/branding-preview'

import type { BlockType } from './types'

/**
 * Maps each surface to its set of addable block types.
 *
 * - **proposal**: Structure, content, and actions for a service proposal.
 * - **invoice**: Payment document with line items, totals, and payment details.
 * - **contract**: E-signature document with title and content sections.
 * - **portal**: Couple-facing portal display (structural only, no actions).
 */
export const BLOCKS_BY_SURFACE: Record<SurfaceTab, BlockType[]> = {
  proposal: [
    'headerBanner',
    'businessName',
    'tagline',
    'text',
    'divider',
    'footer',
    'action',
  ],
  invoice: [
    'headerBanner',
    'businessName',
    'tagline',
    'text',
    'divider',
    'footer',
    'title',
    'lineItems',
    'totals',
    'paymentDetails',
    'action',
  ],
  contract: [
    'headerBanner',
    'businessName',
    'tagline',
    'text',
    'divider',
    'footer',
    'title',
    'action',
  ],
  portal: [
    'headerBanner',
    'businessName',
    'tagline',
    'text',
    'divider',
    'footer',
  ],
}

/**
 * Returns the set of addable block types for a given surface.
 *
 * @param surface - The document surface ('proposal', 'invoice', 'contract', or 'portal').
 * @returns Array of BlockType values that can be added on this surface.
 *
 * @example
 * const blocks = blocksForSurface('invoice')
 * // returns ['headerBanner', 'businessName', ..., 'paymentDetails', 'action']
 */
export function blocksForSurface(surface: SurfaceTab): BlockType[] {
  return BLOCKS_BY_SURFACE[surface] ?? []
}
