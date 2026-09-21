/**
 * Pure column/size maths for a `table` node, shared by the public renderer
 * (`table-node.tsx`) and the editor's table view (`editor/extensions/
 * table.ts`) so both surfaces size a table identically.
 *
 * Mirrors prosemirror-tables' `updateColumns` exactly: a column's width
 * comes from the first row's cells' `colwidth` attr (one entry per spanned
 * column); a table whose every column has a width is rendered at their sum
 * (so a drag on the table's width grip, which writes every `colwidth`, is
 * the table's width), while a table with any unsized column stays fluid
 * (`width: 100%` from its class) with the sum as its minimum. Every table
 * uses `table-layout: fixed`, which is what stops typing into a cell from
 * re-flowing the other columns: under fixed layout only row height reacts
 * to content.
 *
 * @module features/proposals/render/table-layout
 */
import type { JSONContent } from '@tiptap/core'
import type { CSSProperties } from 'react'

import { TABLE_CELL_MIN_WIDTH } from '../model/doc'

/** Sizing derived from a `table` node's JSON. */
export interface TableLayout {
  /** One entry per column: its `colwidth` in px, or `null` when unsized (fluid). */
  columns: ReadonlyArray<number | null>
  /**
   * Each column's share of the table, in percent, computed the moment any
   * column is sized (an unsized column counts as `cellMinWidth`) - what a
   * phone renders instead of the px widths, so a table sized for a desktop
   * column keeps its proportions at the screen's width rather than one
   * sized column's absolute px crushing the rest (live-found 2026-09-19: a
   * table with only one column dragged rendered that column's neighbours
   * as an empty, near-0 sliver on a phone). `null` entries only for a
   * table with no sized columns at all, whose browser-default equal split
   * already works on a phone with no help needed.
   */
  percents: ReadonlyArray<number | null>
  /** Inline style for the `<table>` element (width / min-width / height). */
  style: CSSProperties
}

/** Reads a cell's `colwidth` attr (px per spanned column) defensively: anything but a positive number is "unsized". */
function cellWidths(cell: JSONContent, colspan: number): Array<number | null> {
  const raw = cell.attrs?.colwidth
  const arr = Array.isArray(raw) ? raw : []
  return Array.from({ length: colspan }, (_, i) => {
    const v = arr[i]
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null
  })
}

/** Reads a cell's `colspan` attr, defaulting to 1 for anything malformed. */
function cellSpan(cell: JSONContent): number {
  const raw = cell.attrs?.colspan
  return typeof raw === 'number' && Number.isInteger(raw) && raw > 0 ? raw : 1
}

/** Column widths for a table node, read from its first row (the row prosemirror-tables also reads). */
export function tableColumnWidths(table: JSONContent): Array<number | null> {
  const firstRow = table.content?.[0]
  if (!firstRow?.content) return []
  return firstRow.content.flatMap((cell) => cellWidths(cell, cellSpan(cell)))
}

/** See the module doc. */
export function tableLayout(table: JSONContent, cellMinWidth: number = TABLE_CELL_MIN_WIDTH): TableLayout {
  const columns = tableColumnWidths(table)
  const fixedWidth = columns.length > 0 && columns.every((w) => w !== null)
  const totalWidth = columns.reduce<number>((sum, w) => sum + (w ?? cellMinWidth), 0)
  const style: CSSProperties = fixedWidth ? { width: totalWidth } : { minWidth: totalWidth }
  const height = table.attrs?.height
  if (typeof height === 'number' && Number.isFinite(height) && height > 0) style.height = height
  const anySized = columns.some((w) => w !== null)
  const percents = columns.map((w) => (anySized ? ((w ?? cellMinWidth) / totalWidth) * 100 : null))
  return { columns, percents, style }
}
