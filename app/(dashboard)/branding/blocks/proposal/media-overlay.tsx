'use client'

import { RefreshCw, Trash2 } from 'lucide-react'

/**
 * Compact Replace/Remove icon buttons for a populated hero/video media slot.
 * Shared by `hero.tsx` and `video.tsx` so the two upload overlays (image or
 * video background, and video-only) stay visually identical. Both actions
 * stop propagation so clicking them never selects or deselects the block.
 */
export function MediaReplaceRemove({
  onReplace,
  onRemove,
  replaceWrapper,
  inset = 'tight',
}: {
  onReplace: () => void
  onRemove: () => void
  /**
   * `tight` hugs the media's corner (the video block's frame); `section`
   * sits at the hero's own inset, where its Add background pill was.
   */
  inset?: 'tight' | 'section'
  /**
   * Wraps the Replace button, for media with nothing to upload: an embed's
   * Replace opens a link popover, so the button becomes that popover's
   * trigger and `onReplace` is not called.
   */
  replaceWrapper?: (button: React.ReactNode) => React.ReactNode
}) {
  const replace = (
    <button
      type="button"
      onClick={replaceWrapper ? undefined : onReplace}
      className="inline-flex items-center gap-1 px-2 h-8 rounded-control bg-surface/90 border border-border text-body font-medium text-text hover:bg-surface cursor-pointer transition shadow-sm"
    >
      <RefreshCw size={14} strokeWidth={1.5} />
      Replace
    </button>
  )
  return (
    <div
      className={`absolute z-10 ${inset === 'section' ? 'top-4 right-4 @sm/doc:top-8 @sm/doc:right-8' : 'top-1.5 right-1.5'} flex items-center gap-1 opacity-0 group-hover/media:opacity-100 transition`}
      onClick={(e) => e.stopPropagation()}
    >
      {replaceWrapper ? replaceWrapper(replace) : replace}
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex items-center justify-center w-8 h-8 rounded-control bg-surface/90 border border-border text-text-muted hover:bg-surface hover:text-danger cursor-pointer transition shadow-sm"
        title="Remove"
        aria-label="Remove media"
      >
        <Trash2 size={14} strokeWidth={1.5} />
      </button>
    </div>
  )
}

/**
 * Upload progress bar shown while a video is uploading (images resolve too
 * fast to need one). Coloured with the account's brand colour via
 * `accentColor` so it reads as part of the document, not a browser default.
 */
export function UploadProgressBar({ pct, brandColor }: { pct: number; brandColor: string }) {
  return (
    <progress
      value={pct}
      max={100}
      aria-label="Upload progress"
      className="absolute bottom-3 left-3 right-3 h-1.5 w-auto"
      style={{ accentColor: brandColor }}
    />
  )
}
