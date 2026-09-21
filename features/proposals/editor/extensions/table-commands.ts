/**
 * Table helpers the table bar and the table resize grips share: locating
 * the table the caret sits in, and writing every cell's `colwidth` in one
 * transaction (the width grip and Reset size). Row / column insertion and
 * deletion need nothing of their own - TipTap's `addRowAfter`,
 * `addColumnAfter`, `deleteRow`, `deleteColumn` and `deleteTable` act on
 * the current selection already.
 *
 * @module features/proposals/editor/extensions/table-commands
 */
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import type { Editor } from '@tiptap/react'

/**
 * The document position of the `table` node enclosing the selection's
 * head, or `null` when the caret is not inside a table. Walks the resolved
 * position's ancestors (a caret in a cell sits at depth table > row > cell
 * > paragraph), so it also covers a `CellSelection` from a drag across
 * cells, whose `$from` is likewise inside the table.
 */
export function enclosingTablePos(state: EditorState): number | null {
  const { $from } = state.selection
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'table') return $from.before(depth)
  }
  return null
}

/** The number of columns in a table node, counted from its first row (with `colspan`). */
export function tableColumnCount(table: ProseMirrorNode): number {
  const row = table.firstChild
  if (!row) return 0
  let count = 0
  row.forEach((cell) => {
    count += typeof cell.attrs.colspan === 'number' ? cell.attrs.colspan : 1
  })
  return count
}

/**
 * Sets `colwidth` on every cell of the table at `tablePos` from one array
 * of per-column px widths (`null` clears them all, back to a fluid table).
 * A cell spanning several columns takes that many consecutive entries.
 * `setNodeMarkup` never changes a node's size, so cell positions gathered
 * up front stay valid for the whole transaction.
 */
export function writeTableColumnWidths(editor: Editor, tablePos: number, widths: readonly number[] | null): void {
  editor
    .chain()
    .command(({ tr, dispatch }) => {
      const table = tr.doc.nodeAt(tablePos)
      if (!table || table.type.name !== 'table') return false
      if (!dispatch) return true
      applyColumnWidths(tr, table, tablePos, widths)
      dispatch(tr)
      return true
    })
    .run()
}

function applyColumnWidths(tr: Transaction, table: ProseMirrorNode, tablePos: number, widths: readonly number[] | null): void {
  table.forEach((row, rowOffset) => {
    // `+ 1` steps inside the table / row opening tokens to reach the child.
    const rowPos = tablePos + 1 + rowOffset
    let col = 0
    row.forEach((cell, cellOffset) => {
      const span = typeof cell.attrs.colspan === 'number' ? cell.attrs.colspan : 1
      const colwidth = widths ? widths.slice(col, col + span) : null
      tr.setNodeMarkup(rowPos + 1 + cellOffset, undefined, { ...cell.attrs, colwidth })
      col += span
    })
  })
}

/** Clears every column width and the table's own `height`: the bar's Reset size. */
export function resetTableSize(editor: Editor, tablePos: number): void {
  editor
    .chain()
    .command(({ tr, dispatch }) => {
      const table = tr.doc.nodeAt(tablePos)
      if (!table || table.type.name !== 'table') return false
      if (!dispatch) return true
      applyColumnWidths(tr, table, tablePos, null)
      tr.setNodeMarkup(tablePos, undefined, { ...table.attrs, height: null })
      dispatch(tr)
      return true
    })
    .run()
}
