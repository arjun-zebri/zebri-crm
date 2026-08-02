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
  contract: ['title', 'contractBody'],
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
 * locked singletons that are always present, so they normally cannot be added
 * or removed and have no place in the "add block" palette.
 *
 * The one exception is the contract body: it is clearable via "Clear all
 * blocks", so when it is absent from the tree it must be re-addable. Pass the
 * block types currently present (`presentTypes`) and a missing `contractBody`
 * is surfaced in the Document-specific group; when present it is hidden again.
 *
 * @param surface - The document surface.
 * @param presentTypes - Block types currently in the tree (defaults to none).
 */
export function paletteGroupsForSurface(
  surface: SurfaceTab,
  presentTypes: readonly BlockType[] = [],
): PaletteGroup[] {
  const present = new Set(presentTypes)
  const docSpecific = (DOC_SPECIFIC_BY_SURFACE[surface] ?? []).filter((t) => {
    if (!isMarker(t)) return true
    // A cleared contract body is the only marker allowed back into the palette,
    // and only while it is missing (so we never offer a duplicate singleton).
    return t === 'contractBody' && !present.has('contractBody')
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
