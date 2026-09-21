'use client'

/**
 * How the template canvas lays its section rows out (`model/pages.ts`):
 * in step flow the rows are grouped into screen-tall pages
 * (`pageCss('edit')`, the same rule `render/layout.tsx` applies on the
 * public page) with each `pageBreak` row sitting between two pages; in
 * stack flow every row, breaks included, is one flat list. A render prop
 * builds each row so this component knows nothing about editing: it only
 * decides the wrapping. Unlike the public render, an empty page keeps its
 * break row visible, so a stray break can still be selected and deleted.
 *
 * @module features/proposals/editor/canvas-pages
 */
import type { ReactNode } from 'react'

import type { Section } from '../model/layout'
import { splitPages } from '../model/pages'
import type { ProposalTheme } from '../model/theme'
import { pageCss } from '../render/section-style'

/** Props for {@link CanvasPages}. */
export interface CanvasPagesProps {
  sections: readonly Section[]
  theme: ProposalTheme
  /** Builds one row. `index` is the section's position in the flat `sections` list (the reducer's index); `pageStart` is true for the first section on a step-flow page. */
  renderSection: (section: Section, index: number, pageStart: boolean) => ReactNode
}

/** The canvas rows, paged in step flow and flat otherwise. See the module doc. */
export function CanvasPages({ sections, theme, renderSection }: CanvasPagesProps) {
  if (theme.flow !== 'step') {
    return <>{sections.map((section, index) => renderSection(section, index, false))}</>
  }
  const indexOf = new Map(sections.map((s, i) => [s.id, i]))
  return (
    <>
      {splitPages(sections).map((page) => (
        <div key={page.id} className="contents">
          {page.breakSection ? renderSection(page.breakSection, indexOf.get(page.breakSection.id)!, false) : null}
          {page.sections.length > 0 ? (
            <div data-page-id={page.id} className="flex flex-col" style={pageCss('edit')}>
              {page.sections.map((section, i) => renderSection(section, indexOf.get(section.id)!, i === 0))}
            </div>
          ) : null}
        </div>
      ))}
    </>
  )
}
