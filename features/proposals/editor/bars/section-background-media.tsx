'use client'

/**
 * The Background popover's Image and Video tab panels
 * (`section-background-tabs.tsx` mounts one per tab). Before any media is
 * chosen: a single Upload button. Once set: a thumbnail cropped the way
 * the section crops it, then Reposition (image only; hands off to
 * `../background-reposition.tsx`, which turns the section itself into
 * the drag surface - a focal-point grid in here was rejected), Replace,
 * and Remove. A video gets no Reposition: it is always centred, and a
 * poster/overlay control is still to come.
 *
 * @module features/proposals/editor/bars/section-background-media
 */
import { Trash2 } from 'lucide-react'
import { useRef } from 'react'

import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'

import type { SectionBackground } from '../../model/layout'

/** Props for {@link BackgroundMediaTab}. */
export interface BackgroundMediaTabProps {
  kind: 'image' | 'video'
  /** The file picker's `accept` list (`MEDIA_LIMITS`). */
  accept: string
  /** The current storage URL, or `undefined` before one is chosen. */
  current: string | undefined
  uploading: boolean
  onPick: (file: File) => void
  onRemove: () => void
  /** Image only: the stored focal point, so the thumbnail previews the real crop. */
  position?: SectionBackground['position'] | undefined
  /** Image only: starts the on-canvas drag (`background-reposition.tsx`). */
  onReposition?: (() => void) | undefined
}

/** One tab panel: Upload, or thumbnail + Reposition / Replace / Remove. */
export function BackgroundMediaTab({ kind, accept, current, uploading, onPick, onRemove, position, onReposition }: BackgroundMediaTabProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) onPick(file)
        }}
      />
      {current && kind === 'image' ? (
        // eslint-disable-next-line @next/next/no-img-element -- MC-uploaded section background
        <img
          src={current}
          alt=""
          className="h-24 w-full rounded-control object-cover ring-1 ring-black/10"
          style={position ? { objectPosition: `${position.x}% ${position.y}%` } : undefined}
        />
      ) : null}
      <div className="flex gap-1.5">
        {current && kind === 'image' && onReposition ? (
          <Button variant="outline" className="flex-1" onClick={onReposition}>Reposition</Button>
        ) : null}
        <Button variant="outline" loading={uploading} className="flex-1" onClick={() => inputRef.current?.click()}>
          {current ? 'Replace' : `Upload ${kind}`}
        </Button>
        {current ? (
          <Tooltip side="top" label="Remove">
            <Button variant="outline" iconOnly aria-label={`Remove ${kind}`} onClick={onRemove}>
              <Trash2 size={14} strokeWidth={1.5} />
            </Button>
          </Tooltip>
        ) : null}
      </div>
    </div>
  )
}
