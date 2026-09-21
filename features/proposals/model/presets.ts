/**
 * Section presets (spec D4, §3): the old fixed-purpose blocks as one-click
 * sections, and the default template a new account starts from. In Phase 1
 * every preset is the migrated v1 template for that block, so presets and
 * the migration agree by construction; Phase 3 makes them v2-native.
 *
 * @module features/proposals/model/presets
 */
import { blockTemplate } from '@/app/(dashboard)/branding/blocks/defaults'
import { proposalStarterBlocks } from '@/app/(dashboard)/branding/blocks/proposal-starters'
import type { ProposalRole } from '@/lib/proposals/types'

import type { ProposalLayout, Section } from './layout'
import { migrateProposalTreeToLayout } from './migrate-v1'

/** Every preset id, in palette display order. */
export const PRESET_IDS = ['hero', 'note', 'aboutMe', 'howItWorks', 'pricing', 'close', 'footer'] as const
/** A single preset's id: one of the one-click sections the palette can insert. */
export type PresetId = (typeof PRESET_IDS)[number]

/** Display label + one-line description for each preset, shown in the insert palette. */
export const PRESET_LABELS: Record<PresetId, { label: string; description: string }> = {
  hero: { label: 'Hero', description: 'A full-screen opening with the couple\'s names over a photo or video.' },
  note: { label: 'Note from me', description: 'A short personal note addressed to the couple.' },
  aboutMe: { label: 'About me', description: 'A portrait beside a few paragraphs about you.' },
  howItWorks: { label: 'How it works', description: 'Three steps from booking to the big day.' },
  pricing: { label: 'Pricing', description: 'Your packages and add-ons, with a live total.' },
  close: { label: 'Close', description: 'The accept button and the reassurance line under it.' },
  footer: { label: 'Footer', description: 'Business name, phone and ABN at the very end.' },
}

const PRESET_BLOCK: Record<PresetId, Parameters<typeof blockTemplate>[0]> = {
  hero: 'hero', note: 'introNote', aboutMe: 'aboutMe', howItWorks: 'howItWorks', pricing: 'packages', close: 'accept', footer: 'footer',
}

/** One fresh section for the preset. `role` flavours the starter copy where the v1 template did. */
export function presetSection(id: PresetId, role: ProposalRole = 'mc'): Section {
  // The role starters carry the role-specific copy for about / how-it-works;
  // for the rest the plain template is the preset.
  const source = id === 'aboutMe' || id === 'howItWorks'
    ? proposalStarterBlocks(role).find((b) => b.type === PRESET_BLOCK[id])!
    : blockTemplate(PRESET_BLOCK[id])
  const section = migrateProposalTreeToLayout([source]).sections[0]
  if (!section) throw new Error(`Preset ${id} produced no section`)
  return section
}

/** The layout a new account's first template starts from. */
export function defaultTemplateLayout(role: ProposalRole): ProposalLayout {
  return migrateProposalTreeToLayout(proposalStarterBlocks(role))
}
