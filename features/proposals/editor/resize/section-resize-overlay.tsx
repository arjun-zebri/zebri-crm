'use client'

/**
 * Mounts a selected section's two resize surfaces - the height grip
 * (`SectionHeightGrip`) and the content column's width handles
 * (`SectionWidthHandles`) - measuring off the section's own DOM wrapper
 * (a ref `EditableSection` already owns). Kept as its own file, rather
 * than folding the measuring effect into `editable-section.tsx` directly,
 * so that file stays near its ~150-line budget.
 *
 * @module features/proposals/editor/resize/section-resize-overlay
 */
import { useEffect, useState, type RefObject } from 'react'

import type { CanvasDevice } from '@/components/editor'

import type { Section } from '../../model/layout'
import type { LayoutAction } from '../state'

import { SectionHeightGrip } from './section-height-grip'
import { SectionWidthHandles, type ColumnRect } from './section-width-handles'

/** Props for {@link SectionResizeOverlay}. */
export interface SectionResizeOverlayProps {
  section: Section
  /** True when this section, or a node inside it, is the current selection. */
  selected: boolean
  /** True when the selection is a node inside this section: the overlay stays hidden then, so it never fights the node view's own grips. */
  nodeSelected: boolean
  /** On the mobile canvas there is no width to drag (the content column is pinned to 100%, `content-section-frame.tsx`), so the width handles never mount there; the height grip is unaffected. */
  device: CanvasDevice
  /** `EditableSection`'s ref to its own outer DOM wrapper; both grips measure off it. */
  wrapperRef: RefObject<HTMLDivElement | null>
  dispatch: (action: LayoutAction, opts?: { commit?: boolean }) => void
}

/**
 * Sums `offsetLeft`/`offsetTop` from `el` up to (but excluding) `ancestor`,
 * following the `offsetParent` chain. `column`'s own `offsetParent` is
 * whichever positioned element directly contains it (the section's
 * `<section>`, not the outer wrapper `SectionResizeOverlay` renders
 * into), so a single `column.offsetLeft` read is not relative to the
 * wrapper; walking the whole chain is what makes it so, however many
 * positioned ancestors sit in between.
 */
function offsetRelativeTo(el: HTMLElement, ancestor: HTMLElement): { left: number; top: number } {
  let left = 0
  let top = 0
  let node: HTMLElement | null = el
  while (node && node !== ancestor) {
    left += node.offsetLeft
    top += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  return { left, top }
}

/** Renders the section's height grip and width handles while it is selected as a whole (not a node inside it). */
export function SectionResizeOverlay({ section, selected, nodeSelected, device, wrapperRef, dispatch }: SectionResizeOverlayProps) {
  const active = selected && !nodeSelected
  const [heightPx, setHeightPx] = useState(0)
  const [columnRect, setColumnRect] = useState<ColumnRect | null>(null)

  // A plain (passive) effect, not `useLayoutEffect`: `wrapperRef` is owned
  // by `EditableSection`, an ancestor of this component, and React commits
  // a subtree's layout effects bottom-up - children's layout effects run
  // before their own ancestor's ref gets attached. A `useLayoutEffect`
  // here would read `wrapperRef.current` while it is still `null` on first
  // mount (this component's own layout phase runs before the wrapper
  // `<div>`'s ref attaches). Passive effects run in a later, separate pass
  // after the whole commit (refs included), so by the time this one runs
  // the wrapper is guaranteed to exist. `image-view.tsx` measures a node
  // it reaches through TipTap's own `getPos()`/`nodeDOM`, not a React ref
  // from an ancestor, so it does not hit this ordering issue.
  useEffect(() => {
    if (!active) return
    const wrapperEl = wrapperRef.current
    if (!wrapperEl) return
    const column = wrapperEl.querySelector<HTMLElement>('[data-content-column]')
    const measure = () => {
      setHeightPx(wrapperEl.offsetHeight)
      if (!column) return
      const { left, top } = offsetRelativeTo(column, wrapperEl)
      setColumnRect({ left, top, width: column.offsetWidth, height: column.offsetHeight })
    }
    measure()
    // jsdom (unit tests) has no `ResizeObserver`; the one-shot measurement
    // above still runs, just without staying live for a later resize.
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(wrapperEl)
    if (column) ro.observe(column)
    return () => ro.disconnect()
    // Re-measures whenever the style that drives the section's own size
    // changes (a dispatch from elsewhere - a pill, the padding popover -
    // still needs to move these grips, not just a drag through them).
  }, [active, wrapperRef, section.style.padding, section.style.contentWidth, section.style.height])

  if (!active) return null

  return (
    <>
      <SectionHeightGrip sectionId={section.id} padding={section.style.padding} heightPx={heightPx} dispatch={dispatch} />
      {device === 'mobile' ? null : (
        <SectionWidthHandles sectionId={section.id} contentWidth={section.style.contentWidth} rect={columnRect} dispatch={dispatch} />
      )}
    </>
  )
}
