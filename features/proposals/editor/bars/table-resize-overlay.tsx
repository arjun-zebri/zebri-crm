'use client'

/**
 * Width / height grips for the selected table, rendered into `CanvasFrame`'s
 * `overlay` slot next to `NodeBarAnchor` and kept aligned with the table's
 * on-screen box (a `ResizeObserver` on the `<table>` itself, plus the same
 * scroll / resize / zoom triggers the anchor uses, so typing into a cell
 * moves the bottom grip with the row it grew).
 *
 * The table is a prosemirror-tables node view, not a React one, so its
 * grips cannot live inside it the way `ImageGrips` do; an overlay in
 * frame coordinates is how the node bar already reaches it.
 *
 * Width: `ResizeGrip` on the right edge. Its value is the table's layout
 * width, and a drag scales every column's `colwidth` in proportion
 * (`writeTableColumnWidths`), so the table's width stays the sum of its
 * columns - the one width model prosemirror-tables' column drag and the
 * public renderer share. Snapping onto the content column's full width
 * clears the widths instead, back to a fluid `100%` table that also fits
 * a phone; `Reset size` on the bar does the same.
 *
 * Height: `ResizeGrip` on the bottom edge writing `TableAttrs.height`
 * (rows share the extra space). Dragging below the content's own height
 * is meaningless for a table (CSS treats the value as a minimum), so a
 * commit that lands there clears the attr rather than storing a number
 * the table never honours.
 *
 * @module features/proposals/editor/bars/table-resize-overlay
 */
import type { Editor } from '@tiptap/react'
import { useEditorState } from '@tiptap/react'
import { useLayoutEffect, useState, type RefObject } from 'react'

import { ResizeGrip } from '@/components/editor'

import { TABLE_CELL_MIN_WIDTH } from '../../model/doc'
import { tableColumnCount, writeTableColumnWidths } from '../extensions/table-commands'
import { NodeGrips } from '../node-views/node-grips'

import { writeNodeAttrs } from './node-bar-shared'

/** Within this many layout px of the column's full width, the width grip snaps to it (and clears the widths). */
const FULL_WIDTH_TOLERANCE = 12
/** Shortest a table can be dragged to before the height clears back to auto. */
const MIN_HEIGHT = 24

/** Props for {@link TableResizeOverlay}. */
export interface TableResizeOverlayProps {
  editor: Editor
  /** The `table` node's document position (`NodeSelection.pos` for a `table` report). */
  pos: number
  /** The canvas's scroll viewport; its parent is the positioned frame the overlay is placed within. */
  scrollRef: RefObject<HTMLDivElement | null>
  zoom: number
}

interface Box { left: number; top: number; width: number; height: number }

/** The `<table>` element for the node at `pos`: prosemirror-tables' view wraps it in a `div.tableWrapper`. */
function tableElement(editor: Editor, pos: number): HTMLTableElement | null {
  const dom = editor.view.nodeDOM(pos)
  if (!(dom instanceof HTMLElement)) return null
  return dom instanceof HTMLTableElement ? dom : dom.querySelector('table')
}

/** See the module doc. */
export function TableResizeOverlay({ editor, pos, scrollRef, zoom }: TableResizeOverlayProps) {
  const [box, setBox] = useState<Box | null>(null)
  // Layout-px size of the table (unaffected by the canvas zoom) and its
  // column count, re-read on every transaction so a drag's own writes and
  // an added column both feed straight back into the grips.
  const size = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      const table = ed.state.doc.nodeAt(pos)
      const el = tableElement(ed, pos)
      if (!table || table.type.name !== 'table' || !el) return null
      const height = typeof table.attrs.height === 'number' ? table.attrs.height : el.offsetHeight
      // The wrapper's content width is exactly what a fluid (`100%`) table
      // spans, so it is both the drag's ceiling and the "100%" snap.
      const maxWidth = el.parentElement?.clientWidth ?? el.offsetWidth
      return { width: el.offsetWidth, height, cols: tableColumnCount(table), maxWidth }
    },
  })

  useLayoutEffect(() => {
    const scrollEl = scrollRef.current
    const frameEl = scrollEl?.parentElement ?? null
    const el = tableElement(editor, pos)
    if (!scrollEl || !frameEl || !el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      const f = frameEl.getBoundingClientRect()
      setBox({ left: r.left - f.left, top: r.top - f.top, width: r.width, height: r.height })
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(el)
    scrollEl.addEventListener('scroll', measure)
    window.addEventListener('resize', measure)
    editor.on('transaction', measure)
    return () => {
      observer?.disconnect()
      scrollEl.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
      editor.off('transaction', measure)
    }
  }, [editor, pos, zoom, scrollRef])

  if (!box || !size) return null

  const setWidth = (next: number) => {
    const el = tableElement(editor, pos)
    const row = el?.rows[0]
    if (!el || !row) return
    // Scale from the columns as drawn (the `<col>` widths, or an even
    // share of a fluid table), never from stale attrs. A spanning cell's
    // width is split evenly over the columns it covers.
    const current = Array.from(row.cells).flatMap((c) => Array.from({ length: Math.max(1, c.colSpan) }, () => c.offsetWidth / Math.max(1, c.colSpan)))
    const total = current.reduce((a, b) => a + b, 0) || 1
    const widths = current.map((w) => Math.max(TABLE_CELL_MIN_WIDTH, Math.round((w / total) * next)))
    writeTableColumnWidths(editor, pos, widths)
  }
  const commitWidth = (next: number) => {
    if (Math.abs(next - size.maxWidth) <= FULL_WIDTH_TOLERANCE) writeTableColumnWidths(editor, pos, null)
  }
  const setHeight = (height: number) => writeNodeAttrs(editor, pos, { height })
  const commitHeight = (height: number) => {
    // Measured after the last write applied: a table taller than the
    // requested height means the content is the real minimum.
    const el = tableElement(editor, pos)
    if (el && el.offsetHeight > height) writeNodeAttrs(editor, pos, { height: null })
  }

  return (
    <div
      data-table-resize-overlay
      className="pointer-events-none absolute z-10"
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
    >
      <NodeGrips>
        <ResizeGrip
          axis="x" value={size.width} min={size.cols * TABLE_CELL_MIN_WIDTH} max={size.maxWidth} scale={zoom}
          snaps={[{ value: size.maxWidth, label: '100%' }]} tolerance={FULL_WIDTH_TOLERANCE}
          format={(v) => `${v}px`} onChange={setWidth} onCommit={commitWidth} ariaLabel="Table width"
        />
        <ResizeGrip
          axis="y" value={size.height} min={MIN_HEIGHT} max={4000} scale={zoom}
          format={(v) => `${v}px`} onChange={setHeight} onCommit={commitHeight} ariaLabel="Table height"
        />
      </NodeGrips>
    </div>
  )
}
