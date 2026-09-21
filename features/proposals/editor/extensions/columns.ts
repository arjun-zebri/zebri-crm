/**
 * The `columns` / `column` nodes (spec §2.2): a 2- or 3-up row. `columns`
 * only ever holds `column` children, and `column` holds the same block
 * content as the rest of the doc minus `columns` itself, so a columns row
 * can never nest inside its own cell.
 *
 * @module features/proposals/editor/extensions/columns
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { ColumnsView } from '../node-views/columns-view'

import { equalRatios, resetColumnRatios, setColumnCount } from './columns-commands'

// Everything the doc allows at block level except `columns`, so a column
// cell cannot nest another columns row (spec §2.2).
const COLUMN_CONTENT =
  '(paragraph | heading | bulletList | orderedList | blockquote | image | button | embed | audio | spacer | horizontalRule | table)+'

/** Attributes stored on a `columns` node. */
export interface ColumnsNodeAttrs {
  count: 2 | 3
}
/** Attributes stored on a `column` node. */
export interface ColumnNodeAttrs {
  ratio: number
}

/** One cell of a `columns` row. Restricted content keeps `columns` from nesting inside itself. */
export const ColumnExtension = Node.create({
  name: 'column',
  content: COLUMN_CONTENT,

  addAttributes() {
    return {
      // `style`/`class` mirror `render/rich-doc-nodes.tsx`'s `ColumnsFrame`
      // (the public renderer's per-column `flex` rule and its
      // `min-w-0 @max-3xl/doc:!flex-auto` classes): the editor's own
      // contentEditable DOM has no React tree to apply those from, so
      // they are carried as plain attributes here instead, keeping the
      // editable columns visually proportional to their `ratio` (and not
      // overrunning it with a long word or a wide image) even before the
      // `columns` node view (Task 7) measures anything.
      ratio: {
        default: 0.5,
        parseHTML: (el: HTMLElement) => Number(el.getAttribute('data-ratio')) || 0.5,
        renderHTML: (attrs: ColumnNodeAttrs) => ({
          'data-ratio': attrs.ratio,
          style: `flex: ${attrs.ratio} 1 0%`,
          class: 'min-w-0 @max-3xl/doc:!flex-auto',
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-node="column"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-node': 'column' }), 0]
  },
})

/** Options for {@link ColumnsExtension}. */
export interface ColumnsOptions {
  /** Render the React `ColumnsView` node view (the flex wrapper plus gutter resize grips) instead of the plain `renderHTML` DOM. `column` children keep rendering through their own `renderHTML` either way (no per-column node view). */
  nodeViews: boolean
}

/** A 2- or 3-up row of `column` children. Renders through `ColumnsView` (a React NodeView) when `nodeViews` is configured on. */
export const ColumnsExtension = Node.create<ColumnsOptions>({
  name: 'columns',
  group: 'block',
  content: 'column{2,3}',

  addOptions() {
    return { nodeViews: false }
  },

  addNodeView() {
    return this.options.nodeViews ? ReactNodeViewRenderer(ColumnsView) : null
  },

  addAttributes() {
    return {
      count: { default: 2, parseHTML: (el: HTMLElement) => (Number(el.getAttribute('data-count')) === 3 ? 3 : 2), renderHTML: (attrs: ColumnsNodeAttrs) => ({ 'data-count': attrs.count }) },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-node="columns"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-node': 'columns' }), 0]
  },

  addCommands() {
    return {
      insertColumns:
        (count: 2 | 3) =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: { count },
              content: equalRatios(count).map((ratio) => ({ type: 'column', attrs: { ratio }, content: [{ type: 'paragraph' }] })),
            })
            .run(),

      setColumnRatios:
        (ratios: number[]) =>
        ({ state, dispatch }) => {
          // Walk up from the selection to the nearest `columns` ancestor,
          // so callers can invoke this with the cursor anywhere inside a
          // column, not only when the row itself is selected.
          const { $from } = state.selection
          for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth)
            if (node.type.name !== 'columns') continue
            if (node.childCount !== ratios.length) return false
            if (dispatch) {
              const tr = state.tr
              const start = $from.before(depth) + 1
              node.forEach((_child, offset, i) => {
                tr.setNodeAttribute(start + offset, 'ratio', ratios[i])
              })
              dispatch(tr)
            }
            return true
          }
          return false
        },

      // `setColumnCount`/`resetColumnRatios` bodies live in
      // `columns-commands.ts`, which keeps this file within its line
      // budget; the docs for both are on the `declare module`
      // augmentation below, the one place every other command's docs
      // live too.
      setColumnCount,
      resetColumnRatios,
    }
  },
})

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    columns: {
      /** Insert a fresh `count`-up columns row with equal ratios and an empty paragraph in each cell. */
      insertColumns: (count: 2 | 3) => ReturnType
      /** Set the ratios of the `columns` row containing the current selection; `false` if the count doesn't match. */
      setColumnRatios: (ratios: number[]) => ReturnType
      /**
       * Grow or shrink the `columns` row at `pos` (or containing the
       * current selection, with no `pos`) to `count` columns: growing
       * appends an equal-ratio column with an empty paragraph, shrinking
       * merges the trailing column(s) into their neighbour. Always
       * finishes with equal ratios. `false` if no `columns` ancestor is
       * found.
       */
      setColumnCount: (count: 2 | 3, pos?: number) => ReturnType
      /** Reset the `columns` row at `pos` (or containing the current selection) to equal ratios. `false` if no `columns` ancestor is found. */
      resetColumnRatios: (pos?: number) => ReturnType
    }
  }
}
