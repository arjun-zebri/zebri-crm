/**
 * Per-surface block availability, split into two palette groups: General blocks
 * (usable on every document) and Document-specific blocks (only on their own
 * document). Order within each group is expected frequency of use.
 *
 * @module app/(dashboard)/branding/blocks/blocks-by-surface
 */
import type { SurfaceTab } from '@/types/branding-preview'

import { CLEARABLE_MARKERS, isMarker } from './policy'
import { BLOCK_DESCRIPTIONS, blockLabel } from './types'
import type { BlockType, FormFieldBlock } from './types'

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
  questionnaire: ['questionnaireOneAtATime', 'questionnaireAllOnePage'],
  lead: ['formField', 'formSubmit'],
}

/**
 * One addable item in the block palette. Most entries are just a block type;
 * an entry may also carry a `preset` of prop overrides applied on insert, so
 * one block type can appear as several ready-made items (the Website form's
 * question fields are all `formField` presets, not distinct block types).
 */
export interface PaletteEntry {
  /** Stable identity for list keys; unique within a surface's palette. */
  key: string
  type: BlockType
  /** Display label; defaults to blockLabel(type) when absent. */
  label?: string
  /** One-line description; defaults to BLOCK_DESCRIPTIONS[type] when absent. */
  description?: string
  /** Prop overrides applied on top of blockTemplate(type) when inserted. */
  preset?: Partial<FormFieldBlock>
}

export interface PaletteGroup {
  label: 'General' | 'Document-specific'
  entries: PaletteEntry[]
}

/** A preset entry for one Website-form question. */
const leadField = (
  key: string,
  label: string,
  description: string,
  preset: Partial<FormFieldBlock>,
): PaletteEntry => ({
  key,
  type: 'formField',
  label,
  description,
  preset: { label, ...preset },
})

/**
 * The Website form's palette: every question from the enquiry form as its own
 * ready-made entry (same set as the fixed-field public form), a custom
 * question, and the submit button. Required presets mirror what the couple
 * must fill in on the public form (name + email).
 */
const LEAD_PALETTE: PaletteEntry[] = [
  leadField('lead-name', 'Your name', "The couple's name (required to create the enquiry)", {
    role: 'name', inputType: 'text', required: true,
  }),
  leadField('lead-partner', "Partner's name", 'Their partner, so both names are on file', {
    role: 'partnerName', inputType: 'text',
  }),
  leadField('lead-email', 'Email', 'How you reply to them (required)', {
    role: 'email', inputType: 'email', required: true,
  }),
  leadField('lead-phone', 'Phone', 'A contact number', {
    role: 'phone', inputType: 'tel',
  }),
  leadField('lead-date', 'Wedding date', 'When the day is', {
    role: 'weddingDate', inputType: 'date',
  }),
  leadField('lead-venue', 'Venue', 'Where the day is', {
    role: 'venue', inputType: 'text',
  }),
  leadField('lead-referral', 'How did you hear about me?', 'Where the enquiry came from', {
    role: 'referral', inputType: 'text',
  }),
  leadField('lead-message', 'Message', 'A free-text message from the couple', {
    role: 'message', inputType: 'textarea',
  }),
  leadField('lead-custom', 'Custom question', 'Anything else; answers fold into the couple notes', {
    role: 'custom', inputType: 'text', label: 'Your question', required: false,
  }),
  { key: 'lead-submit', type: 'formSubmit' },
]

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
  const docSpecific: PaletteEntry[] =
    surface === 'lead'
      ? LEAD_PALETTE
      : (DOC_SPECIFIC_BY_SURFACE[surface] ?? [])
          .filter((t) => {
            if (!isMarker(t)) return true
            // Clearable markers stay in the palette permanently; other markers
            // never appear (their surface is nothing without them, so they
            // can't be removed).
            return CLEARABLE_MARKERS.has(t)
          })
          .map((type) => ({ key: type, type }))
  const resolve = (e: PaletteEntry): PaletteEntry => ({
    ...e,
    label: e.label ?? blockLabel(e.type, surface),
    description: e.description ?? BLOCK_DESCRIPTIONS[e.type],
  })
  return [
    { label: 'General', entries: GENERAL_BLOCKS.map((type) => resolve({ key: type, type })) },
    { label: 'Document-specific', entries: docSpecific.map(resolve) },
  ]
}

/** Flat list of addable block types for a surface. */
export function blocksForSurface(surface: SurfaceTab): BlockType[] {
  return [...GENERAL_BLOCKS, ...(DOC_SPECIFIC_BY_SURFACE[surface] ?? [])]
}
