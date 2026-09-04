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
  'couplePortal', 'contractBody', 'vendorTimelineBody',
  'questionnaireOneAtATime', 'questionnaireAllOnePage', 'formSubmit',
  // `contractSign` is deprecated but still a marker: block trees are not
  // snapshotted per contract, so an MC who has not opted into the per-party
  // split still has one and it must keep rendering.
  'contractSign',
  'contractSignVendor', 'contractSignPrimary', 'contractSignSecondary',
] as const)

/**
 * Markers the user may clear (via "Clear all blocks"), delete directly, and
 * re-add from the block palette (where they stay listed permanently). Every
 * other marker is a fixed singleton whose surface is nothing without it, so it
 * can never be removed. Clearable markers: the contract body + sign form, the
 * run sheet body, the couple portal body, and the two questionnaire form-style
 * blocks (the MC picks one by adding it; see {@link EXACTLY_ONE_BY_SURFACE}).
 */
export const CLEARABLE_MARKERS: ReadonlySet<BlockType> = new Set([
  'contractBody', 'contractSign', 'vendorTimelineBody', 'couplePortal',
  'questionnaireOneAtATime', 'questionnaireAllOnePage', 'formSubmit',
  'contractSignVendor', 'contractSignPrimary', 'contractSignSecondary',
] as const)

/**
 * Markers whose per-block frame styling (background, padding, border, radius,
 * width) DOES apply, wrapping the injected content on both the editor preview
 * and the sent document. Most markers inject couple-owned content whose surface
 * comes from the brand palette, so their block frame is stripped (see
 * block-frame.tsx / block-toolbar.tsx). The questionnaire form-style blocks are
 * the exception: the MC frames the questions area like any other block.
 */
export const STYLE_WRAPPING_MARKERS: ReadonlySet<BlockType> = new Set([
  'questionnaireOneAtATime', 'questionnaireAllOnePage',
] as const)

/** Blocks whose content comes from live document data, not template text. The
 *  website-form field collects a visitor's answer, so it is data-bound too. */
const DATA_BOUND: ReadonlySet<BlockType> = new Set([
  'paymentSchedule', 'lineItems', 'totals', 'formField',
] as const)

/** Required non-conditional blocks per surface. Contracts do not list an
 *  `action` block: the sign/decline form is its own `contractSign` marker block,
 *  so a generic CTA block would render nothing and only muddy the palette. The
 *  `contractSign` marker is where the form + MC countersignature render; on
 *  legacy contracts that predate it, the public card injects the form after the
 *  body instead (see contract-branded-card's absent-marker fallback). */
export const REQUIRED_BY_SURFACE: Readonly<Record<SurfaceTab, readonly BlockType[]>> = {
  invoice: ['title', 'lineItems', 'totals'],
  // A contract needs BOTH parties' signatures to be an agreement: the supplier
  // and the primary contact. Without the primary panel nobody can sign at all,
  // and without the supplier panel the document shows only one side committing.
  // The secondary panel stays optional, since plenty of couples have a single
  // named contact. A tree still carrying the deprecated `contractSign`
  // satisfies both (see readiness).
  contract: ['title', 'contractBody', 'contractSignVendor', 'contractSignPrimary'],
  portal: ['couplePortal'],
  vendorTimeline: ['vendorTimelineBody'],
  // The questionnaire's form style is governed by the exactly-one rule below,
  // not a fixed required block, so neither form block is individually required.
  questionnaire: [],
  // The website form's presence rules are the at-least-one (a field) and
  // exactly-one (a submit) constraints below, plus a name-field check in
  // readiness. No single block type is unconditionally required.
  lead: [],
}

/** Surfaces that need at least one of a set of blocks present. */
export const AT_LEAST_ONE_BY_SURFACE: Readonly<Partial<Record<SurfaceTab, readonly BlockType[]>>> = {
  // Invoice payment rule: at least one of Bank details / Pay CTA; both allowed.
  invoice: ['paymentDetails', 'action'],
  // A website form needs at least one field to collect anything.
  lead: ['formField'],
}

/**
 * Surfaces that need EXACTLY ONE of a set of blocks present: fewer or more raises
 * a readiness issue (see lib/branding/readiness.ts). The questionnaire's form
 * style is selected by adding one of the two form blocks, so none (nothing to
 * fill) and both (ambiguous style) are each invalid.
 */
export const EXACTLY_ONE_BY_SURFACE: Readonly<Partial<Record<SurfaceTab, readonly BlockType[]>>> = {
  questionnaire: ['questionnaireOneAtATime', 'questionnaireAllOnePage'],
  // A website form needs exactly one submit button.
  lead: ['formSubmit'],
}

/** Check if a block type is a render-split marker. */
export function isMarker(type: BlockType): boolean {
  return MARKER_TYPES.has(type)
}

/**
 * True when this marker's per-block frame styling wraps its injected content
 * (rather than being stripped). See {@link STYLE_WRAPPING_MARKERS}.
 */
export function stylesWrapMarker(type: BlockType): boolean {
  return STYLE_WRAPPING_MARKERS.has(type)
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

/** Get the exactly-one block constraint for a surface, or null if none apply. */
export function exactlyOneForSurface(surface: SurfaceTab): BlockType[] | null {
  const set = EXACTLY_ONE_BY_SURFACE[surface]
  return set ? [...set] : null
}

/** True when the type must be present for the surface to be "ready to send". */
export function isRequired(type: BlockType, surface: SurfaceTab): boolean {
  return requiredTypesForSurface(surface).includes(type)
}

/**
 * True when the user may delete this block. Non-locked blocks are always
 * deletable. Locked blocks resist EXCEPT the clearable markers (contract body +
 * sign form, run sheet body, couple portal body): those stay `locked` so they
 * can't be duplicated, but the MC can delete them directly (and re-add from the
 * palette), matching "Clear all blocks". Deleting one raises the not-ready flag
 * until it is re-added.
 */
export function isDeletable(block: Block, _surface: SurfaceTab): boolean {
  return !block.locked || CLEARABLE_MARKERS.has(block.type)
}
