'use client'

/**
 * What every node bar (`node-bar-image.tsx`, `node-bar-button.tsx`,
 * `node-bar-embed.tsx`, `node-bar-audio.tsx`, `node-bar-columns.tsx`,
 * `node-bar-spacer.tsx`) shares: a reactive attrs read, a merge-patch
 * write, node removal, and the Replace-by-upload button the image and
 * audio bars both need. Kept separate from `node-bar.tsx` (the
 * dispatcher, which imports every sub-bar) so importing these helpers
 * from a sub-bar never creates a module cycle back through the
 * dispatcher.
 *
 * @module features/proposals/editor/bars/node-bar-shared
 */
import type { Editor } from '@tiptap/react'
import { useEditorState } from '@tiptap/react'
import { Upload } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'

import { uploadProposalMediaFile, type MediaKind } from '../../data/media'

/** A section summary the button bar's "Jump to section" target lists. */
export interface NodeBarSection {
  id: string
  name?: string
  kind: string
}

/**
 * Reads `pos`'s live attrs from the editor's current document, re-rendering
 * the calling component on every transaction the way `text-bar.tsx`'s
 * `useEditorState` read does (see that file's module doc for why a plain
 * `editor.state.doc.nodeAt(pos)` call in the render body is not enough).
 * `undefined` once `pos` no longer holds a `nodeType` node - removed
 * outright, or (ProseMirror keeps a doc's top level non-empty, so
 * deleting the document's only node backfills an empty paragraph in its
 * place) replaced by a different node type - rather than reading `attrs`
 * off whatever unrelated node now sits there: a paragraph has no
 * `title`/`label`/etc. of its own, so returning its attrs here fed a
 * bar's `Input` a `value` that flipped from a string to `undefined`
 * without the bar itself unmounting, tripping React's
 * controlled-to-uncontrolled-input warning.
 */
export function useNodeAttrs<A>(editor: Editor, pos: number, nodeType: string): A | undefined {
  return useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      const node = ed.state.doc.nodeAt(pos)
      return node && node.type.name === nodeType ? (node.attrs as A) : undefined
    },
  })
}

/**
 * Merges `patch` into the node at `pos`'s attrs. Goes through
 * `tr.setNodeMarkup` inside a plain `command`, not the brief's own
 * `chain().focus().updateAttributes(...)`: `focus()` moves DOM focus onto
 * the ProseMirror content, which would steal it away from whichever bar
 * `Input` the caller is typing into (label, caption, alt, title, URL) on
 * every keystroke. A no-op (`return false`) once the node is gone, same
 * reasoning as {@link useNodeAttrs}.
 */
export function writeNodeAttrs(editor: Editor, pos: number, patch: Record<string, unknown>): void {
  editor
    .chain()
    .command(({ tr, dispatch }) => {
      const node = tr.doc.nodeAt(pos)
      if (!node) return false
      if (dispatch) dispatch(tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...patch }))
      return true
    })
    .run()
}

/** Deletes the node at `pos`, per the brief: `setNodeSelection` then `deleteSelection`. */
export function removeNode(editor: Editor, pos: number): void {
  editor.chain().setNodeSelection(pos).deleteSelection().run()
}

/** Props for {@link NodeBarUpload}. */
export interface NodeBarUploadProps {
  /** Passed straight to `uploadProposalMediaFile`: the storage sub-folder and which `MEDIA_LIMITS` entry gates type/size. */
  kind: MediaKind
  /** The file input's `accept`, from `MEDIA_LIMITS[kind].types`. */
  accept: string
  /** Accessible name and tooltip label, e.g. "Replace". */
  label: string
  onUploaded: (url: string) => void
}

/**
 * The Replace-by-upload control the image and audio bars share: a hidden
 * file input triggered by a busy icon `Button`, mirroring
 * `section-background-tabs.tsx`'s `UploadTab` file-pick pattern at icon
 * size instead of a full-width popover button.
 */
export function NodeBarUpload({ kind, accept, label, onUploaded }: NodeBarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          setUploading(true)
          setError(undefined)
          uploadProposalMediaFile(file, kind)
            .then(onUploaded)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Upload failed'))
            .finally(() => setUploading(false))
        }}
      />
      <Tooltip side="top" label={error ?? label}>
        <Button variant="ghost" iconOnly loading={uploading} aria-label={label} onClick={() => inputRef.current?.click()}>
          <Upload size={14} strokeWidth={1.5} />
        </Button>
      </Tooltip>
    </>
  )
}
