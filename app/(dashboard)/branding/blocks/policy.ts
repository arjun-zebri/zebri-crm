/**
 * Block policy: which blocks are structural markers, which are required on
 * which surface, and which may be deleted. This is the single source of
 * truth consumed by the editor (delete/duplicate guards, lock chips), the
 * tree repairer (lib/branding/validate-blocks), and the palette.
 *
 * The product rule: users can restyle and rearrange freely, but cannot
 * delete the blocks that make a document function (an invoice must keep its
 * line items, totals, payment details, and payment schedule).
 *
 * @module app/(dashboard)/branding/blocks/policy
 */

import type { SurfaceTab } from '@/types/branding-preview'

import type { Block, BlockType } from './types'

/** Structural marker blocks: fixed cores that pages split/render around. */
export const MARKER_TYPES: ReadonlySet<BlockType> = new Set([
  'couplePortal', 'paymentSchedule', 'contractBody', 'proposalBody', 'vendorTimelineBody', 'questionnaireBody',
] as const)

/** Blocks whose content comes from live document data, not template text. */
const DATA_BOUND: ReadonlySet<BlockType> = new Set([
  'paymentSchedule', 'lineItems', 'totals',
] as const)

/** Non-marker blocks a surface cannot function without. */
export const REQUIRED_BY_SURFACE: Readonly<Record<string, readonly BlockType[]>> = {
  invoice: ['lineItems', 'totals', 'paymentDetails'],
}

/** True when the type is a fixed structural marker. */
export function isMarker(type: BlockType): boolean {
  return MARKER_TYPES.has(type)
}

/** True when the block's content is driven by live customer data. */
export function isDataBound(type: BlockType): boolean {
  return DATA_BOUND.has(type)
}

/** True when this block type must exist on the given surface. */
export function isRequired(type: BlockType, surface: SurfaceTab): boolean {
  if (isMarker(type)) return true
  return (REQUIRED_BY_SURFACE[surface] ?? []).includes(type)
}

/** True when the user may delete this block on this surface. */
export function isDeletable(block: Block, surface: SurfaceTab): boolean {
  if (block.locked) return false
  return !isRequired(block.type, surface)
}
