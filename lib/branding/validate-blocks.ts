/**
 * Block tree repair: ensures block trees contain all required blocks,
 * dedup markers, and drop unknown types. Idempotent: safe to run on
 * every load and save.
 *
 * The product rule: users can restyle and rearrange, but cannot delete
 * structural markers or required blocks (a payment schedule must keep
 * line items, totals, payment details, and the marker).
 *
 * @module lib/branding/validate-blocks
 */

// The block defaults + type helpers live under app/(dashboard)/branding/
// because they're consumed primarily by the editor surface there.
// This module is the one acceptable bridge that pulls them into a lib-level
// data helper. Layering exception noted in `.claude/docs/component-library.md`.
// eslint-disable-next-line no-restricted-imports
import { blockTemplate } from '@/app/(dashboard)/branding/blocks/defaults'
// eslint-disable-next-line no-restricted-imports
import {
  isMarker, isRequired,
  MARKER_TYPES,
  REQUIRED_BY_SURFACE,
} from '@/app/(dashboard)/branding/blocks/policy'
// eslint-disable-next-line no-restricted-imports
import { BLOCK_LABELS } from '@/app/(dashboard)/branding/blocks/types'
// eslint-disable-next-line no-restricted-imports
import type { Block, BlockType } from '@/app/(dashboard)/branding/blocks/types'
import type { SurfaceTab } from '@/types/branding-preview'

/**
 * Repair a block tree for a specific surface. Guarantees:
 * - Exactly one of each marker the surface needs
 * - All required blocks present (re-inserted at standard positions if missing)
 * - Unknown block types dropped
 * - Idempotent: running twice produces the same result
 *
 * Insertion positions:
 * - Marker: after first `businessName`, else after `headerBanner`, else index 0
 * - Invoice `lineItems`/`totals`: immediately after the marker (lineItems first)
 * - Invoice `paymentDetails`: before first `action`, else end of tree
 *
 * @param surface - The surface being rendered (proposal/invoice/contract/portal)
 * @param blocks - Block tree, or null/undefined if no custom tree exists
 * @returns Repaired block tree with all required blocks present and no duplicates
 */
export function repairBlocks(surface: SurfaceTab, blocks: Block[] | null | undefined): Block[] {
  // Handle null/undefined inputs by starting with an empty tree.
  if (!blocks) blocks = []

  // Step 1: Validate and filter out unknown types. Validate against
  // the set of all known block types (the keys of BLOCK_LABELS).
  const validTypes = new Set(Object.keys(BLOCK_LABELS) as BlockType[])
  let filtered = blocks.filter((b) => validTypes.has(b.type))

  // Step 2: Deduplicate markers. For each marker the surface needs,
  // keep only the first occurrence.
  const markerForSurface = getMarkerForSurface(surface)
  if (markerForSurface) {
    const firstMarkerIdx = filtered.findIndex((b) => b.type === markerForSurface)
    if (firstMarkerIdx >= 0) {
      filtered = [
        ...filtered.slice(0, firstMarkerIdx + 1),
        ...filtered.slice(firstMarkerIdx + 1).filter((b) => b.type !== markerForSurface),
      ]
    }
  }

  // Step 3: Ensure all required blocks are present. Build a set of
  // required types for this surface.
  const required = new Set<BlockType>()

  // The marker is always required for its surface.
  if (markerForSurface) required.add(markerForSurface)

  // Non-marker required blocks come from the policy.
  const nonMarkerRequired = REQUIRED_BY_SURFACE[surface] ?? []
  for (const type of nonMarkerRequired) {
    required.add(type as BlockType)
  }

  // For each missing required block, insert it at the correct position.
  // For invoices, process in document order (lineItems before totals) to
  // avoid misordering when both are missing.
  let result = [...filtered]
  const requiredArray = Array.from(required)
  if (surface === 'invoice') {
    requiredArray.sort((a, b) => {
      const order = ['paymentSchedule', 'lineItems', 'totals', 'paymentDetails']
      const aIdx = order.indexOf(a)
      const bIdx = order.indexOf(b)
      if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx
      if (aIdx >= 0) return -1
      if (bIdx >= 0) return 1
      return 0
    })
  }

  for (const type of requiredArray) {
    const exists = result.some((b) => b.type === type)
    if (!exists) {
      const insertPos = getInsertionPosition(result, surface, type)
      const newBlock = blockTemplate(type) as Block
      result.splice(insertPos, 0, newBlock)
    }
  }

  return result
}

/**
 * Return the marker type for the given surface, or null if there is none.
 */
function getMarkerForSurface(surface: SurfaceTab): BlockType | null {
  switch (surface) {
    case 'proposal':
      return 'proposalBody'
    case 'invoice':
      return 'paymentSchedule'
    case 'contract':
      return 'contractBody'
    case 'portal':
      return 'couplePortal'
    default:
      return null
  }
}

/**
 * Determine where to insert a missing required block of the given type
 * into the result tree.
 *
 * Rules:
 * - Marker: after first `businessName`, else after `headerBanner`, else index 0
 * - invoice lineItems/totals: immediately after the marker (lineItems first)
 * - invoice paymentDetails: before first `action`, else at end
 * - Other types: at end
 */
function getInsertionPosition(blocks: Block[], surface: SurfaceTab, type: BlockType): number {
  const markerForSurface = getMarkerForSurface(surface)

  // Marker insertion rule.
  if (type === markerForSurface) {
    const businessIdx = blocks.findIndex((b) => b.type === 'businessName')
    if (businessIdx >= 0) return businessIdx + 1

    const headerIdx = blocks.findIndex((b) => b.type === 'headerBanner')
    if (headerIdx >= 0) return headerIdx + 1

    return 0
  }

  // Invoice lineItems: right after the marker.
  if (type === 'lineItems' && surface === 'invoice') {
    const markerIdx = blocks.findIndex((b) => b.type === markerForSurface)
    if (markerIdx >= 0) {
      return markerIdx + 1
    }
  }

  // Invoice totals: after lineItems (or right after marker if lineItems missing).
  if (type === 'totals' && surface === 'invoice') {
    const markerIdx = blocks.findIndex((b) => b.type === markerForSurface)
    if (markerIdx >= 0) {
      const lineItemsIdx = blocks.findIndex((b) => b.type === 'lineItems')
      if (lineItemsIdx >= 0) {
        return lineItemsIdx + 1
      }
      // lineItems doesn't exist yet, insert right after marker.
      return markerIdx + 1
    }
  }

  // Invoice paymentDetails: before first action, else at end.
  if (type === 'paymentDetails' && surface === 'invoice') {
    const actionIdx = blocks.findIndex((b) => b.type === 'action')
    if (actionIdx >= 0) return actionIdx
  }

  // Default: append to end.
  return blocks.length
}
