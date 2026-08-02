/**
 * Per-surface block availability, split into two palette groups: General blocks
 * (usable on every document) and Document-specific blocks (only on their own
 * document). Order within each group is expected frequency of use.
 *
 * @module app/(dashboard)/branding/blocks/blocks-by-surface
 */
import type { SurfaceTab } from '@/types/branding-preview'

import { CLEARABLE_MARKERS, isMarker } from './policy'
import type { BlockType } from './types'

/** General blocks, most-used first (spec §2.1). Available on every surface. */
export const GENERAL_BLOCKS: BlockType[] = [
  'text', 'divider', 'spacer', 'businessName', 'image', 'tagline', 'footer',
]

/** Document-specific blocks per surface (spec §2.2). */
export const DOC_SPECIFIC_BY_SURFACE: Record<SurfaceTab, BlockType[]> = {
  invoice: ['title', 'lineItems', 'totals', 'paymentSchedule', 'paymentDetails', 'action'],
  contract: ['title', 'contractBody', 'contractSign'],
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
 * Fixed render-split markers (the questionnaire body) are excluded: they are
 * locked singletons that are always present, so they cannot be added or removed
 * and have no place in the "add block" palette.
 *
 * The clearable markers (the contract body + sign form, the run sheet body, and
 * the couple portal body) DO appear, and stay listed even once inserted, so the
 * MC always sees the full set of document blocks. They are singletons, so the
 * editor's addBlock selects the existing one instead of inserting a duplicate
 * when it is already present.
 *
 * @param surface - The document surface.
 */
export function paletteGroupsForSurface(surface: SurfaceTab): PaletteGroup[] {
  const docSpecific = (DOC_SPECIFIC_BY_SURFACE[surface] ?? []).filter((t) => {
    if (!isMarker(t)) return true
    // Clearable markers stay in the palette permanently; other markers never
    // appear (their surface is nothing without them, so they can't be removed).
    return CLEARABLE_MARKERS.has(t)
  })
  return [
    { label: 'General', types: GENERAL_BLOCKS },
    { label: 'Document-specific', types: docSpecific },
  ]
}

/** Flat list of addable block types for a surface. */
export function blocksForSurface(surface: SurfaceTab): BlockType[] {
  return [...GENERAL_BLOCKS, ...(DOC_SPECIFIC_BY_SURFACE[surface] ?? [])]
}
