/**
 * Block tree repair: migrates legacy block shapes (headerBanner to image),
 * dedups render-split markers, and drops unknown block types. Idempotent:
 * safe to run on every load and save.
 *
 * Does NOT enforce or auto-insert required blocks. Required blocks are now
 * deletable, and their absence is surfaced by the readiness layer
 * (lib/branding/readiness.ts), not repaired here.
 *
 * @module lib/branding/validate-blocks
 */

// The block defaults + type helpers live under app/(dashboard)/branding/
// because they're consumed primarily by the editor surface there.
// This module is the one acceptable bridge that pulls them into a lib-level
// data helper. Layering exception noted in `.claude/docs/component-library.md`.
// eslint-disable-next-line no-restricted-imports
import { migrateBlocks } from '@/app/(dashboard)/branding/blocks/defaults'
// eslint-disable-next-line no-restricted-imports
import {
  MARKER_TYPES,
} from '@/app/(dashboard)/branding/blocks/policy'
// eslint-disable-next-line no-restricted-imports
import { BLOCK_LABELS } from '@/app/(dashboard)/branding/blocks/types'
// eslint-disable-next-line no-restricted-imports
import type { Block, BlockType } from '@/app/(dashboard)/branding/blocks/types'
import type { SurfaceTab } from '@/types/branding-preview'

/**
 * Type for a blocks-by-surface object containing trees for all six surfaces.
 */
export interface BlocksByDoc {
  invoice: Block[]
  contract: Block[]
  portal: Block[]
  vendorTimeline: Block[]
  questionnaire: Block[]
  lead: Block[]
}

/**
 * Repair all six surface block trees at once, preserving the autosave invariant:
 * every saved branding_blocks record has all six surface keys, with empty arrays
 * staying empty (not resurrected with required blocks).
 *
 * Why empty arrays must stay empty: Users can hide a surface entirely via the
 * Documents panel ("hide and clear"). An empty array signals this intent. If we
 * repaired it to insert the marker + required blocks, the live page would flip
 * from its fallback layout back into block rendering — undoing the user's hide.
 * Instead, we preserve empty as-is, matching the load path's saved-empty gating
 * on public pages.
 *
 * Missing keys (old data predating new surfaces) are seeded as `[]` rather than
 * being dropped or seeded with default blocks. This ensures old rows round-trip
 * losslessly through a save: a user with old 4-surface data will load all 6,
 * see the new surfaces empty in the editor, and on save will have all 6 persisted.
 *
 * @param blocks - Input blocks object, may have missing/extra keys
 * @returns Repaired object with all six keys present; empty arrays preserved,
 *          non-empty trees fully repaired
 */
export function repairAllSurfaces(blocks: Partial<BlocksByDoc>): BlocksByDoc {
  // Initialize all six surfaces. Missing keys become empty arrays.
  const surfaces: SurfaceTab[] = ['invoice', 'contract', 'portal', 'vendorTimeline', 'questionnaire', 'lead']

  const result: BlocksByDoc = {
    invoice: [],
    contract: [],
    portal: [],
    vendorTimeline: [],
    questionnaire: [],
    lead: [],
  }

  for (const surface of surfaces) {
    const input = blocks[surface]

    // If key is missing entirely (undefined), seed as empty array for lossless
    // round-trip (old data without new surfaces returns them as empty).
    if (input === undefined) {
      result[surface] = []
      continue
    }

    // Preserve empty arrays as-is (user hid this surface).
    if (Array.isArray(input) && input.length === 0) {
      result[surface] = []
      continue
    }

    // Repair non-empty trees (null or array with blocks).
    result[surface] = repairBlocks(surface, input)
  }

  return result
}

/**
 * Repair a block tree for a specific surface. Guarantees:
 * - Legacy shapes migrated (headerBanner→image)
 * - Unknown block types dropped
 * - Render-split markers deduped (keep first occurrence)
 * - Idempotent: running twice produces the same result
 * - Does NOT auto-insert required blocks (readiness layer flags absence)
 *
 * @param surface - The surface being rendered (invoice/contract/portal)
 * @param blocks - Block tree, or null/undefined if no custom tree exists
 * @returns Repaired block tree with legacy shapes migrated and duplicates removed
 */
export function repairBlocks(surface: SurfaceTab, blocks: Block[] | null | undefined): Block[] {
  if (!blocks) return []
  // Step 1: migrate legacy shapes (headerBanner->image, dash stripping) so
  // downstream steps see the current schema.
  let out = migrateBlocks(blocks, surface)
  // Step 2: drop unknown types.
  const validTypes = new Set(Object.keys(BLOCK_LABELS) as BlockType[])
  out = out.filter((b) => validTypes.has(b.type))
  // Step 3: dedup any render-split marker (keep first occurrence).
  for (const marker of MARKER_TYPES) {
    const first = out.findIndex((b) => b.type === marker)
    if (first >= 0) {
      out = [...out.slice(0, first + 1), ...out.slice(first + 1).filter((b) => b.type !== marker)]
    }
  }
  return out
}
