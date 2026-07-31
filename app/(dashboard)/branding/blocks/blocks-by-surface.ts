/**
 * Per-surface block availability, split into two palette groups: General blocks
 * (usable on every document) and Document-specific blocks (only on their own
 * document). Order within each group is expected frequency of use.
 *
 * @module app/(dashboard)/branding/blocks/blocks-by-surface
 */
import type { SurfaceTab } from '@/types/branding-preview'

import { isMarker } from './policy'
import type { BlockType } from './types'

/** General blocks, most-used first (spec §2.1). Available on every surface. */
export const GENERAL_BLOCKS: BlockType[] = [
  'text', 'divider', 'spacer', 'businessName', 'image', 'tagline', 'footer',
]

/** Document-specific blocks per surface (spec §2.2). */
export const DOC_SPECIFIC_BY_SURFACE: Record<SurfaceTab, BlockType[]> = {
  invoice: ['title', 'lineItems', 'totals', 'paymentSchedule', 'paymentDetails', 'action'],
  contract: ['title', 'contractBody', 'action'],
  portal: ['couplePortal'],
  vendorTimeline: ['vendorTimelineBody'],
  questionnaire: ['questionnaireBody'],
}

export interface PaletteGroup {
  label: 'General' | 'Document-specific'
  types: BlockType[]
}

/** Two labelled palette groups for a surface (General first).
 *
 * Render-split markers (contractBody, couplePortal, …) are excluded: they are
 * locked singletons that are always present, so they cannot be added or
 * removed and have no place in the "add block" palette. */
export function paletteGroupsForSurface(surface: SurfaceTab): PaletteGroup[] {
  return [
    { label: 'General', types: GENERAL_BLOCKS },
    {
      label: 'Document-specific',
      types: (DOC_SPECIFIC_BY_SURFACE[surface] ?? []).filter((t) => !isMarker(t)),
    },
  ]
}

/** Flat list of addable block types for a surface. */
export function blocksForSurface(surface: SurfaceTab): BlockType[] {
  return [...GENERAL_BLOCKS, ...(DOC_SPECIFIC_BY_SURFACE[surface] ?? [])]
}
