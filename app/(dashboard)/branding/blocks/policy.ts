/**
 * Block policy: which blocks are render-split markers, which are required or
 * optional per surface, and which surfaces need at-least-one of a set.
 *
 * Product rule (2026-07 redesign): users may delete ANY non-locked block,
 * including required ones. Deleting a required block does not auto-reinsert it;
 * it raises a "not ready to send" flag (see lib/branding/readiness.ts). Only
 * hard-locked render-split markers are undeletable.
 *
 * @module app/(dashboard)/branding/blocks/policy
 */
import type { SurfaceTab } from '@/types/branding-preview'
import type { Block, BlockType } from './types'

/** Render-split markers: the generic public renderer emits null for these and
 *  each surface injects the live content at the marker position. */
export const MARKER_TYPES: ReadonlySet<BlockType> = new Set([
  'couplePortal', 'contractBody', 'vendorTimelineBody', 'questionnaireBody',
] as const)

/** Blocks whose content comes from live document data, not template text. */
const DATA_BOUND: ReadonlySet<BlockType> = new Set([
  'paymentSchedule', 'lineItems', 'totals',
  'packageInclusions', 'packageTotals',
] as const)

/** Required non-conditional blocks per surface (the CTA `action` is required
 *  where the document must have a call to action). */
export const REQUIRED_BY_SURFACE: Readonly<Record<SurfaceTab, readonly BlockType[]>> = {
  proposal: ['packageHeader', 'packageDetails', 'packageTotals', 'action'],
  invoice: ['title', 'lineItems', 'totals'],
  contract: ['title', 'contractBody', 'action'],
  portal: ['couplePortal'],
  vendorTimeline: ['vendorTimelineBody'],
  questionnaire: ['questionnaireBody'],
}

/** Surfaces that need at least one of a set of blocks present. */
export const AT_LEAST_ONE_BY_SURFACE: Readonly<Partial<Record<SurfaceTab, readonly BlockType[]>>> = {
  // Invoice payment rule: at least one of Bank details / Pay CTA; both allowed.
  invoice: ['paymentDetails', 'action'],
}

export function isMarker(type: BlockType): boolean {
  return MARKER_TYPES.has(type)
}

export function isDataBound(type: BlockType): boolean {
  return DATA_BOUND.has(type)
}

export function requiredTypesForSurface(surface: SurfaceTab): BlockType[] {
  return [...(REQUIRED_BY_SURFACE[surface] ?? [])]
}

export function atLeastOneForSurface(surface: SurfaceTab): BlockType[] | null {
  const set = AT_LEAST_ONE_BY_SURFACE[surface]
  return set ? [...set] : null
}

/** True when the type must be present for the surface to be "ready to send". */
export function isRequired(type: BlockType, surface: SurfaceTab): boolean {
  return requiredTypesForSurface(surface).includes(type)
}

/** True when the user may delete this block. Only hard-locked markers resist. */
export function isDeletable(block: Block, _surface: SurfaceTab): boolean {
  return !block.locked
}
