'use client'

/**
 * Hover controls for adding and removing table rows and columns.
 *
 * The toolbar's table icon only inserts a table; everything after that happens
 * here, next to the cell you are already looking at. Two pills follow the
 * hovered cell: one on its right edge for the column, one on its bottom edge
 * for the row. Each offers add-after and delete.
 *
 * Positioning is measured from `getBoundingClientRect` on both the cell and
 * the container, so it stays correct while the editor scrolls.
 *
 * @module components/ui/rich-text-table-controls
 */

import type { Editor } from '@tiptap/react'
import { Plus, X } from 'lucide-react'
import { useEffect, useState, type RefObject } from 'react'

/** Rendered size of a control pill, and the minimum gap from the editor edge. */
const PILL_W = 38
const PILL_H = 18
const EDGE = 2

export interface TableHoverControlsProps {
  editor: Editor
  /** The positioned wrapper the controls are placed inside. */
  containerRef: RefObject<HTMLDivElement | null>
}

/** Add / delete pair for one axis of the hovered cell. */
function ControlPill({
  style,
  onAdd,
  onDelete,
  addTitle,
  deleteTitle,
}: {
  style: React.CSSProperties
  onAdd: () => void
  onDelete: () => void
  addTitle: string
  deleteTitle: string
}) {
  // `onMouseDown` with preventDefault, not `onClick`: a click would first move
  // focus out of the editor and collapse the selection the command needs.
  const handler = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault()
    fn()
  }
  return (
    <div
      data-table-control
      className="absolute z-10 flex items-center gap-px rounded-pill border border-border bg-surface shadow-sm"
      style={style}
    >
      <button
        type="button"
        title={addTitle}
        onMouseDown={handler(onAdd)}
        className="flex h-4 w-4 items-center justify-center rounded-pill text-text-muted hover:bg-surface-emphasis hover:text-text cursor-pointer"
      >
        <Plus size={11} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        title={deleteTitle}
        onMouseDown={handler(onDelete)}
        className="flex h-4 w-4 items-center justify-center rounded-pill text-text-subtle hover:bg-surface-emphasis hover:text-danger cursor-pointer"
      >
        <X size={11} strokeWidth={1.5} />
      </button>
    </div>
  )
}

/**
 * Renders the hover controls for whichever table cell the pointer is over.
 *
 * @returns Nothing when the pointer is outside a table.
 */
export function TableHoverControls({ editor, containerRef }: TableHoverControlsProps) {
  // The cell AND its measured box live in state together: reading the ref or
  // calling getBoundingClientRect during render is not allowed, and the
  // geometry only changes when the hovered cell does.
  const [target, setTarget] = useState<{
    cell: HTMLElement
    /** Centre of the hovered COLUMN, and top of the table it belongs to. */
    columnCentreX: number
    tableTop: number
    /** Centre of the hovered ROW, and left edge of the table. */
    rowCentreY: number
    tableLeft: number
  } | null>(null)

  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    /**
     * Anchor the controls to the whole row and whole column, not the hovered
     * cell: a `+` floating beside one cell reads as acting on that cell.
     * The column control centres on the column and sits at the table's top
     * edge; the row control centres on the row and sits at its left edge.
     */
    const measure = (cell: HTMLElement) => {
      const cellBox = cell.getBoundingClientRect()
      const rowBox = (cell.closest('tr') ?? cell).getBoundingClientRect()
      const tableBox = (cell.closest('table') ?? cell).getBoundingClientRect()
      const rootBox = root.getBoundingClientRect()
      return {
        cell,
        columnCentreX: cellBox.left + cellBox.width / 2 - rootBox.left,
        tableTop: tableBox.top - rootBox.top,
        rowCentreY: rowBox.top + rowBox.height / 2 - rootBox.top,
        tableLeft: tableBox.left - rootBox.left,
      }
    }

    const onMove = (event: MouseEvent) => {
      const node = event.target as HTMLElement | null
      // Reaching for a control means leaving the cell. Without this the
      // controls unmount the moment the pointer moves toward them and can
      // never be clicked.
      if (node?.closest?.('[data-table-control]')) return
      const hit = node?.closest?.('td, th')
      const cell = hit instanceof HTMLElement && root.contains(hit) ? hit : null
      // mousemove fires constantly; only re-render when the cell changes.
      setTarget((current) => {
        if (!cell) return current === null ? current : null
        return current?.cell === cell ? current : measure(cell)
      })
    }
    const onLeave = () => setTarget(null)

    root.addEventListener('mousemove', onMove)
    root.addEventListener('mouseleave', onLeave)
    return () => {
      root.removeEventListener('mousemove', onMove)
      root.removeEventListener('mouseleave', onLeave)
    }
  }, [containerRef])

  if (!target || !editor.isEditable) return null

  /**
   * Put the cursor in the hovered cell before running a command: the table
   * commands act on the current selection, which is otherwise wherever the
   * user last typed.
   */
  const inCell = (fn: () => void) => () => {
    try {
      // Resolve against the paragraph inside the cell, not the cell itself:
      // `posAtDOM(td, 0)` yields a block boundary that is not a valid text
      // position, so the selection lands outside the table and the command
      // silently no-ops.
      const inner = target.cell.querySelector('p') ?? target.cell
      editor.chain().focus().setTextSelection(editor.view.posAtDOM(inner, 0)).run()
    } catch {
      // posAtDOM throws if the node has already been detached (a fast
      // hover-then-delete). Bail rather than run a command on a stale cell.
      return
    }
    fn()
  }

  return (
    <>
      <ControlPill
        style={{
          // Straddles the table's top edge, centred on the column. Clamped so
          // the editor's `overflow-hidden` can never clip it.
          top: Math.max(EDGE, target.tableTop - PILL_H / 2),
          left: Math.max(EDGE, target.columnCentreX - PILL_W / 2),
        }}
        addTitle="Add column after"
        deleteTitle="Delete column"
        onAdd={inCell(() => editor.chain().focus().addColumnAfter().run())}
        onDelete={inCell(() => editor.chain().focus().deleteColumn().run())}
      />
      <ControlPill
        style={{
          // Straddles the table's left edge, centred on the row.
          top: Math.max(EDGE, target.rowCentreY - PILL_H / 2),
          left: Math.max(EDGE, target.tableLeft - PILL_W / 2),
        }}
        addTitle="Add row below"
        deleteTitle="Delete row"
        onAdd={inCell(() => editor.chain().focus().addRowAfter().run())}
        onDelete={inCell(() => editor.chain().focus().deleteRow().run())}
      />
    </>
  )
}
