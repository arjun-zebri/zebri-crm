/**
 * `setColumnCount` and `resetColumnRatios`, the `columns` node's grow /
 * shrink / reset-ratio commands. Split out of `columns.ts` (which
 * declares and registers them, and owns their public docs in its
 * `declare module` augmentation) to keep that file within its line
 * budget. `node-bar-columns.tsx` (Proposal Layout v2 Phase 2, Task 11)
 * is what calls both, with the node bar's own `node.pos` rather than
 * relying on the cursor sitting inside the row.
 *
 * @module features/proposals/editor/extensions/columns-commands
 */
import type { Command, CommandProps } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { EditorState } from '@tiptap/pm/state'

/** Equal-width ratios for `count` columns, e.g. `equalRatios(2)` -> `[0.5, 0.5]`. */
export function equalRatios(count: 2 | 3): number[] {
  const ratio = Math.round((1 / count) * 100) / 100
  return Array.from({ length: count }, () => ratio)
}

/**
 * Finds the `columns` node a `setColumnCount`/`resetColumnRatios` call
 * should act on. Tried in order: the node directly at `pos` (a
 * `NodeSelection` on the `columns` node itself positions `$from` at the
 * node's own start, one level too shallow for the `$from.node(depth)`
 * walk below to ever land on it), then walking up from `pos` (resolved
 * into the doc) or, with no `pos` at all, the current selection's
 * `$from` - the same walk `columns.ts`'s own `setColumnRatios` does, so
 * a caller with the cursor merely inside a column (no `pos` handy)
 * still works.
 */
function findColumnsAncestor(state: EditorState, pos?: number): { node: ProseMirrorNode; start: number } | null {
  if (pos !== undefined) {
    const direct = state.doc.nodeAt(pos)
    if (direct && direct.type.name === 'columns') return { node: direct, start: pos }
  }
  const $from = pos !== undefined ? state.doc.resolve(pos) : state.selection.$from
  for (let depth = $from.depth; depth >= 0; depth--) {
    const node = $from.node(depth)
    if (node.type.name === 'columns') return { node, start: $from.before(depth) }
  }
  return null
}

/**
 * Grows or shrinks the `columns` row `findColumnsAncestor` finds to
 * `count` columns, always finishing with equal ratios (see `columns.ts`'s
 * `declare module` augmentation for the full command docs).
 */
export function setColumnCount(count: 2 | 3, pos?: number): Command {
  return ({ state, dispatch }: CommandProps): boolean => {
    const found = findColumnsAncestor(state, pos)
    if (!found) return false
    const { node, start } = found
    if (node.childCount === count) return true
    const columnType = state.schema.nodes.column
    const paragraphType = state.schema.nodes.paragraph
    if (!columnType || !paragraphType) return false
    if (dispatch) {
      let children: ProseMirrorNode[] = []
      if (count > node.childCount) {
        // Growing: keep every existing column and append a fresh one
        // with an empty paragraph (the node bar's brief).
        node.forEach((child) => children.push(child))
        for (let i = node.childCount; i < count; i++) {
          children.push(columnType.create(undefined, paragraphType.create()))
        }
      } else {
        // Shrinking (3 -> 2 is the only case, `count` being 2 | 3): keep
        // the first `count - 1` columns untouched, and move every column
        // from `count - 1` on into its neighbour, so no content is
        // silently discarded.
        const kept: ProseMirrorNode[] = []
        const mergedContent: ProseMirrorNode[] = []
        node.forEach((child, _offset, i) => {
          if (i < count - 1) kept.push(child)
          else child.forEach((grandchild) => mergedContent.push(grandchild))
        })
        const merged = columnType.create(undefined, mergedContent.length ? mergedContent : [paragraphType.create()])
        children = [...kept, merged]
      }
      const ratios = equalRatios(count)
      children = children.map((child, i) => child.type.create({ ratio: ratios[i] }, child.content, child.marks))
      const next = state.schema.nodes.columns!.create({ count }, children)
      dispatch(state.tr.replaceWith(start, start + node.nodeSize, next))
    }
    return true
  }
}

/**
 * Resets the `columns` row `findColumnsAncestor` finds to equal ratios
 * (see `columns.ts`'s `declare module` augmentation for the full
 * command docs).
 */
export function resetColumnRatios(pos?: number): Command {
  return ({ state, dispatch }: CommandProps): boolean => {
    const found = findColumnsAncestor(state, pos)
    if (!found) return false
    const { node, start } = found
    if (dispatch) {
      const ratios = equalRatios(node.childCount as 2 | 3)
      const tr = state.tr
      node.forEach((_child, offset, i) => {
        tr.setNodeAttribute(start + 1 + offset, 'ratio', ratios[i])
      })
      dispatch(tr)
    }
    return true
  }
}
