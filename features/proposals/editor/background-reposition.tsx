'use client'

/**
 * Drag-to-reposition for a section's background image. Mounted by
 * `editable-section.tsx` over the whole section once the Background
 * popover's Reposition button is pressed: the section itself is the
 * drag surface (the way Squarespace and Qwilr do it), so what the MC
 * drags is exactly the crop the couple will see. Every pointer move
 * dispatches an uncommitted `updateStyle` (live re-render of the
 * backdrop); release commits one undo step; Done or Escape leaves.
 *
 * The maths (`background-reposition-math.ts`) needs the rendered box and
 * the image's natural size, both read from the backdrop `<img>` inside
 * the section at drag start rather than tracked in state - the image is
 * already on screen, and reading it once per drag is cheap.
 *
 * @module features/proposals/editor/background-reposition
 */
import { Move } from 'lucide-react'
import { useEffect, useRef, type PointerEvent, type RefObject } from 'react'

import { Button } from '@/components/ui/button'

import type { Section, SectionBackground } from '../model/layout'

import { dragFocalPoint, type FocalPoint } from './background-reposition-math'
import type { LayoutAction } from './state'

/** Props for {@link BackgroundReposition}. */
export interface BackgroundRepositionProps {
  section: Section
  /** The section's own wrapper, where the backdrop `<img>` lives. */
  wrapperRef: RefObject<HTMLDivElement | null>
  dispatch: (action: LayoutAction, opts?: { commit?: boolean }) => void
  onDone: () => void
}

const CENTRE: FocalPoint = { x: 50, y: 50 }

/** The full-section drag surface plus its "Drag to reposition / Done" pill. */
export function BackgroundReposition({ section, wrapperRef, dispatch, onDone }: BackgroundRepositionProps) {
  const background = section.style.background
  // Drag-start snapshot: where the pointer went down, the focal point
  // then, and the box/natural sizes for the maths. `null` between drags.
  const drag = useRef<{ x: number; y: number; from: FocalPoint; box: { w: number; h: number }; natural: { w: number; h: number } } | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onDone()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDone])

  const write = (position: FocalPoint, opts?: { commit?: boolean }) => {
    const next: SectionBackground = { ...background, position }
    dispatch({ type: 'updateStyle', id: section.id, patch: { background: next } }, opts)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const img = wrapperRef.current?.querySelector<HTMLImageElement>('img[aria-hidden]')
    if (!img || !img.naturalWidth) return
    const rect = img.getBoundingClientRect()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = {
      x: e.clientX, y: e.clientY, from: background?.position ?? CENTRE,
      box: { w: rect.width, h: rect.height }, natural: { w: img.naturalWidth, h: img.naturalHeight },
    }
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    write(dragFocalPoint(d.from, { dx: e.clientX - d.x, dy: e.clientY - d.y }, d.box, d.natural))
  }
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    drag.current = null
    write(dragFocalPoint(d.from, { dx: e.clientX - d.x, dy: e.clientY - d.y }, d.box, d.natural), { commit: true })
  }

  return (
    <>
      <div
        role="application"
        aria-label="Reposition background"
        className="absolute inset-0 z-30 cursor-move touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        // A click that never dragged must not fall through to the wrapper's
        // click-to-select (the surface covers the section's own controls).
        onClick={(e) => e.stopPropagation()}
      />
      {/* A sibling of the surface, not a child: a pointerdown on Done must
          not start a drag and capture the pointer, which swallowed the
          click. Same radius as every other popover on the canvas. */}
      <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-2 rounded-control border border-border bg-surface py-1 pl-3 pr-1 text-body text-text-muted shadow-lg">
          <Move size={14} strokeWidth={1.5} />
          Drag to reposition
          <Button variant="primary" onClick={onDone}>Done</Button>
        </div>
      </div>
    </>
  )
}
