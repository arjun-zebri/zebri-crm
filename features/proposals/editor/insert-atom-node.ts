/**
 * Shared insertion primitive for `insert-media-host.tsx`'s two flows
 * (upload-then-insert for image/audio, prompt-then-insert for embed):
 * insert an atom node at the current selection and leave it node-selected,
 * so the matching node bar (`bars/node-bar.tsx`) opens immediately for a
 * follow-up edit - exactly what happens when an MC clicks an existing
 * node (`node-views/select-node.ts`).
 *
 * Not TipTap's plain `chain().insertContent(...)`, which every other
 * `INSERT_ITEMS` entry (button, columns, spacer, table, ...) uses: that
 * leaves a plain `TextSelection` after the inserted node, never a
 * `NodeSelection`, so nothing here would open its node bar on its own.
 *
 * @module features/proposals/editor/insert-atom-node
 */
import { NodeSelection } from '@tiptap/pm/state'
import type { Editor } from '@tiptap/react'

/**
 * Insert a fresh `type` node carrying `attrs` at the current selection,
 * then select it.
 *
 * A `{ from, to }` captured before the insert cannot be reused afterward
 * to address the new node directly: `type` here is always a `group:
 * 'block'` atom (image/audio/embed), and the current selection is
 * routinely a text cursor *inside* a paragraph - ProseMirror resolves
 * "insert a block at a position inside inline content" by placing the
 * block outside that paragraph (splitting it, or landing before/after
 * it), not literally at the inline offset given, so the block's real
 * resting position is not knowable in advance. `attrs` is always
 * distinctive enough to find afterward instead (image/audio always carry
 * a freshly-uploaded, unique `src`; embed always carries the one `url`
 * just validated).
 */
export function insertAtomNode(editor: Editor, type: string, attrs: Record<string, unknown>): void {
  const { selection } = editor.state
  // A node selection is never replaced, only inserted after: a section
  // whose doc starts with an image holds a NodeSelection on it before
  // anyone clicks in (ProseMirror's `Selection.atStart`), and replacing
  // the selection there silently swapped that image for the new one when
  // an image was inserted from the library (audit pass 2 live check).
  const from = selection instanceof NodeSelection ? selection.to : selection.from
  const to = selection.to
  editor.chain().focus().insertContentAt({ from, to }, { type, attrs }).run()
  const pos = findNodeByAttrs(editor, type, attrs)
  if (pos !== null) editor.commands.setNodeSelection(pos)
}

/**
 * The position of the first `type` node whose attrs are a superset of
 * `attrs`, or `null` if none matches. Known limit: an earlier node with
 * identical attrs (the same embed url pasted twice) wins over the one
 * just inserted, so the selection lands on the older twin; uploads never
 * hit this (every upload key is unique), embeds rarely do, and the only
 * effect is which of two identical nodes gets the node bar.
 */
function findNodeByAttrs(editor: Editor, type: string, attrs: Record<string, unknown>): number | null {
  let found: number | null = null
  editor.state.doc.descendants((node, pos) => {
    if (found !== null) return false
    if (node.type.name === type && Object.entries(attrs).every(([key, value]) => node.attrs[key] === value)) {
      found = pos
      return false
    }
    return true
  })
  return found
}
