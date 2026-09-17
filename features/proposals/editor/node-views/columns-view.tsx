'use client'

/**
 * Node view for the `columns` node: renders the same flex row the public
 * page renders (the Tailwind classes on `NodeViewContent`, so ProseMirror
 * keeps managing the child `column` nodes as real editable content) and,
 * while selected, one gutter grip per boundary that resizes the two
 * neighbouring columns' `ratio`s, keeping their sum fixed. The grip maths
 * and the ProseMirror write live in `columns-math.ts`.
 *
 * An unselected row whose every column holds nothing but a single empty
 * paragraph reads as a blank gap in the document; `isEveryColumnEmpty`
 * (final review Finding 6) drives a dashed placeholder for that state so
 * it stays discoverable without a click.
 *
 * @module features/proposals/editor/node-views/columns-view
 */
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useLayoutEffect, useRef, useState } from 'react'

import { ResizeGrip } from '@/components/editor'

import { FLOOR_PCT, gutterSnaps, splitLabel, SPLIT_TOLERANCE_PCT, writeNeighbourRatios } from './columns-math'
import { NodeGrips } from './node-grips'
import { selectNodeOnClick } from './select-node'

/** Fallback row width (px) when the wrapper cannot be measured (jsdom, or not yet laid out). */
const FALLBACK_ROW_PX = 720

/** True when `column` (a `column` node) holds nothing but one empty paragraph - the state a freshly-inserted columns row starts in. */
function isColumnEmpty(column: ProseMirrorNode): boolean {
  return column.childCount === 1 && column.firstChild?.type.name === 'paragraph' && column.firstChild.content.size === 0
}

/** True when every child of `columns` (the row node itself) is empty per {@link isColumnEmpty}. */
function isEveryColumnEmpty(columns: ProseMirrorNode): boolean {
  let empty = true
  columns.forEach((column) => {
    if (!isColumnEmpty(column)) empty = false
  })
  return empty
}

/** Editor node view for the `columns` node (registered by `extensions/columns.ts` when `nodeViews` is on). */
export function ColumnsView({ node, selected, editor, getPos }: NodeViewProps) {
  const rowRef = useRef<HTMLDivElement>(null)
  // Measured in an effect via a `ResizeObserver`, not read from the ref
  // during render (refs are for effects and event handlers, never
  // render): keeps the gutter grip's scale accurate if the row is
  // resized after mount.
  const [rowWidthPx, setRowWidthPx] = useState(FALLBACK_ROW_PX)
  useLayoutEffect(() => {
    const row = rowRef.current
    if (!row) return
    const measure = () => setRowWidthPx(row.clientWidth || FALLBACK_ROW_PX)
    measure()
    // jsdom (unit tests) has no `ResizeObserver`; the one-shot measurement
    // above still runs, just without staying live for a later resize.
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(row)
    return () => ro.disconnect()
  }, [])
  // Gates rendering the grips at all (a node view always has a position
  // once mounted, but `getPos` types it as possibly `undefined`); the
  // actual write re-reads `getPos()` fresh, see `writeNeighbourRatios`.
  const hasPos = typeof getPos() === 'number'
  const count = node.childCount
  const showEmptyPlaceholder = !selected && isEveryColumnEmpty(node)

  let cumulative = 0
  const boundaries = Array.from({ length: Math.max(count - 1, 0) }, (_, index) => {
    const ratio = Number(node.child(index).attrs.ratio ?? 1 / count)
    cumulative += ratio
    return { index, leftPct: cumulative * 100 }
  })

  return (
    <NodeViewWrapper as="div" data-node-type="columns" className="relative cursor-pointer" onClickCapture={selectNodeOnClick(editor, getPos)}>
      <div ref={rowRef} className="pointer-events-none absolute inset-0" />
      <NodeViewContent as="div" data-columns className="my-4 flex max-md:flex-col gap-6" />
      {showEmptyPlaceholder ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-control border border-dashed border-border">
          <span className="text-body text-text-subtle">Empty columns</span>
        </div>
      ) : null}
      {selected ? (
        <>
          <div className="pointer-events-none absolute inset-0 rounded-control ring-2 ring-brand-fg" />
          <NodeGrips>
            {hasPos ? boundaries.map(({ index, leftPct }) => {
              const a = Number(node.child(index).attrs.ratio ?? 0.5)
              const b = Number(node.child(index + 1).attrs.ratio ?? 0.5)
              const sumPct = (a + b) * 100
              return (
                // No width of its own (a 0-width anchor at the boundary's
                // percent offset), so the grip itself carries the
                // centring `-translate-x-1/2`: translating this wrapper
                // instead would be a no-op against its own 0 width.
                <div key={index} className="absolute inset-y-0" style={{ left: `${leftPct}%` }}>
                  <ResizeGrip
                    axis="x" value={a * 100} min={FLOOR_PCT} max={sumPct - FLOOR_PCT} scale={rowWidthPx / 100}
                    snaps={gutterSnaps(sumPct)} tolerance={SPLIT_TOLERANCE_PCT} format={(v) => splitLabel(v, sumPct)}
                    onChange={(v) => writeNeighbourRatios(editor, getPos, node, index, v / 100, (sumPct - v) / 100)}
                    ariaLabel={`Column split ${index + 1}`} className="!inset-y-0 !left-0 !right-auto -translate-x-1/2"
                  />
                </div>
              )
            }) : null}
          </NodeGrips>
        </>
      ) : null}
    </NodeViewWrapper>
  )
}
