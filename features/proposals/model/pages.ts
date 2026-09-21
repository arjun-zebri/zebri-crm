/**
 * Pages for step flow (`theme.flow === 'step'`, `model/theme.ts`): the
 * flat `sections[]` split at every `pageBreak` section into the groups
 * the page shows one screen at a time. A page, not a section, is the
 * thing that fills a screen (2026-09-19 founder ruling: "sections
 * themselves shouldn't be the thing that are full height"), so a heading
 * section stacked over a packages section can share one screen. Stack
 * flow never calls this; it renders the flat list and skips the breaks.
 *
 * @module features/proposals/model/pages
 */
import type { Section } from './layout'

/** The id of the page before any break: the one page every layout has. */
export const FIRST_PAGE_ID = 'page-first'

/** One screen's worth of sections in step flow. */
export interface LayoutPage {
  /** `FIRST_PAGE_ID` for the opening page, else the id of the break that opens it (stable across edits, so it doubles as a React key and the dot rail's anchor). */
  id: string
  /** The `pageBreak` section this page starts with; absent on the first page. */
  breakSection?: Section
  /** Every non-break section on the page, in order. May be empty for a leading, trailing or doubled break; the public render skips such a page, the editor keeps it so the break stays visible and deletable. */
  sections: Section[]
}

/** Splits `sections` into pages at every `pageBreak`. Always returns at least the first page, even for an empty layout. */
export function splitPages(sections: readonly Section[]): LayoutPage[] {
  const pages: LayoutPage[] = [{ id: FIRST_PAGE_ID, sections: [] }]
  for (const section of sections) {
    if (section.kind === 'pageBreak') pages.push({ id: section.id, breakSection: section, sections: [] })
    else pages[pages.length - 1]!.sections.push(section)
  }
  return pages
}
