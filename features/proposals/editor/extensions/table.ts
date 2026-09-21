/**
 * The proposal editor's table extensions: TipTap's `Table` extended with
 * the `height` attr from `TableAttrs` (`model/doc.ts`) and column resizing
 * switched on, plus the unchanged row / cell / header nodes.
 *
 * Column widths are prosemirror-tables' own model (`colwidth` on each
 * cell, a `<colgroup>` kept in sync by its `TableView`), which is what
 * the column-border drag writes. Combined with `table-layout: fixed`
 * (`editor-styles.ts`), typing into a cell can only ever grow its row:
 * before this, `resizable: false` under the browser's auto layout re-flowed
 * every column on each keystroke (the 2026-09-19 builder feedback).
 *
 * `lastColumnResizable: false`: the table's right edge belongs to the
 * width grip (`bars/table-resize-overlay.tsx`), which scales every column
 * together; a per-column handle on that same edge would fight it for the
 * pointer.
 *
 * @module features/proposals/editor/extensions/table
 */
import type { JSONContent } from '@tiptap/core'
import { Table, TableCell, TableHeader, TableRow, TableView } from '@tiptap/extension-table'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { AnyExtension } from '@tiptap/react'

import { TABLE_CELL_MIN_WIDTH, type TableAttrs } from '../../model/doc'
import { tableLayout } from '../../render/table-layout'

/**
 * prosemirror-tables' `TableView` (wrapper div, `<colgroup>` synced from
 * `colwidth`, width / min-width from the column sum) plus the table's own
 * `height` attr. Width is deliberately *not* applied here: the resize
 * plugin writes `table.style.width` itself mid-drag, and a competing
 * table-level width would snap back and forth against it.
 */
export class ProposalTableView extends TableView {
  constructor(node: ProseMirrorNode, cellMinWidth: number) {
    super(node, cellMinWidth)
    this.applyHeight(node)
    this.applyBorderColor(node)
    this.applyPercents(node)
  }

  override update(node: ProseMirrorNode): boolean {
    if (!super.update(node)) return false
    this.applyHeight(node)
    this.applyBorderColor(node)
    this.applyPercents(node)
    return true
  }

  private applyHeight(node: ProseMirrorNode): void {
    const { height } = node.attrs as TableAttrs
    this.table.style.height = typeof height === 'number' && height > 0 ? `${height}px` : ''
  }

  /** `--table-border` on the `<table>`, read by every cell's border rule (`editor-styles.ts`), the same variable `render/table-node.tsx` sets on the public page. */
  private applyBorderColor(node: ProseMirrorNode): void {
    const { borderColor } = node.attrs as TableAttrs
    if (borderColor) this.table.style.setProperty('--table-border', borderColor)
    else this.table.style.removeProperty('--table-border')
  }

  /**
   * Stamps each `<col>` with its percentage share (`--col-pct`) the way
   * `render/table-node.tsx` does, so a phone-width canvas shows a sized
   * table at that width with the same proportions (`editor-styles.ts`'s
   * `@max-3xl/doc` rules) rather than scrolling it. The `<col>` elements
   * themselves are prosemirror-tables' (`updateColumns` in `super.update`),
   * so this runs after it, and it also drops the stale inline `width`
   * `updateColumns` leaves on a column that just lost its `colwidth`
   * (Reset size, or a fresh row-less table): TipTap's own
   * `getColStyleDeclaration` only *adds* `min-width` in that case, so the
   * old px width would keep sizing the column until a reload.
   */
  private applyPercents(node: ProseMirrorNode): void {
    const { columns, percents } = tableLayout(node.toJSON() as JSONContent)
    Array.from(this.colgroup.children).forEach((el, i) => {
      const col = el as HTMLElement
      const pct = percents[i]
      if (pct === null || pct === undefined) col.style.removeProperty('--col-pct')
      else col.style.setProperty('--col-pct', `${pct}%`)
      if (columns[i] === null) col.style.removeProperty('width')
    })
  }
}

const HEX = /^#[0-9a-fA-F]{6}$/

/** The `table` node: `Table` plus `TableAttrs.height` / `borderColor`, serialised as `data-height` / `data-border-color` so a pasted/exported table keeps them. */
export const TableExtension = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      height: {
        default: null,
        parseHTML: (el) => {
          const raw = Number(el.getAttribute('data-height'))
          return Number.isFinite(raw) && raw > 0 ? raw : null
        },
        renderHTML: (attrs) => (typeof attrs.height === 'number' ? { 'data-height': String(attrs.height) } : {}),
      },
      borderColor: {
        default: null,
        parseHTML: (el) => {
          const raw = el.getAttribute('data-border-color')
          return raw && HEX.test(raw) ? raw : null
        },
        renderHTML: (attrs) => (typeof attrs.borderColor === 'string' ? { 'data-border-color': attrs.borderColor } : {}),
      },
    }
  },
}).configure({
  resizable: true,
  cellMinWidth: TABLE_CELL_MIN_WIDTH,
  lastColumnResizable: false,
  View: ProposalTableView,
})

/** Every table extension `buildRichDocExtensions` registers, in dependency order. */
export const TABLE_EXTENSIONS: readonly AnyExtension[] = [TableExtension, TableRow, TableHeader, TableCell]
