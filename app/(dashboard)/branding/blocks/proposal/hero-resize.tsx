'use client'

import { useState } from 'react'

import { HERO_MAX_VH, HERO_MIN_VH } from '@/lib/branding/public-blocks/proposal/hero'

/** Within this many percent of a full screen the drag snaps to exactly 100. */
const FULL_SNAP_VH = 4

/**
 * The hero's Canva-style height control: a grip on its bottom edge that the
 * MC drags to set `heightVh`, a share of the couple's viewport. The drag
 * is measured against the editor's simulated viewport (720px, the same
 * one `RenderHero` sizes the block from), so a full-screen hero and a
 * half-screen one look on the canvas the way they will on the sent page.
 * The readout while dragging says what the number means ("Full screen",
 * "62% of screen") rather than showing pixels that mean nothing off the
 * canvas.
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
  const [dragging, setDragging] = useState<number | null>(null)

  const startResize = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    // The canvas is scaled with CSS `zoom`, so a screen pixel is not a
    // canvas pixel: layout height (unzoomed) over screen height (zoomed)
    // recovers the factor without the grip needing to know the zoom.
    const root = e.currentTarget.offsetParent as HTMLElement | null
    const layoutHeight = root?.offsetHeight ?? 0
    const screenHeight = root?.getBoundingClientRect().height ?? 0
    const zoom = layoutHeight > 0 && screenHeight > 0 ? screenHeight / layoutHeight : 1
    const startY = e.clientY
    const startVh = heightVh
    let last = startVh
    setDragging(startVh)
    const onMove = (ev: MouseEvent) => {
      const dyCanvas = (ev.clientY - startY) / zoom
      let next = Math.round(startVh + (dyCanvas / canvasViewportHeight) * 100)
      if (Math.abs(next - HERO_MAX_VH) <= FULL_SNAP_VH) next = HERO_MAX_VH
      next = Math.min(HERO_MAX_VH, Math.max(HERO_MIN_VH, next))
      if (next === last) return
      last = next
      setDragging(next)
      onChange(next)
    }
    const onUp = () => {
      setDragging(null)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const shown = dragging ?? heightVh
  return (
    <div
      onMouseDown={startResize}
      title="Drag to resize"
      className={`absolute inset-x-0 bottom-0 z-10 h-3 flex items-end justify-center pb-1 cursor-ns-resize transition ${
        dragging !== null ? 'opacity-100' : 'opacity-0 group-hover/hero:opacity-100'
      }`}
    >
      {dragging !== null && (
        <span className="absolute bottom-4 rounded-pill bg-gray-900/80 text-white text-body px-2 py-0.5 tabular-nums pointer-events-none">
          {shown === HERO_MAX_VH ? 'Full screen' : `${shown}% of screen`}
        </span>
      )}
      <div className="h-1 w-10 rounded-pill bg-gray-900/60 ring-1 ring-white/80 shadow-sm" />
    </div>
  )
}
