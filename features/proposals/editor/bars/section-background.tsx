'use client'

/**
 * The section bar's Background control: a swatch button opening a popover
 * with Colour / Image / Video tabs (`section-background-tabs.tsx`).
 *
 * Media kind choice for the two upload tabs: `MEDIA_LIMITS` (Task 8,
 * `features/proposals/data/media.ts`) only allows image MIME types under
 * the `image` kind and video MIME types under `video`, so the Image tab
 * uploads with kind `'image'` and the Video tab with kind `'video'`; the
 * `'background'` kind (an alias of `video`) is left to hero covers.
 *
 * No Overlay control here: the darkening slider this popover used to show
 * was cut for being one control too many. `SectionBackground.overlay` and
 * its render (`render/section-backdrop.tsx`) are untouched, so a section
 * saved with an overlay from before still renders one - there is just no
 * UI to set a new one.
 *
 * @module features/proposals/editor/bars/section-background
 */
import * as Popover from '@radix-ui/react-popover'
import { useState, type RefObject } from 'react'

import { Tooltip } from '@/components/ui/tooltip'

import { uploadProposalMediaFile } from '../../data/media'
import type { SectionBackground } from '../../model/layout'

import { BackgroundTabs, type BackgroundTab } from './section-background-tabs'

/** Props for {@link SectionBackgroundControl}. */
export interface SectionBackgroundControlProps {
  background: SectionBackground | undefined
  /** Dispatches the full next background object (the reducer replaces `style.background` wholesale, it does not deep-merge). */
  onChange: (background: SectionBackground, opts?: { commit?: boolean }) => void
  swatches: readonly string[]
  boundsRef: RefObject<HTMLElement | null>
  /** Starts the on-canvas drag for the image (`../background-reposition.tsx`). Omit where no canvas hosts one (a bare test harness); the Reposition button is then not offered. */
  onReposition?: (() => void) | undefined
}

/** The Background swatch button and its Colour / Image / Video popover. */
export function SectionBackgroundControl({ background, onChange, swatches, boundsRef, onReposition }: SectionBackgroundControlProps) {
  const [tab, setTab] = useState<BackgroundTab>(background?.image ? 'image' : background?.video ? 'video' : 'colour')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  // Captured on open, not read during render: see `section-padding.tsx`'s
  // matching comment for why (`react-hooks/refs`).
  const [bounds, setBounds] = useState<HTMLElement | null>(null)

  /**
   * The three tabs are exclusive - a colour, an image, or a video - so
   * every choice replaces the media wholesale and keeps only `overlay`
   * (which applies to either kind of media). A leftover colour under a
   * transparent PNG was the tell that merging was wrong. Keys are
   * dropped by omission rather than set to `undefined`, which
   * `exactOptionalPropertyTypes` rejects and the schema never expects.
   */
  const only = (media: Partial<SectionBackground>): SectionBackground =>
    ({ ...(background?.overlay !== undefined ? { overlay: background.overlay } : {}), ...media })

  const upload = async (file: File, kind: 'image' | 'video', field: 'image' | 'video') => {
    setError(null)
    setUploading(true)
    try {
      const url = await uploadProposalMediaFile(file, kind)
      // A replaced image's focal point and a replaced video's poster are
      // both stale for the new file, so they go too.
      onChange(only({ [field]: url }), { commit: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={(next) => { setOpen(next); if (next) setBounds(boundsRef.current) }}>
      <Tooltip side="top" label="Background">
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label="Background"
            className="inline-flex h-8 w-8 items-center justify-center rounded-control transition hover:bg-surface-emphasis"
          >
            <span
              className="h-4 w-4 rounded-control ring-1 ring-black/10"
              style={{ background: background?.color ?? '#E5E7EB' }}
            />
          </button>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={16}
          collisionBoundary={bounds}
          className="z-[60] w-[260px] animate-modal-in rounded-control border border-border bg-surface p-4 text-body shadow-xl"
        >
          <BackgroundTabs
            tab={tab}
            onTabChange={setTab}
            background={background}
            swatches={swatches}
            uploading={uploading}
            onColorChange={(v) => onChange(only({ color: v }), { commit: true })}
            onUpload={(file, kind, field) => void upload(file, kind, field)}
            onRemove={() => onChange(only({}), { commit: true })}
            // Closes this popover (and, via `onReposition`, the Style one
            // hosting it) so the drag surface is the only thing in the way.
            onReposition={onReposition ? () => { setOpen(false); onReposition() } : undefined}
          />
          {error ? <p className="mt-2 text-body text-danger">{error}</p> : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
