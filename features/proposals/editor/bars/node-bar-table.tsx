'use client'

/**
 * The `table` node's control bar: add / delete row, add / delete column,
 * Reset size (clears every column width and the table height, see
 * `extensions/table-commands.ts`) and Remove. Shown while the caret sits
 * anywhere inside a table (`content-section-editor.tsx` reports the
 * enclosing table as the node selection), so the row / column commands
 * act relative to that caret - "Add row" inserts below the caret's row,
 * "Add column" to the right of its column - which is why every command
 * re-`focus()`es the editor first: the click that reached this bar moved
 * focus out of it, and TipTap's table commands act on the editor's
 * selection.
 *
 * The last row / column cannot be deleted from here (the buttons disable
 * at one), since `deleteRow` / `deleteColumn` on a 1×N table would drop
 * the whole table on what reads as a row-level action; Remove is the
 * explicit way to do that.
 *
 * @module features/proposals/editor/bars/node-bar-table
 */
import type { Editor } from '@tiptap/react'
import { useEditorState } from '@tiptap/react'
import { BetweenHorizontalEnd, BetweenVerticalEnd, RotateCcw, TableColumnsSplit, TableRowsSplit, Trash2 } from 'lucide-react'

import { ToolbarDivider } from '@/components/editor'
import { Button } from '@/components/ui/button'
import { ColorPopover } from '@/components/ui/color-popover'
import { Tooltip } from '@/components/ui/tooltip'

import { resetTableSize, tableColumnCount } from '../extensions/table-commands'
import type { NodeSelection } from '../state'

import { writeNodeAttrs } from './node-bar-shared'

/** Props for {@link NodeBarTable}. */
export interface NodeBarTableProps {
  node: NonNullable<NodeSelection>
  editor: Editor
  /** Brand swatches offered by the border colour picker. Defaults to none. */
  swatches?: readonly string[]
}

/** What the picker opens on while the table has no colour of its own (the default border is the text colour at 20%, which has no single hex). */
const DEFAULT_BORDER_SWATCH = '#d1d5db'

/** One icon-only bar button with its tooltip; the same shape every other node bar uses. */
function BarButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip side="top" label={label}>
      <Button variant="ghost" iconOnly aria-label={label} disabled={disabled} onClick={onClick}>
        {children}
      </Button>
    </Tooltip>
  )
}

/** The `table` node's control bar. */
export function NodeBarTable({ node, editor, swatches = [] }: NodeBarTableProps) {
  // Read through `useEditorState` so the disabled states track the live
  // document (a row added from this bar re-enables Delete row at once).
  const shape = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      const table = ed.state.doc.nodeAt(node.pos)
      if (!table || table.type.name !== 'table') return null
      return { rows: table.childCount, cols: tableColumnCount(table), borderColor: typeof table.attrs.borderColor === 'string' ? table.attrs.borderColor : null }
    },
  })
  if (!shape) return null

  const run = (command: (chain: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => () => {
    command(editor.chain().focus()).run()
  }

  return (
    <>
      <BarButton label="Add row below" onClick={run((c) => c.addRowAfter())}>
        <BetweenHorizontalEnd size={14} strokeWidth={1.5} />
      </BarButton>
      <BarButton label="Delete row" disabled={shape.rows <= 1} onClick={run((c) => c.deleteRow())}>
        <TableRowsSplit size={14} strokeWidth={1.5} />
      </BarButton>
      <ToolbarDivider />
      <BarButton label="Add column right" onClick={run((c) => c.addColumnAfter())}>
        <BetweenVerticalEnd size={14} strokeWidth={1.5} />
      </BarButton>
      <BarButton label="Delete column" disabled={shape.cols <= 1} onClick={run((c) => c.deleteColumn())}>
        <TableColumnsSplit size={14} strokeWidth={1.5} />
      </BarButton>
      <ToolbarDivider />
      {/* Border colour: a node attr (`extensions/table.ts`) written with
          `writeNodeAttrs`, never a `chain().focus()...` like the row and
          column commands above: `focus()` moves DOM focus into the editor,
          which the picker's popover reads as focus-outside and closes on
          the first swatch click (live bug, 2026-09-19). `setNodeMarkup`
          targets this table by position, so no caret is needed anyway. */}
      <Tooltip side="top" label="Border colour">
        <ColorPopover
          value={shape.borderColor ?? DEFAULT_BORDER_SWATCH}
          onChange={(borderColor) => writeNodeAttrs(editor, node.pos, { borderColor })}
          swatches={swatches}
          trigger={
            <button type="button" aria-label="Border colour" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control hover:bg-surface-emphasis">
              <span className="h-4 w-4 rounded-control ring-1 ring-black/10" style={{ background: shape.borderColor ?? DEFAULT_BORDER_SWATCH }} />
            </button>
          }
        />
      </Tooltip>
      <ToolbarDivider />
      <BarButton label="Reset size" onClick={() => resetTableSize(editor, node.pos)}>
        <RotateCcw size={14} strokeWidth={1.5} />
      </BarButton>
      <BarButton label="Remove" onClick={run((c) => c.deleteTable())}>
        <Trash2 size={14} strokeWidth={1.5} />
      </BarButton>
    </>
  )
}
