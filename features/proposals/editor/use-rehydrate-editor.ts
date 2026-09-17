'use client'

/**
 * The content-section editor's re-hydration effect (Phase 2 fix report):
 * pushes `content` into a live TipTap `editor` only when `externalVersion`
 * bumps - a real layout change from outside `dispatch` (undo, redo,
 * `replaceLayout`), never an ordinary edit. A plain `content` prop change
 * on its own must never reach the editor: it can be stale mid-transaction
 * (a `useSyncExternalStore` subscriber elsewhere in the tree, e.g. a node
 * bar, can force a synchronous re-render before a batched edit lands),
 * and re-hydrating from it there silently discarded the edit in flight -
 * a live-reproduced bug this closes. Split out of
 * `content-section-editor.tsx` to keep that file near its line budget.
 *
 * @module features/proposals/editor/use-rehydrate-editor
 */
import type { JSONContent } from '@tiptap/core'
import type { Editor } from '@tiptap/react'
import { useEffect, useRef } from 'react'

import { normaliseEditorJSON } from './extensions'

/** Normalised, stringified form of a rich doc, for the cheap editor/content comparison below. */
function fingerprint(json: JSONContent): string {
  return JSON.stringify(normaliseEditorJSON(json))
}

/**
 * Re-hydrates `editor` from `content` whenever `externalVersion` changes,
 * without emitting another update - that would feed the new JSON straight
 * back into the reducer as though the user had just typed it - and keeps
 * the caret roughly where it was rather than snapping to the start of the
 * document. `editor` is created with `content` already (`useEditor` in
 * `content-section-editor.tsx`), so version 0 needs no re-hydration;
 * running the check once on mount anyway is harmless.
 */
export function useRehydrateEditor(editor: Editor | null, content: JSONContent, externalVersion: number): void {
  // Read by the effect below without making it re-run on every ordinary
  // edit - only `externalVersion` bumping does that. Kept in a ref,
  // updated by its own effect, rather than read directly off `content`:
  // reading the prop directly would read whatever value this hook's own
  // render closure captured, which is exactly the stale-mid-transaction
  // value the module doc describes.
  const contentRef = useRef(content)
  useEffect(() => {
    contentRef.current = content
  }, [content])

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    // Both sides normalised: the reducer's `setContent` case only runs
    // `toPlainJSON` (never strips null attrs), and `replaceLayout`
    // (undo/redo, a freshly loaded template) runs no normalisation at
    // all, so an un-normalised `content` is a real possibility, not just
    // a hypothetical. Comparing raw JSON against the normalised editor
    // JSON would treat an unchanged doc as "changed" and force a
    // needless `setContent`.
    if (fingerprint(editor.getJSON()) === fingerprint(contentRef.current)) return
    const prevFrom = editor.state.selection.from
    editor.commands.setContent(contentRef.current, { emitUpdate: false })
    editor.commands.setTextSelection(Math.min(prevFrom, editor.state.doc.content.size))
  }, [editor, externalVersion])
}
