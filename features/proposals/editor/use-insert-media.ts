'use client'

/**
 * Wires `requestImage`/`requestAudio`/`requestEmbed`
 * (`extensions/proposal-editor-storage.ts`) through every mounted section
 * editor's storage to `InsertMediaHost`'s imperative `open` handle, so
 * `INSERT_ITEMS`' image/audio/embed rows (`insert-items.ts`) have
 * somewhere to land instead of being a silent no-op.
 *
 * Mirrors `use-editor-shortcuts.ts` exactly: registers on every
 * registered editor (`editor-registry.ts`), not only the selected
 * section's, since any one of them can be the DOM-focused editor when its
 * own insert menu fires the request - and takes the host's `hostRef`
 * directly (rather than three caller-built callbacks) for the same reason
 * `use-editor-shortcuts.ts` takes `textBarRef`: the `.current?.open(...)`
 * indirection lives in one place instead of at every call site.
 *
 * @module features/proposals/editor/use-insert-media
 */
import { useEffect, type RefObject } from 'react'

import { useRegisteredEditors } from './editor-registry'
import type { InsertMediaHandle } from './insert-media-host'

/** Options for {@link useInsertMedia}. */
export interface UseInsertMediaOptions {
  /** The ref `template-editor-body.tsx` passes to the mounted `InsertMediaHost`; a no-op while it has not mounted yet. */
  hostRef: RefObject<InsertMediaHandle | null>
}

/**
 * Sets the `requestImage`/`requestAudio`/`requestEmbed` callbacks on every
 * mounted section editor. Re-runs whenever the set of mounted editors
 * changes - not on every keystroke, since `hostRef` is a stable ref
 * object across renders.
 */
export function useInsertMedia({ hostRef }: UseInsertMediaOptions): void {
  const editors = useRegisteredEditors()

  useEffect(() => {
    for (const editor of editors) {
      if (editor.isDestroyed) continue
      editor.commands.setProposalEditorCallbacks({
        requestImage: () => hostRef.current?.open('image', editor),
        requestAudio: () => hostRef.current?.open('audio', editor),
        requestEmbed: () => hostRef.current?.open('embed', editor),
      })
    }
  }, [editors, hostRef])
}
