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

export const DENSITY_PADDING: Record<Density, DensityPadding> = {
  compact: { docX: 'px-4 @sm/doc:px-6',  docY: 'py-5', rowY: 'py-2', blockY: 'py-3', page: 'py-8',  cardHeader: 'px-4 @sm/doc:px-6 py-5',  cardSection: 'px-4 @sm/doc:px-6 py-5' },
  cozy:    { docX: 'px-4 @sm/doc:px-8',  docY: 'py-7', rowY: 'py-3', blockY: 'py-4', page: 'py-12', cardHeader: 'px-4 @sm/doc:px-8 py-7',  cardSection: 'px-4 @sm/doc:px-8 py-6' },
  roomy:   { docX: 'px-5 @sm/doc:px-10', docY: 'py-9', rowY: 'py-4', blockY: 'py-5', page: 'py-16', cardHeader: 'px-5 @sm/doc:px-10 py-9', cardSection: 'px-5 @sm/doc:px-10 py-8' },
}
