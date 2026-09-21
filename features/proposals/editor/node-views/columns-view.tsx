'use client'

/**
 * Node view for the `columns` node: renders the same flex row the public
 * page renders (the Tailwind classes on `NodeViewContent`, aimed at
 * TipTap's own contentDOM child, so ProseMirror keeps managing the child
 * `column` nodes as real editable content) and,
 * while selected, one gutter grip per boundary that resizes the two
 * neighbouring columns' `ratio`s, keeping their sum fixed. The grip maths
 * and the ProseMirror write live in `columns-math.ts`.
 *
 * An empty column is not this view's concern: the `Placeholder` options in
 * `extensions/index.ts` put the "Type / to add content" hint inside every
 * empty cell, caret or not, so the row never reads as a blank gap.
 *
 * @module features/proposals/editor/node-views/columns-view
 */
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useLayoutEffect, useRef, useState } from 'react'

import { ResizeGrip } from '@/components/editor'

import { FLOOR_PCT, gutterSnaps, splitLabel, SPLIT_TOLERANCE_PCT, writeNeighbourRatios } from './columns-math'
import { NodeGrips } from './node-grips'
import { selectNodeOnClick } from './select-node'

/** Fallback row width (px) when the wrapper cannot be measured (jsdom, or not yet laid out). */
const FALLBACK_ROW_PX = 720

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

  let cumulative = 0
  const boundaries = Array.from({ length: Math.max(count - 1, 0) }, (_, index) => {
    const ratio = Number(node.child(index).attrs.ratio ?? 1 / count)
    cumulative += ratio
    return { index, leftPct: cumulative * 100 }
  })

  return (
    <NodeViewWrapper as="div" data-node-type="columns" className="relative cursor-pointer" onClickCapture={selectNodeOnClick(editor, getPos)}>
      <div ref={rowRef} className="pointer-events-none absolute inset-0" />
      {/* TipTap 3's React renderer appends its own contentDOM `<div>`
          (`[data-node-view-content-react]`) inside `NodeViewContent` and
          puts the `column` cells in there, so the flex row has to be that
          child (`*:`), not this wrapper: `flex` on the wrapper made the
          contentDOM its one flex item and left the cells stacked as plain
          blocks. `[data-columns]` stays on the wrapper; `editor-styles.ts`'s
          mobile-canvas rule targets the same `>*` child.
          `@max-3xl/doc:` (not `max-md:`), matching `ColumnsFrame`'s public
          render: the editor's mobile canvas is a fixed-width column inside
          a desktop browser window, so a real viewport breakpoint never
          fires there (live-found 2026-09-19 - stayed side-by-side on
          mobile). `@container/doc` reflects the canvas's simulated width
          instead. */}
      <NodeViewContent as="div" data-columns className="my-4 *:flex *:gap-6 @max-3xl/doc:*:flex-col" />
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
                // `@max-3xl/doc:hidden`: once the row stacks, a boundary
                // "split" grip sitting mid-row reads as a stray divider
                // line rather than a drag handle for a split that no
                // longer exists left/right of anything.
                <div key={index} className="absolute inset-y-0 @max-3xl/doc:hidden" style={{ left: `${leftPct}%` }}>
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
