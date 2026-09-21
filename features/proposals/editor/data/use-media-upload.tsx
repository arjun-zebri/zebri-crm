'use client'

/**
 * Shared upload picker for the data-section editors (Slice E2, UX audit
 * 3.4): gallery photos, a video upload, and a testimonial portrait all
 * open the same hidden file input and share the same busy/error pill
 * (`../insert-media-status-pill.tsx`), the way `../insert-media-host.tsx`
 * does for a TipTap section's own image/audio insert menu. A fresh hook
 * instance per caller (not one host mounted once for the whole editor,
 * like that one) - each data-section field needing an upload mounts and
 * unmounts on its own, unlike the always-mounted rich-text toolbar that
 * host serves.
 *
 * @module features/proposals/editor/data/use-media-upload
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { MEDIA_LIMITS, uploadProposalMediaFile, type MediaKind } from '../../data/media'
import { InsertMediaStatusPill, type InsertMediaStatus } from '../insert-media-status-pill'

/** A pending file-pick request: set by `pick`, cleared once the input's `change` event (or a cancelled dialog) resolves it. */
interface PendingPick {
  kind: MediaKind
  multiple: boolean
  onDone: (urls: string[]) => void
}

/** Return value of {@link useMediaUpload}. */
export interface UseMediaUploadResult {
  /**
   * Opens the OS file picker for `kind`. `onDone` fires once, with every
   * picked file's uploaded public URL in picked order - never partially -
   * so a single-file caller (the testimonial photo, a video upload) can
   * just read `urls[0]`.
   */
  pick: (kind: MediaKind, opts: { multiple?: boolean } | undefined, onDone: (urls: string[]) => void) => void
  /** The in-flight (or failed) upload, for a caller that wants to react to it beyond the pill this hook already renders. */
  status: InsertMediaStatus | null
  /** The hidden file input plus the busy/error pill (`InsertMediaStatusPill`); render this once alongside whatever UI calls `pick`. */
  input: ReactNode
}

/** One hidden file input + status pill, reusable anywhere a data-section field needs to upload proposal media. */
export function useMediaUpload(): UseMediaUploadResult {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<PendingPick | null>(null)
  const [status, setStatus] = useState<InsertMediaStatus | null>(null)

  const pick: UseMediaUploadResult['pick'] = (kind, opts, onDone) => {
    setPending({ kind, multiple: opts?.multiple ?? false, onDone })
  }

  // Fires after the re-render that set `pending`, not inside `pick` itself:
  // the OS file dialog reads the input's `accept`/`multiple` attributes at
  // the moment it opens, and those only reflect the new request once this
  // component has actually re-rendered with it (mirrors `insert-media-host.tsx`).
  useEffect(() => {
    if (pending) inputRef.current?.click()
  }, [pending])

  const handleFiles = (files: File[]) => {
    const request = pending
    setPending(null)
    if (!request || files.length === 0) return
    const list = files
    setStatus({ kind: request.kind, pct: 0 })
    // Each file reports its own progress independently; a multi-file pick's
    // pill shows whichever upload last reported, which is good enough for
    // the small counts (<=12 gallery photos) this hook ever sees at once.
    Promise.all(list.map((file) => uploadProposalMediaFile(file, request.kind, (pct) => setStatus({ kind: request.kind, pct }))))
      .then((urls) => {
        setStatus(null)
        request.onDone(urls)
      })
      .catch((err: unknown) => setStatus({ kind: request.kind, pct: 0, error: err instanceof Error ? err.message : 'Upload failed' }))
  }

  const input = (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple={pending?.multiple}
        accept={pending ? MEDIA_LIMITS[pending.kind].types.join(',') : undefined}
        className="hidden"
        onChange={(e) => {
          // Copy before resetting: `files` is a live FileList that empties
          // the moment `value` is cleared, and the reset is what lets the
          // same file be picked twice in a row.
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (files.length > 0) handleFiles(files)
          else setPending(null)
        }}
      />
      {status ? <InsertMediaStatusPill status={status} onDismiss={() => setStatus(null)} /> : null}
    </>
  )

  return { pick, status, input }
}
