'use client'

/**
 * The section bar's Background control: a swatch button opening a popover
 * with Colour / Image / Video tabs (`section-background-tabs.tsx`) and an
 * Overlay slider.
 *
 * Media kind choice for the two upload tabs: `MEDIA_LIMITS` (Task 8,
 * `features/proposals/data/media.ts`) only allows image MIME types under
 * the `image` kind and video MIME types under `video`, so the Image tab
 * uploads with kind `'image'` and the Video tab with kind `'video'`; the
 * `'background'` kind (an alias of `video`) is left to hero covers.
 *
 * @module features/proposals/editor/bars/section-background
 */
import * as Popover from '@radix-ui/react-popover'
import { useState, type RefObject } from 'react'

import { Slider } from '@/components/editor'
import { Tooltip } from '@/components/ui/tooltip'

import { uploadProposalMediaFile } from '../../data/media'
import type { SectionBackground } from '../../model/layout'

import { OverrideDot } from './override-dot'
import { BackgroundTabs, type BackgroundTab } from './section-background-tabs'

/** Props for {@link SectionBackgroundControl}. */
export interface SectionBackgroundControlProps {
  background: SectionBackground | undefined
  /** Dispatches the full next background object (the reducer replaces `style.background` wholesale, it does not deep-merge). */
  onChange: (background: SectionBackground, opts?: { commit?: boolean }) => void
  /** Whether `background` differs from the section kind's starting style. */
  overridden: boolean
  swatches: readonly string[]
  boundsRef: RefObject<HTMLElement | null>
}

/** The Background swatch button and its Colour / Image / Video popover. */
export function SectionBackgroundControl({ background, onChange, overridden, swatches, boundsRef }: SectionBackgroundControlProps) {
  const [tab, setTab] = useState<BackgroundTab>(background?.image ? 'image' : background?.video ? 'video' : 'colour')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Captured on open, not read during render: see `section-padding.tsx`'s
  // matching comment for why (`react-hooks/refs`).
  const [bounds, setBounds] = useState<HTMLElement | null>(null)

  /** Merge `next` onto the current background and dispatch the whole object. */
  const patch = (next: Partial<SectionBackground>, opts?: { commit?: boolean }) => onChange({ ...background, ...next }, opts)

  const upload = async (file: File, kind: 'image' | 'video', field: 'image' | 'video') => {
    setError(null)
    setUploading(true)
    try {
      const url = await uploadProposalMediaFile(file, kind)
      patch({ [field]: url }, { commit: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const overlay = background?.overlay ?? 0

  return (
    <Popover.Root onOpenChange={(open) => { if (open) setBounds(boundsRef.current) }}>
      <Tooltip label="Background">
        <Popover.Trigger asChild>
          <span data-testid="background-control" className="relative inline-flex">
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
            <OverrideDot active={overridden} />
          </span>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionBoundary={bounds}
          className="z-[60] w-[260px] animate-modal-in rounded-control border border-border bg-surface p-3 text-body shadow-xl"
        >
          <BackgroundTabs
            tab={tab}
            onTabChange={setTab}
            background={background}
            swatches={swatches}
            uploading={uploading}
            onColorChange={(v) => patch({ color: v }, { commit: true })}
            onUpload={(file, kind, field) => void upload(file, kind, field)}
          />
          {error ? <p className="mt-2 text-body text-danger">{error}</p> : null}
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-text-muted">Overlay</span>
              <span className="font-mono text-text">{overlay}%</span>
            </div>
            <Slider
              value={overlay}
              min={0}
              max={100}
              ariaLabel="Overlay"
              onChange={(v) => patch({ overlay: v })}
              onCommit={(v) => patch({ overlay: v }, { commit: true })}
            />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
