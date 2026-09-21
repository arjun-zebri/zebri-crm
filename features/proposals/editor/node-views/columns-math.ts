/**
 * Pure maths and the ProseMirror write for the `columns` gutter grip.
 * Split out of `columns-view.tsx` to keep the view near the ~120-line
 * guideline.
 *
 * The grip drags in whole percentage points, not raw `ratio` (0-1), even
 * though `ratio` is what gets written: `resize-math.ts`'s `dragValue`
 * rounds its dragged value to the nearest integer on every move (correct
 * for a pixel or percent domain), which would collapse a 0-1 ratio drag
 * to 0 or 1 on the very first pixel. Converting to percent and dividing
 * by 100 on write sidesteps that without changing the shared drag maths.
 *
 * @module features/proposals/editor/node-views/columns-math
 */
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { Editor } from '@tiptap/react'

import type { Snap } from '@/components/editor'

/** Percentage points: how close a drag must land to a snap target to lock onto it (the brief's ratio tolerance of 0.03, expressed in the percent domain the grip actually drags in). */
export const SPLIT_TOLERANCE_PCT = 3
/** Percentage points either side of a boundary, keeping a column from being dragged to nothing. */
export const FLOOR_PCT = 10

/** `${a}% / ${b}%` for a boundary at `valuePct` out of the pair's combined `sumPct`. */
export function splitLabel(valuePct: number, sumPct: number): string {
  return `${Math.round(valuePct)} / ${Math.round(sumPct - valuePct)}`
}

/** Snap targets for one boundary: an even split, and a one-third / two-thirds split, scaled to the pair's combined width. */
export function gutterSnaps(sumPct: number): Snap[] {
  return [sumPct / 2, sumPct / 3, (sumPct * 2) / 3].map((value) => ({ value, label: splitLabel(value, sumPct) }))
}

/**
 * Writes `ratio` on the boundary's two neighbouring `column` children (at
 * `index` and `index + 1`), preserving their sum. Takes `getPos` (not a
 * `pos` value) and re-reads it inside: this runs from a `ResizeGrip`
 * `onChange`, potentially several times across one drag, and a position
 * captured once at render could be stale by a later call. Goes through
 * `editor.chain().command(...)`, TipTap's own command pipeline, rather
 * than dispatching a transaction straight at `editor.view` (the store
 * never sees this write either way; `command` is the documented seam).
 */
export function writeNeighbourRatios(editor: Editor, getPos: () => number | undefined, node: ProseMirrorNode, index: number, a: number, b: number): void {
  const pos = getPos()
  if (typeof pos !== 'number') return
  editor
    .chain()
    .command(({ tr }) => {
      node.forEach((child, childOffset, i) => {
        if (i === index) tr.setNodeAttribute(pos + 1 + childOffset, 'ratio', a)
        if (i === index + 1) tr.setNodeAttribute(pos + 1 + childOffset, 'ratio', b)
      })
      return true
    })
    .run()
}
