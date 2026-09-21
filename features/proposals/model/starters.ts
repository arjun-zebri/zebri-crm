/**
 * The starter catalogue offered by the "Use a template" gallery (UX audit
 * §3.9, founder ask: New template -> Start from scratch / Use a template
 * -> a gallery of starters). Five ready-made layouts plus a blank page,
 * each `build()` producing a fresh {@link ProposalLayout} with newly
 * minted section ids so two templates built from the same starter never
 * share ids (every underlying section factory - `defaultTemplateLayout`,
 * the inline blank section below - already mints its own via
 * `newSectionId()`).
 *
 * @module features/proposals/model/starters
 */
import type { ProposalRole } from '@/lib/proposals/types'

import { doc, paragraph } from './doc'
import type { ProposalLayout, Section } from './layout'
import { defaultTemplateLayout } from './presets'
import { newSectionId } from './schema'
import { sectionLabel } from './section-labels'

/** One offering in the "Use a template" gallery. */
export interface TemplateStarter {
  /** Stable id: the gallery card's React key and the value carried through the name step. */
  id: string
  name: string
  /** One line shown under the name on the gallery card. */
  description: string
  /** Chip the gallery filters by. `'short'` is not a proposal role - it groups starters by shape, not audience. */
  category: 'mc' | 'celebrant' | 'both' | 'short'
  /** Builds a fresh layout for this starter. Call once per use - never share the result across two templates. */
  build: () => ProposalLayout
}

/**
 * Pick sections out of `base` by display label, in `labels`' order,
 * dropping any label with no match. Data sections (packages, accept, ...)
 * carry no `name` of their own, so this matches on {@link sectionLabel}'s
 * fallback-by-kind the same way the section bar's name tag does, rather
 * than requiring the starter layouts to name every section just so a
 * derived starter can find them again.
 */
function pickByLabel(base: ProposalLayout, labels: readonly string[]): Section[] {
  return labels
    .map((label) => base.sections.find((section) => sectionLabel(section) === label))
    .filter((section): section is Section => section !== undefined)
}

/** "Short and sweet": the mc layout trimmed to its opening, pricing and close - no about/how-it-works/testimonials/FAQ. */
function shortAndSweetLayout(): ProposalLayout {
  const base = defaultTemplateLayout('mc')
  return { version: 2, sections: pickByLabel(base, ['Hero', 'Note', 'Packages', 'Accept', 'Footer']) }
}

/** "Packages first": the mc layout with pricing moved up, ahead of the case for booking. */
function packagesFirstLayout(): ProposalLayout {
  const base = defaultTemplateLayout('mc')
  return { version: 2, sections: pickByLabel(base, ['Hero', 'Packages', 'About me', 'Testimonials', 'Accept', 'Footer']) }
}

const ROLE_STARTER = (role: ProposalRole) => () => defaultTemplateLayout(role)

/** The five starters the gallery offers, in display order. */
export const TEMPLATE_STARTERS: readonly TemplateStarter[] = [
  {
    id: 'reception-mc', name: 'Reception MC', category: 'mc',
    description: 'Hero, about, how it works, packages, testimonials and the accept button.',
    build: ROLE_STARTER('mc'),
  },
  {
    id: 'ceremony-celebrant', name: 'Ceremony celebrant', category: 'celebrant',
    description: 'The same shape, written for a celebrant marrying the couple.',
    build: ROLE_STARTER('celebrant'),
  },
  {
    id: 'ceremony-and-reception', name: 'Ceremony and reception', category: 'both',
    description: 'One proposal for an MC who also marries couples: the full day.',
    build: ROLE_STARTER('both'),
  },
  {
    id: 'short-and-sweet', name: 'Short and sweet', category: 'short',
    description: 'Hero, a note, packages and the accept button. Nothing else.',
    build: shortAndSweetLayout,
  },
  {
    id: 'packages-first', name: 'Packages first', category: 'mc',
    description: 'Leads with pricing, then the case for booking you.',
    build: packagesFirstLayout,
  },
] as const

/** One "Use a template" gallery category chip. `'all'` shows every starter. */
export interface StarterCategory {
  id: 'all' | TemplateStarter['category']
  label: string
}

/** Category chips for the gallery, in display order. */
export const STARTER_CATEGORIES: readonly StarterCategory[] = [
  { id: 'all', label: 'All' },
  { id: 'mc', label: 'MC' },
  { id: 'celebrant', label: 'Celebrant' },
  { id: 'both', label: 'Both' },
  { id: 'short', label: 'Short' },
] as const

/**
 * "Start from scratch": one empty content section, the same shape the add
 * palette's "Text" item creates (`editor/state.ts`'s `newSectionFor('content')`)
 * - not imported from there directly, since `editor/` sits above `model/`
 * in the feature's own layering (the editor state module imports from
 * `model/`, so the reverse import would invert it) - so the literal is
 * kept in step by `starters.test.ts` asserting it matches `newSectionFor`'s
 * own output shape.
 */
export function blankTemplateLayout(): ProposalLayout {
  return {
    version: 2,
    sections: [
      // No `contentWidth`: inherits the theme's Page width, like every fresh Text section (`newSectionFor`).
      { id: newSectionId(), kind: 'content', style: { height: 'fit' }, content: doc(paragraph()) },
    ],
  }
}
