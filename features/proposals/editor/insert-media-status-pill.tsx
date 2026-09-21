'use client'

/**
 * The small floating pill `InsertMediaHost` shows while an image/audio
 * upload it started is in flight, or once it has failed: anchored
 * bottom-centre of the canvas, the same `pointer-events-none` wrapper +
 * `pointer-events-auto` inner pattern `template-editor-body.tsx` uses for
 * the section/node-bar overlay strip, so it never blocks a click on the
 * canvas beneath it except over its own pill.
 *
 * `kind` widened to the full `MediaKind` (Slice E2): `data/use-media-upload.ts`
 * reuses this same pill for a gallery photo, a video upload and a
 * testimonial portrait, none of which are `InsertMediaHost`'s own
 * image/audio insert menu.
 *
 * @module features/proposals/editor/insert-media-status-pill
 */
import { Button } from '@/components/ui/button'

import type { MediaKind } from '../data/media'

/** One upload's current state, as tracked by `InsertMediaHost` or `use-media-upload.ts`. */
export interface InsertMediaStatus {
  kind: MediaKind
  /** 0-100. Ignored once `error` is set. */
  pct: number
  error?: string
}

/** Props for {@link InsertMediaStatusPill}. */
export interface InsertMediaStatusPillProps {
  status: InsertMediaStatus
  onDismiss: () => void
}

/** Busy/error pill for an in-flight (or failed) image/audio upload. */
export function InsertMediaStatusPill({ status, onDismiss }: InsertMediaStatusPillProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center px-3">
      <div className="pointer-events-auto flex items-center gap-2 rounded-control border border-border bg-surface px-3 py-1.5 shadow-lg">
        {status.error ? (
          <>
            <span className="text-body text-danger">{status.error}</span>
            <Button variant="ghost" onClick={onDismiss}>Dismiss</Button>
          </>
        ) : (
          <span className="text-body text-text-muted">Uploading {status.kind}... {status.pct}%</span>
        )}
      </div>
    </div>
  )
}
