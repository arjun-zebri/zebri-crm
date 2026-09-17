'use client'

/**
 * Node view for the `image` node: renders the same figure the public page
 * renders (via the shared `ImageNode`, so the canvas is WYSIWYG) as a
 * direct child of the wrapper, with no box between them, so a floated
 * `layout: 'left' | 'right'` figure escapes the wrapper on the canvas
 * exactly as it does on the page (text wraps beside it). Its selection
 * ring and grips (`image-grips.tsx`) cannot be sized with CSS alone then:
 * a `width: 40%` figure inside a shrink-to-fit box resolves against that
 * box's own max-content width, not the figure's rendered size, so the box
 * never actually matches the figure. Instead they sit on one absolutely
 * positioned overlay measured straight from the rendered `<figure>`'s
 * `offsetLeft/offsetTop/offsetWidth/offsetHeight`.
 *
 * @module features/proposals/editor/node-views/image-view
 */
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useLayoutEffect, useRef, useState } from 'react'

import { ImageNode } from '../../render/rich-doc-nodes'
import type { ImageNodeAttrs } from '../extensions/image'

import { ImageGrips } from './image-grips'
import { selectNodeOnClick } from './select-node'

/** Fallback column width (px) when the measuring overlay cannot be measured (not yet laid out, or jsdom in a test with no stub). */
const FALLBACK_COLUMN_PX = 720

/** A figure's on-screen box, relative to the node view wrapper it is measured against. */
interface FigureRect {
  left: number
  top: number
  width: number
  height: number
}

const EMPTY_RECT: FigureRect = { left: 0, top: 0, width: 0, height: 0 }

/** Editor node view for the `image` node (registered by `extensions/image.ts` when `nodeViews` is on). */
export function ImageView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const attrs = node.attrs as ImageNodeAttrs

  // `scale` converts a screen-px drag delta into a percent of the column:
  // a dedicated full-column overlay div, sibling to the figure (its own
  // width tracks `widthPct`, so it can't also measure the column it sits
  // in). Measured in an effect via a `ResizeObserver` (refs are for
  // effects and event handlers, never render), so the grips stay accurate
  // if the column is resized after mount.
  const columnRef = useRef<HTMLDivElement>(null)
  const [columnWidthPx, setColumnWidthPx] = useState(FALLBACK_COLUMN_PX)
  useLayoutEffect(() => {
    const column = columnRef.current
    if (!column) return
    const measure = () => setColumnWidthPx(column.clientWidth || FALLBACK_COLUMN_PX)
    measure()
    // jsdom (unit tests) has no `ResizeObserver`; the one-shot measurement
    // above still runs, just without staying live for a later resize.
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(column)
    return () => ro.disconnect()
  }, [])

  // The overlay's own rect: read straight off the rendered `<figure>` via
  // `editor.view.nodeDOM`, rather than a wrapping measurement box, so no
  // extra element sits between the wrapper and the figure (see module
  // doc). Re-measured on `widthPct`/`layout` since either can change the
  // figure's rendered size without this node view's own DOM node moving.
  const [rect, setRect] = useState<FigureRect>(EMPTY_RECT)
  useLayoutEffect(() => {
    const pos = getPos()
    const wrapperEl = typeof pos === 'number' ? editor.view.nodeDOM(pos) : null
    // nodeDOM is typed as Node; only an Element can be queried.
    const figure = wrapperEl instanceof HTMLElement ? wrapperEl.querySelector('figure') : null
    if (!figure) return
    const measure = () =>
      setRect({ left: figure.offsetLeft, top: figure.offsetTop, width: figure.offsetWidth, height: figure.offsetHeight })
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(figure)
    return () => ro.disconnect()
  }, [editor, getPos, attrs.widthPct, attrs.layout])

  return (
    <NodeViewWrapper as="div" data-node-type="image" className="relative cursor-pointer" onClickCapture={selectNodeOnClick(editor, getPos)}>
      <div ref={columnRef} className="pointer-events-none absolute inset-0" />
      {/* `src` is schema-required (`ImageAttrs.src: string`, model/doc.ts)
          and the Task 8 insert flow uploads before ever inserting the
          node, so a `null` src is not reachable once that ships; `?? ''`
          only satisfies `ImageNode`'s stricter prop type today
          (`ImageNodeAttrs.src` stays nullable to match the TipTap
          attribute's own default). */}
      <ImageNode attrs={{ ...attrs, src: attrs.src ?? '' }} />
      {selected ? (
        <div className="pointer-events-none absolute" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}>
          <div className="pointer-events-none absolute inset-0 rounded-control ring-2 ring-brand-fg" />
          <ImageGrips widthPct={attrs.widthPct} scale={columnWidthPx / 100} onChange={(widthPct) => updateAttributes({ widthPct })} />
        </div>
      ) : null}
    </NodeViewWrapper>
  )
}
