'use client'

/**
 * The Background popover's `role="tablist"` strip and its three tab
 * bodies (Colour / Image / Video), split out of `section-background.tsx`
 * to keep that file within its line budget.
 *
 * @module features/proposals/editor/bars/section-background-tabs
 */
import { Image as ImageIcon, Palette, Video as VideoIcon } from 'lucide-react'
import { useRef, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { ColorPopover } from '@/components/ui/color-popover'

import { MEDIA_LIMITS } from '../../data/media'
import type { SectionBackground } from '../../model/layout'

/** The Background popover's three tabs. */
export type BackgroundTab = 'colour' | 'image' | 'video'

/** One tab button in the popover's `role="tablist"` strip. */
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1 rounded-control px-2 py-1 text-body transition-colors ${
        active ? 'bg-surface-emphasis font-medium text-text' : 'text-text-muted hover:text-text'
      }`}
    >
      {children}
    </button>
  )
}

/** The Image and Video tabs' shared shape: a hidden file input plus an upload/replace `Button`. */
function UploadTab({
  accept, current, label, uploading, onPick,
}: {
  accept: string
  current: string | undefined
  label: string
  uploading: boolean
  onPick: (file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div>
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
      <Button variant="outline" loading={uploading} className="w-full" onClick={() => inputRef.current?.click()}>
        {current ? `Replace ${label}` : `Upload ${label}`}
      </Button>
    </div>
  )
}

/** Props for {@link BackgroundTabs}. */
export interface BackgroundTabsProps {
  tab: BackgroundTab
  onTabChange: (tab: BackgroundTab) => void
  background: SectionBackground | undefined
  swatches: readonly string[]
  uploading: boolean
  onColorChange: (color: string) => void
  /** `kind` is the media-kind passed to `uploadProposalMediaFile`; see `section-background.tsx`'s module doc for why it differs from `field`. */
  onUpload: (file: File, kind: 'image' | 'video', field: 'image' | 'video') => void
}

/** The tab strip plus whichever of the three tab bodies is active. */
export function BackgroundTabs({ tab, onTabChange, background, swatches, uploading, onColorChange, onUpload }: BackgroundTabsProps) {
  return (
    <>
      <div role="tablist" className="mb-2 flex gap-1">
        <TabButton active={tab === 'colour'} onClick={() => onTabChange('colour')}>
          <Palette size={12} strokeWidth={1.5} /> Colour
        </TabButton>
        <TabButton active={tab === 'image'} onClick={() => onTabChange('image')}>
          <ImageIcon size={12} strokeWidth={1.5} /> Image
        </TabButton>
        <TabButton active={tab === 'video'} onClick={() => onTabChange('video')}>
          <VideoIcon size={12} strokeWidth={1.5} /> Video
        </TabButton>
      </div>
      <div role="tabpanel">
        {tab === 'colour' && (
          <ColorPopover
            value={background?.color ?? '#FFFFFF'}
            onChange={onColorChange}
            swatches={swatches}
            zClassName="z-[70]"
            trigger={
              <button type="button" className="flex h-8 w-full items-center gap-2 rounded-control border border-border px-2.5 hover:bg-surface-emphasis">
                <span className="h-4 w-4 rounded-control ring-1 ring-black/10" style={{ background: background?.color ?? '#FFFFFF' }} />
                <span className="text-text-muted">{background?.color ?? 'Choose colour'}</span>
              </button>
            }
          />
        )}
        {tab === 'image' && (
          <UploadTab
            accept={MEDIA_LIMITS.image.types.join(',')}
            current={background?.image}
            label="image"
            uploading={uploading}
            onPick={(file) => onUpload(file, 'image', 'image')}
          />
        )}
        {tab === 'video' && (
          <UploadTab
            accept={MEDIA_LIMITS.background.types.join(',')}
            current={background?.video}
            label="video"
            uploading={uploading}
            onPick={(file) => onUpload(file, 'video', 'video')}
          />
        )}
      </div>
    </>
  )
}
