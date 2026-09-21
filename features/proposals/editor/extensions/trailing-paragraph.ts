/**
 * Keeps an empty paragraph after a block atom that ends a table cell or a
 * column, so the author always has somewhere to click and type below it.
 *
 * TipTap's own `trailingNode` (in `StarterKit`) does this for the document
 * root only. Inside a cell the same gap was a dead end: inserting an image
 * into an empty cell replaced the cell's one paragraph with the image
 * (`insertContentAt` swaps out an empty text block), and with nothing
 * after it there was no text position to click into, so the `/` menu
 * could not open there and the cell read as "image only" (2026-09-19).
 * Enter on the selected image did create a paragraph, but nothing hinted
 * at that.
 *
 * An `appendTransaction` plugin: after any document change it walks the
 * new doc and appends a paragraph to every `tableCell`, `tableHeader` and
 * `column` whose last child is not a text block, plus one pass in
 * `onCreate` for the initial document (see there), so a saved cell that
 * already ends in an image is repaired the moment it is opened.
 *
 * @module features/proposals/editor/extensions/trailing-paragraph
 */
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state'

/** Containers this keeps open-ended; the doc root is `trailingNode`'s. */
const CONTAINERS = new Set(['tableCell', 'tableHeader', 'column'])

const key = new PluginKey('proposalTrailingParagraph')

/**
 * A transaction appending an empty paragraph to every container whose
 * last child is not a text block, or `null` when none needs one.
 */
function repair(state: EditorState): Transaction | null {
  const paragraph = state.schema.nodes.paragraph
  if (!paragraph) return null
  // Collected first, then inserted from the end, so earlier insertions
  // never shift the positions of later ones.
  const ends: number[] = []
  state.doc.descendants((node, pos) => {
    if (!CONTAINERS.has(node.type.name)) return true
    const last = node.lastChild
    if (last && !last.isTextblock) ends.push(pos + node.nodeSize - 1)
    return true
  })
  if (ends.length === 0) return null
  const tr = state.tr
  for (const end of ends.reverse()) tr.insert(end, paragraph.create())
  return tr
}

/** See the module doc. */
export const TrailingParagraphExtension = Extension.create({
  name: 'trailingParagraph',

  // The initial document is built straight into the editor state, not
  // through a transaction, so `appendTransaction` never sees it: a saved
  // cell already ending in an image is repaired here instead, once, as
  // the editor comes up (TipTap emits `create` on the tick after the view
  // exists, so the dispatch lands on a fully wired editor).
  onCreate() {
    const tr = repair(this.editor.state)
    if (tr) this.editor.view.dispatch(tr)
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        appendTransaction: (transactions, _old, state) => (transactions.some((tr) => tr.docChanged) ? repair(state) : null),
      }),
    ]
  },
})
