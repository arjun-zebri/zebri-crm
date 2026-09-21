'use client'

/**
 * The proposal page as a distinct surface on the canvas workbench (UX
 * audit §3.1, a blocker): `render/layout.tsx` paints the theme's page background
 * / text colour / body font on the public page, but the editor canvas
 * skipped straight to rendering sections on the bare workbench colour, so
 * a page with no per-section background (every section but a filled
 * hero) had nothing behind it but the workbench - "sections float on the
 * workbench" per the audit. This wraps the section stack in the exact
 * same page styling, plus a visible edge so it reads as a document sitting
 * on a workbench rather than the workbench itself.
 *
 * @module features/proposals/editor/page-sheet
 */
import type { ReactNode } from 'react'

import type { CanvasDevice } from '@/components/editor'
import type { PublicBranding } from '@/lib/branding/public-branding'

import type { ProposalTheme } from '../model/theme'
import { pageSurfaceStyle } from '../render/page-surface'

/** Props for {@link PageSheet}. */
export interface PageSheetProps {
  branding: PublicBranding
  /** The layout's canvas theme: paints its page background. */
  theme: ProposalTheme
  device: CanvasDevice
  children: ReactNode
}

/** Wraps `children` in the same page background/text/font/link styling `ProposalLayoutView` paints on the public page, with a visible document edge. */
export function PageSheet({ branding, theme, device, children }: PageSheetProps) {
  const style = pageSurfaceStyle(theme, branding)

  return (
    <div
      data-page-sheet
      // Square corners and no overflow clipping on purpose: the first
      // section's top-edge `+` and name tag, and the last section's
      // bottom-edge `+`, hang half outside the sheet, and an
      // `overflow-hidden` sheet (needed only to round section corners)
      // cut them to half-moons. A paper sheet with square corners is what
      // Qwilr shows too.
      className={`@container/doc relative shadow-lg [&_a]:[color:var(--doc-link)] ${
        device === 'mobile' ? '' : 'ring-1 ring-border'
      }`}
      style={style}
    >
      {children}
    </div>
  )
}
