/**
 * Which node, if any, the editor selection "is on", for the layout
 * editor's node selection (`state.ts`'s `NodeSelection`): a ProseMirror
 * `NodeSelection` on an atom node or the `columns` row (the one non-atom
 * node view that selects as a whole, see `node-views/select-node.ts`), or
 * the table enclosing a caret. A table is never a `NodeSelection` itself
 * (the caret sits in a cell), so it is reported at the table's own
 * position, which is what lets the table bar and its resize grips anchor
 * to the whole table rather than to the cell.
 *
 * @module features/proposals/editor/node-selection-for
 */
import { NodeSelection, type EditorState } from '@tiptap/pm/state'

import { enclosingTablePos } from './extensions/table-commands'

/** A node selection report: the node's TipTap type and document position. */
export interface NodeSelectionReport {
  nodeType: string
  pos: number
}

/** See the module doc. `null` for a plain caret / text selection outside any table. */
export function nodeSelectionFor(state: EditorState): NodeSelectionReport | null {
  const { selection } = state
  if (selection instanceof NodeSelection && (selection.node.isAtom || selection.node.type.name === 'columns')) {
    return { nodeType: selection.node.type.name, pos: selection.from }
  }
  const tablePos = enclosingTablePos(state)
  return tablePos !== null ? { nodeType: 'table', pos: tablePos } : null
}
