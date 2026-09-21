'use client'

/**
 * A non-interactive, scaled-down render of a layout, for the "Use a
 * template" gallery cards and the templates grid (UX audit §3.9). Renders
 * the real `ProposalLayoutView` against the deterministic sample proposal
 * doc at a fixed 1200px design width, then scales the whole thing down to
 * fit the box via a measured `transform: scale(...)` - the same
 * public-page components the couple sees, just shrunk, so a thumbnail
 * never drifts from what the layout actually looks like.
 *
 * @module features/proposals/render/layout-thumbnail
 */
import { useEffect, useRef, useState } from 'react'

import type { PublicBranding } from '@/lib/branding/public-branding'
import { richTextHasContent } from '@/lib/branding/render-rich-text'
import { SAMPLE_PROPOSAL_DOC } from '@/lib/proposals/sample-proposal'

import type { ProposalLayout } from '../model/layout'

import { ProposalLayoutView } from './layout'

/** Design width the layout is rendered at before being scaled down to fit the box. */
const DESIGN_WIDTH_PX = 1200

/** True when nothing in `layout` would paint: only text sections, all of them empty. A card showing a bare white box tells the user nothing. */
export function layoutIsBlank(layout: ProposalLayout): boolean {
  return layout.sections.every((s) => s.kind === 'content' && !richTextHasContent(s.content ?? null))
}

/** Props for {@link LayoutThumbnail}. */
export interface LayoutThumbnailProps {
  layout: ProposalLayout
  branding: PublicBranding
  className?: string
}

/**
 * Scaled-down, non-interactive preview of `layout` inside a fixed
 * `aspect-[4/3]` box. `aria-hidden` + `inert` + `pointer-events-none`
 * throughout: it is a picture of the layout, not a second copy of the
 * page a screen reader or keyboard user could land in.
 */
export function LayoutThumbnail({ layout, branding, className }: LayoutThumbnailProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    // A ResizeObserver, not a one-off `getBoundingClientRect`: the box's
    // width depends on the grid column it sits in, which is unknown until
    // layout has run (and can change on window resize), so the scale is
    // re-measured whenever the box itself changes size.
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width
      if (width) setScale(width / DESIGN_WIDTH_PX)
    })
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={boxRef}
      aria-hidden="true"
      inert
      className={`relative aspect-[4/3] overflow-hidden rounded-control border border-border bg-surface-muted ${className ?? ''}`}
    >
      {layoutIsBlank(layout) ? (
        <div className="absolute inset-0 flex items-center justify-center text-body text-text-subtle">Blank page</div>
      ) : null}
      {scale > 0 ? (
        // The scale factor is a runtime measurement, not a design token -
        // there is no Tailwind class for "whatever this box happens to be
        // wide right now", so it is the one inline style here, matching
        // `PageSheet`'s own use of `style` for a value Tailwind can't
        // express (`features/proposals/editor/page-sheet.tsx`).
        <div className="pointer-events-none" style={{ width: DESIGN_WIDTH_PX, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          {/* `print`, not `edit`: a thumbnail must never load the real
              thing. Print renders embeds, audio and video as links or
              posters instead of live iframes/players (one grid of cards
              was firing a Vimeo player per template), and caps a
              full-height hero at a fixed 480px so the first two sections
              fit the 4:3 box. */}
          {/* `defaultSelection={false}`: a template thumbnail, no real couple choice - see `resolveSelection`'s doc comment. */}
          <ProposalLayoutView layout={layout} branding={branding} doc={SAMPLE_PROPOSAL_DOC} mode="print" defaultSelection={false} />
        </div>
      ) : null}
    </div>
  )
}
