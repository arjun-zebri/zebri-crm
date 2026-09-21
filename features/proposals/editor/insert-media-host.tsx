'use client'

/**
 * Mounted once for the whole template editor (`template-editor-body.tsx`,
 * beside `useEditorShortcuts`), this is where "Image"/"Audio"/"Embed" in
 * the `/` slash menu and the text bar's `+` menu (`insert-items.ts`)
 * actually land: `use-insert-media.ts` wires this component's `open`
 * handle into every registered editor's `proposalEditor.callbacks`
 * (`extensions/proposal-editor-storage.ts`), so any section's insert menu
 * can reach it regardless of which section is currently selected - same
 * split as `text-bar.tsx`'s `TextBarHandle` + `use-editor-shortcuts.ts`.
 *
 * Renders nothing visible until a request comes in: the image chooser
 * modal (`image-insert-modal.tsx`: the account's image library plus an
 * Upload button), a hidden file input for audio (upload via
 * `uploadProposalMediaFile`, then `insertAtomNode`), a floating
 * upload-status pill (`insert-media-status-pill.tsx`) while that audio
 * upload is in flight or has failed, and the embed url modal
 * (`embed-insert-modal.tsx`).
 *
 * Before this host existed, `INSERT_ITEMS`' image/audio/embed items were
 * a silent no-op (final review Finding 3) and the slash menu's old direct
 * "Embed" insert left a `url: null` placeholder that broke every autosave
 * on the template (Finding 2) - this host is the fix for both.
 *
 * @module features/proposals/editor/insert-media-host
 */
import type { Editor } from '@tiptap/react'
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'

import { MEDIA_LIMITS, uploadProposalMediaFile, type MediaKind } from '../data/media'

import { EmbedInsertModal } from './embed-insert-modal'
import { ImageInsertModal } from './image-insert-modal'
import { insertAtomNode } from './insert-atom-node'
import { InsertMediaStatusPill, type InsertMediaStatus } from './insert-media-status-pill'

/** The one kind this host uploads a file for directly; `image` opens the library chooser and `embed` a url prompt instead, see {@link InsertMediaHandle.open}. */
type FileKind = Extract<MediaKind, 'audio'>

/** Imperative handle `use-insert-media.ts` drives from any registered editor's storage callback. */
export interface InsertMediaHandle {
  /** Opens the image chooser (`image`), the file picker (`audio`) or the embed url modal (`embed`), targeting `editor` - the editor whose insert menu made the request, not necessarily the currently selected section. */
  open: (kind: FileKind | 'image' | 'embed', editor: Editor) => void
}

/** A pending file-pick request: set by `open`, cleared once the input's `change` event (or a cancelled dialog) resolves it. */
interface FilePick {
  kind: FileKind
  editor: Editor
}

/** A filename's title with its extension stripped, for a freshly-uploaded audio node's default `title`. */
function titleFromFileName(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

/** Props for {@link InsertMediaHost}. */
export interface InsertMediaHostProps {
  ref?: Ref<InsertMediaHandle> | undefined
}

/** The insert-media host: no visible chrome of its own until a request opens the file picker, the status pill, or the embed modal. */
export function InsertMediaHost({ ref }: InsertMediaHostProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pick, setPick] = useState<FilePick | null>(null)
  const [status, setStatus] = useState<InsertMediaStatus | null>(null)
  const [embedEditor, setEmbedEditor] = useState<Editor | null>(null)
  const [imageEditor, setImageEditor] = useState<Editor | null>(null)

  useImperativeHandle(ref, () => ({
    open: (kind, editor) => {
      if (kind === 'embed') {
        setEmbedEditor(editor)
        return
      }
      if (kind === 'image') {
        setImageEditor(editor)
        return
      }
      setPick({ kind, editor })
    },
  }), [])

  // Fires after the re-render that set `pick`, not inside `open` itself:
  // the OS file dialog reads the input's `accept` attribute at the moment
  // it opens, and that attribute only reflects the new `kind` once this
  // component has actually re-rendered with it.
  useEffect(() => {
    if (pick) inputRef.current?.click()
  }, [pick])

  const handleFile = (file: File) => {
    const request = pick
    setPick(null)
    if (!request) return
    const { kind, editor } = request
    setStatus({ kind, pct: 0 })
    uploadProposalMediaFile(file, kind, (pct) => setStatus({ kind, pct }))
      .then((src) => {
        insertAtomNode(editor, kind, { src, title: titleFromFileName(file.name) })
        setStatus(null)
      })
      .catch((err: unknown) => setStatus({ kind, pct: 0, error: err instanceof Error ? err.message : 'Upload failed' }))
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={pick ? MEDIA_LIMITS[pick.kind].types.join(',') : undefined}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) handleFile(file)
          else setPick(null)
        }}
      />
      {status ? <InsertMediaStatusPill status={status} onDismiss={() => setStatus(null)} /> : null}
      <ImageInsertModal editor={imageEditor} onClose={() => setImageEditor(null)} />
      <EmbedInsertModal editor={embedEditor} onClose={() => setEmbedEditor(null)} />
    </>
  )
}
