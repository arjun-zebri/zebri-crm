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
  'couplePortal', 'contractBody', 'contractSign', 'vendorTimelineBody', 'questionnaireBody',
] as const)

/**
 * Markers the user may clear (via "Clear all blocks"), delete directly, and
 * re-add from the block palette (where they stay listed permanently). Every
 * other marker is a fixed singleton whose surface is nothing without it, so it
 * can never be removed. Clearable markers: the contract body + sign form, and
 * the run sheet body.
 */
export const CLEARABLE_MARKERS: ReadonlySet<BlockType> = new Set([
  'contractBody', 'contractSign', 'vendorTimelineBody',
] as const)

/** Blocks whose content comes from live document data, not template text. */
const DATA_BOUND: ReadonlySet<BlockType> = new Set([
  'paymentSchedule', 'lineItems', 'totals',
] as const)

/** Required non-conditional blocks per surface. Contracts do not list an
 *  `action` block: the sign/decline form is its own `contractSign` marker block,
 *  so a generic CTA block would render nothing and only muddy the palette. The
 *  `contractSign` marker is where the form + MC countersignature render; on
 *  legacy contracts that predate it, the public card injects the form after the
 *  body instead (see contract-branded-card's absent-marker fallback). */
export const REQUIRED_BY_SURFACE: Readonly<Record<SurfaceTab, readonly BlockType[]>> = {
  invoice: ['title', 'lineItems', 'totals'],
  contract: ['title', 'contractBody', 'contractSign'],
  portal: ['couplePortal'],
  vendorTimeline: ['vendorTimelineBody'],
  questionnaire: ['questionnaireBody'],
}

/** Surfaces that need at least one of a set of blocks present. */
export const AT_LEAST_ONE_BY_SURFACE: Readonly<Partial<Record<SurfaceTab, readonly BlockType[]>>> = {
  // Invoice payment rule: at least one of Bank details / Pay CTA; both allowed.
  invoice: ['paymentDetails', 'action'],
}

/** Check if a block type is a render-split marker. */
export function isMarker(type: BlockType): boolean {
  return MARKER_TYPES.has(type)
}

/** Check if a block type has content sourced from live document data. */
export function isDataBound(type: BlockType): boolean {
  return DATA_BOUND.has(type)
}

/** Get the list of required block types for a surface. */
export function requiredTypesForSurface(surface: SurfaceTab): BlockType[] {
  return [...(REQUIRED_BY_SURFACE[surface] ?? [])]
}

/** Get the at-least-one block constraint for a surface, or null if none apply. */
export function atLeastOneForSurface(surface: SurfaceTab): BlockType[] | null {
  const set = AT_LEAST_ONE_BY_SURFACE[surface]
  return set ? [...set] : null
}

/** True when the type must be present for the surface to be "ready to send". */
export function isRequired(type: BlockType, surface: SurfaceTab): boolean {
  return requiredTypesForSurface(surface).includes(type)
}

/**
 * True when the user may delete this block. Non-locked blocks are always
 * deletable. Locked blocks resist EXCEPT the clearable markers (contract body +
 * sign form): those stay `locked` so they can't be duplicated, but the MC can
 * delete them directly (and re-add from the palette), matching "Clear all
 * blocks". Deleting one raises the not-ready flag until it is re-added.
 */
export function isDeletable(block: Block, _surface: SurfaceTab): boolean {
  return !block.locked || CLEARABLE_MARKERS.has(block.type)
}
