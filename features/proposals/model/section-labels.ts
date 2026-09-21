/**
 * A section's display label: its own `name` when set, else a fallback by
 * `kind`. Pulled out of `editor/bars/section-name-field.tsx` (a `'use
 * client'` component) so pure model code - the starter catalogue
 * (`./starters.ts`), which needs to find "the Packages section" in a
 * layout that never named it - can use the same fallback without pulling
 * a React component file into the model layer.
 *
 * @module features/proposals/model/section-labels
 */
import type { SectionKind } from './layout'

/**
 * Fallback label for a section with no name of its own, by kind. The
 * section bar's name field (`editor/bars/section-name-field.tsx`) and
 * the section nav re-export this so there is exactly one copy of the
 * mapping.
 */
export const KIND_LABELS: Record<SectionKind, string> = {
  content: 'Text', packages: 'Packages', gallery: 'Gallery', video: 'Video',
  testimonials: 'Testimonials', faq: 'FAQ', accept: 'Accept', pageBreak: 'Page break',
}

/** `section.name`, or its kind's fallback label when unset. */
export function sectionLabel(section: { name?: string | undefined; kind: SectionKind }): string {
  return section.name ?? KIND_LABELS[section.kind]
}
