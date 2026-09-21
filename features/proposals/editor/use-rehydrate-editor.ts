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

/**
 * True when `editor` already shows `content`. Compared as ProseMirror
 * nodes (`Node.eq`), not as stringified JSON: the editor's own JSON
 * carries schema defaults the stored doc never had (`title: null` on a
 * link, `caption: ''` on an image) and orders keys differently
 * (`marks` before `text`), so a string comparison called every section
 * holding a link or an image "changed" on mount and forced a needless
 * `setContent` - which reset the caret and rebuilt every node view. An
 * unparseable `content` (never expected: it came through the schema)
 * counts as different, so the `setContent` below still gets to try.
 */
function alreadyShowing(editor: Editor, content: JSONContent): boolean {
  try {
    return editor.state.doc.eq(editor.schema.nodeFromJSON(content))
  } catch {
    return false
  }
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
    if (alreadyShowing(editor, contentRef.current)) return
    // Deferred to a microtask, not run inside the effect: React flushes
    // the passive effects of a sync render (an undo click) while it is
    // still committing, and `setContent` builds the doc's node views
    // through TipTap's `ReactRenderer`, whose constructor calls
    // `flushSync` - which React refuses ("flushSync was called from
    // inside a lifecycle method") when it is already mid-commit. A
    // microtask runs the moment the commit finishes, before the browser
    // paints, so nothing can be observed in between; the guards re-check
    // the editor in case the section unmounted or a newer version landed.
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled || editor.isDestroyed) return
      const prevFrom = editor.state.selection.from
      editor.commands.setContent(contentRef.current, { emitUpdate: false })
      editor.commands.setTextSelection(Math.min(prevFrom, editor.state.doc.content.size))
    })
    return () => {
      cancelled = true
    }
  }, [editor, externalVersion])
}
