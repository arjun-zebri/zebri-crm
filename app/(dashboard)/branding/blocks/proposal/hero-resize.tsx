'use client'

import { ResizeGrip } from '@/components/editor'
import { HERO_MAX_VH, HERO_MIN_VH } from '@/lib/branding/public-blocks/proposal/hero'

/** Within this many percent of a full screen the drag snaps to exactly 100. */
const FULL_SNAP_VH = 4

/**
 * The hero's Canva-style height control: a grip on its bottom edge that
 * the MC drags to set `heightVh`, a share of the couple's viewport. Built
 * on the shared {@link ResizeGrip} (Proposal Layout v2 Phase 2, spec 5.3):
 * the drag is measured against the editor's simulated viewport (720px,
 * the same one `RenderHero` sizes the block from) via `scale`, so a
 * full-screen hero and a half-screen one look on the canvas the way they
 * will on the sent page. The readout while dragging says what the number
 * means ("Full screen", "62% of screen") rather than showing pixels that
 * mean nothing off the canvas.
 */
export function HeroResizeGrip({
  heightVh,
  canvasViewportHeight,
  onChange,
}: {
  heightVh: number
  canvasViewportHeight: number
  onChange: (heightVh: number) => void
}) {
  return (
    <ResizeGrip
      axis="y"
      value={heightVh}
      min={HERO_MIN_VH}
      max={HERO_MAX_VH}
      scale={canvasViewportHeight / 100}
      snaps={[{ value: HERO_MAX_VH, label: 'Full screen' }]}
      tolerance={FULL_SNAP_VH}
      format={(v) => `${v}% of screen`}
      onChange={onChange}
      ariaLabel="Hero height"
      // Hidden until the hero is hovered (`group/hero`, set on the hero
      // block's wrapper) or mid-drag, so it doesn't clutter a block the
      // MC isn't looking at.
      className="opacity-0 transition group-hover/hero:opacity-100 data-[dragging=true]:opacity-100"
    />
  )
}
