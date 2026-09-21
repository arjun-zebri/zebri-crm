'use client'

/**
 * Anchors its children (a node's control bar) directly above the selected
 * node's own DOM element on the canvas, instead of a fixed strip pinned to
 * the top of the canvas (UX audit §3.5/§6/§7.3: "bars on selection" means
 * the bar sits at the selection, not floating hundreds of pixels away from
 * the click that produced it - `template-editor-body.tsx`'s module doc has
 * the fuller history).
 *
 * The node's screen rect comes straight from `editor.view.nodeDOM(pos)`
 * (the same escape hatch `image-view.tsx` uses to read a node's rendered
 * box), and the frame it is positioned within is the scroll viewport's own
 * parent element - `CanvasFrame`'s root, which is also where the `overlay`
 * slot renders as a sibling of the scrolling content, so it never rides
 * along with the `zoom` CSS property that scales the document.
 *
 * Placing the bar needs the bar's own rendered width (to clamp it inside
 * the frame's gutters) and height (to sit its bottom edge 8px above the
 * node, flip below when that would leave less than 8px at the top, or
 * pin inside the node's top edge when it is taller than the frame), so
 * this mounts off-screen first and repositions once `useLayoutEffect` has
 * measured everything - the DOM mutation commits before the browser
 * paints, so there is no visible jump. Same measure-then-place pattern as
 * `CanvasFrame`'s own fit-zoom effect.
 *
 * @module features/proposals/editor/bars/node-bar-anchor
 */
import type { Editor } from '@tiptap/react'
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

/** Minimum distance the bar keeps from the frame's edges. */
const GUTTER = 8
/** Minimum distance the bar keeps from the node it is anchored to. */
const GAP = 8

/** Props for {@link NodeBarAnchor}. */
export interface NodeBarAnchorProps {
  /** The TipTap editor that owns the selected node. */
  editor: Editor
  /** The selected node's document position - resolved to a live DOM element via `editor.view.nodeDOM`. */
  pos: number
  /** The canvas's scroll viewport. Its parent element is the positioned frame the bar is measured and placed within. */
  scrollRef: RefObject<HTMLDivElement | null>
  /**
   * The canvas zoom level. Not read directly - `getBoundingClientRect()`
   * already returns on-screen (post-zoom) coordinates - but a zoom change
   * moves the node without firing a scroll or resize event, so it has to
   * be a dependency to force a re-measure.
   */
  zoom: number
  children: ReactNode
}

interface AnchorPosition {
  left: number
  top: number
}

/**
 * The three states the anchor cycles through: mounted off-screen so its
 * own size can be read (`measuring`), positioned over the node
 * (`positioned`), or genuinely gone because `pos` no longer resolves to a
 * live DOM element - a mid-frame delete - in which case nothing renders
 * at all (`gone`).
 */
type AnchorState =
  | { kind: 'measuring' }
  | { kind: 'positioned'; position: AnchorPosition }
  | { kind: 'gone' }

/** Anchors `children` (a node toolbar) above the node at `pos`, flipping below it when there is no room. Renders nothing once the node's DOM is gone. */
export function NodeBarAnchor({ editor, pos, scrollRef, zoom, children }: NodeBarAnchorProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState<AnchorState>({ kind: 'measuring' })

  useLayoutEffect(() => {
    const scrollEl = scrollRef.current
    const frameEl = scrollEl?.parentElement ?? null
    if (!scrollEl || !frameEl) return

    const recompute = () => {
      const dom = editor.view.nodeDOM(pos)
      const nodeEl = dom instanceof Element ? dom : null
      if (!nodeEl) {
        setAnchor({ kind: 'gone' })
        return
      }

      const nodeRect = nodeEl.getBoundingClientRect()
      const frameRect = frameEl.getBoundingClientRect()
      // `wrapperRef.current` is the div rendered below - already in the
      // tree (off-screen, on the first pass) by the time this runs, so its
      // rendered size is real, not a guess.
      const barRect = wrapperRef.current?.getBoundingClientRect()
      const barWidth = barRect?.width ?? 0
      const barHeight = barRect?.height ?? 0

      const idealLeft = nodeRect.left + nodeRect.width / 2 - frameRect.left
      const minLeft = GUTTER + barWidth / 2
      const maxLeft = Math.max(minLeft, frameRect.width - GUTTER - barWidth / 2)
      const left = Math.min(Math.max(idealLeft, minLeft), maxLeft)

      let top = nodeRect.top - frameRect.top - GAP - barHeight
      if (top < GUTTER) {
        const below = nodeRect.bottom - frameRect.top + GAP
        if (below + barHeight + GUTTER <= frameRect.height) {
          // Not enough room above the node - flip below it instead.
          top = below
        } else {
          // No room above or below: a node taller than the frame (a
          // full-width photo). Sit the bar just inside the node's top
          // edge, pinned to the frame's top gutter once that edge has
          // scrolled out of view, so it stays reachable while the node
          // is; `scroll` re-runs this, which is what makes it stick.
          top = Math.max(GUTTER, nodeRect.top - frameRect.top + GAP)
        }
      }

      setAnchor({ kind: 'positioned', position: { left, top } })
    }

    recompute()
    scrollEl.addEventListener('scroll', recompute)
    window.addEventListener('resize', recompute)
    return () => {
      scrollEl.removeEventListener('scroll', recompute)
      window.removeEventListener('resize', recompute)
    }
    // No `eslint-disable` needed here: `setAnchor` is called from inside
    // `recompute`, a named function also used as the scroll/resize
    // listener - the lint rule only flags a `setState` call written
    // directly in the effect body, not one reached through a callback
    // that also serves as a subscription handler (which is exactly the
    // "subscribe for updates from an external system" shape the rule
    // wants). The initial `recompute()` call right above is what performs
    // the DOM-sync write on mount.
  }, [editor, pos, zoom, scrollRef])

  if (anchor.kind === 'gone') return null

  // Off-screen sentinel while `kind === 'measuring'`: still mounted, so
  // `wrapperRef` has something to measure on the very first effect run,
  // but invisible until a real position lands - the layout effect above
  // commits that position before the browser paints, so there is no
  // flash at (0, -9999).
  const style = anchor.kind === 'positioned' ? anchor.position : { left: 0, top: -9999 }

  return (
    <div
      ref={wrapperRef}
      data-node-bar-anchor
      className="pointer-events-auto absolute z-20"
      style={{ left: style.left, top: style.top, transform: 'translateX(-50%)' }}
    >
      {children}
    </div>
  )
}
