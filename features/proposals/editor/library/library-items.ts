/**
 * The add palette's card data (`../palette-body.tsx`): one `LibraryEntry`
 * per `SectionKind` (the Sections tab, built from `SECTION_ITEMS` below)
 * and one per `PresetId` (the Presets tab). Each entry carries a
 * ready-to-render single-section `ProposalLayout` for `LayoutThumbnail`,
 * plus a `build` factory for the `Section` the palette inserts on click.
 *
 * Kept under `library/` with `LibraryItemCard` as the palette's data +
 * card pair; the persistent library panel that once shared them is gone
 * (it duplicated the palette block for block).
 *
 * @module features/proposals/editor/library/library-items
 */
import type { ProposalRole } from '@/lib/proposals/types'

import type { ProposalLayout, Section, SectionKind } from '../../model/layout'
import { PRESET_IDS, PRESET_LABELS, presetSection } from '../../model/presets'
import { newSectionFor } from '../state'

/** One row of the Sections tab/group. */
interface SectionItem {
  kind: SectionKind
  label: string
}

/** The eight `SectionKind`s, in the order every Sections list shows them. The page break comes last: it is a layout mark, not content. */
export const SECTION_ITEMS: readonly SectionItem[] = [
  { kind: 'content', label: 'Text' },
  { kind: 'packages', label: 'Packages' },
  { kind: 'gallery', label: 'Gallery' },
  { kind: 'video', label: 'Video' },
  { kind: 'testimonials', label: 'Testimonials' },
  { kind: 'faq', label: 'FAQ' },
  { kind: 'accept', label: 'Accept' },
  { kind: 'pageBreak', label: 'Page break' },
]

/** One card's worth of data in the add palette's grid. */
export interface LibraryEntry {
  /** Stable per-render-list key: a `SectionKind` or `PresetId` string. */
  id: string
  label: string
  /** Only presets carry a description; a plain section kind does not. */
  description?: string
  /** Fed straight to `LayoutThumbnail`. */
  layout: ProposalLayout
  /** Section kinds only: which small illustration `SectionPreviewArt` draws instead of the thumbnail. A brand-new section has no content, so its real render is a blank white box that tells the user nothing - the illustration stands in for it. */
  kind?: SectionKind
  /** Builds the section the palette inserts on click. A factory, not a value: every insert needs its own section id (ids are the editor's selection and history keys), and the entries are memoised per role. */
  build: () => Section
}

/** Wraps one section in the single-section layout shape `LayoutThumbnail` renders. */
function oneSectionLayout(section: Section): ProposalLayout {
  return { version: 2, sections: [section] }
}

/** The Sections group: one entry per `SectionKind`, built fresh from `role` (about/how-it-works copy is role-flavoured). */
export function sectionLibraryEntries(role: ProposalRole): LibraryEntry[] {
  return SECTION_ITEMS.map(({ kind, label }) => {
    return { id: kind, label, kind, layout: oneSectionLayout(newSectionFor(kind, role)), build: () => newSectionFor(kind, role) }
  })
}

/** The Presets group: one entry per `PresetId`, with its label + description from `PRESET_LABELS`. */
export function presetLibraryEntries(role: ProposalRole): LibraryEntry[] {
  return PRESET_IDS.map((id) => {
    const { label, description } = PRESET_LABELS[id]
    return { id, label, description, layout: oneSectionLayout(presetSection(id, role)), build: () => presetSection(id, role) }
  })
}
