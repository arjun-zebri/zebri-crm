// Single canonical density → padding map. Used by both the editor block
// renderer (docX/docY/rowY/blockY — Tailwind padding classes applied to block
// internals) and the couple-facing public pages (page/cardHeader/cardSection —
// outer page spacing). Keeping both shapes in one place avoids drift between
// the editor preview and the live document.

import type { Density } from './themes'

export interface DensityPadding {
  // editor-internal block padding
  docX: string
  docY: string
  rowY: string
  blockY: string
  // public surface outer spacing
  page: string
  cardHeader: string
  cardSection: string
}

// Horizontal page padding is CONSTANT across densities (product decision
// 2026-07-17): spacing controls vertical rhythm only, so switching density
// never shifts the document's edges.
const DOC_X = 'px-4 @sm/doc:px-8'

export const DENSITY_PADDING: Record<Density, DensityPadding> = {
  compact: { docX: DOC_X, docY: 'py-5', rowY: 'py-2', blockY: 'py-3', page: 'py-8',  cardHeader: `${DOC_X} py-5`, cardSection: `${DOC_X} py-5` },
  cozy:    { docX: DOC_X, docY: 'py-7', rowY: 'py-3', blockY: 'py-4', page: 'py-12', cardHeader: `${DOC_X} py-7`, cardSection: `${DOC_X} py-6` },
  roomy:   { docX: DOC_X, docY: 'py-9', rowY: 'py-4', blockY: 'py-5', page: 'py-16', cardHeader: `${DOC_X} py-9`, cardSection: `${DOC_X} py-8` },
}
