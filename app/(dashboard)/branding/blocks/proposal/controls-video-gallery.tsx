'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { parseEmbedUrl } from '@/lib/proposals/embed-url'

import type { UpdateBlock } from '../render-proposal'
import type { GalleryBlock, VideoBlock } from '../types'

import { LabelledControl } from './labelled-control'

const GALLERY_LAYOUT_OPTIONS = [
  { value: 'grid', label: 'Grid' },
  { value: 'masonry', label: 'Masonry' },
  { value: 'carousel', label: 'Carousel' },
]

/**
 * Toolbar controls for the proposal {@link VideoBlock}: an embed URL field
 * (same YouTube/Vimeo validation as the hero) and a "Remove video" action
 * shown once a source (uploaded or embedded) is set.
 */
export function VideoControls({ block, updateBlock }: { block: VideoBlock; updateBlock: UpdateBlock }) {
  const { toast } = useToast()
  const patch = (p: Partial<VideoBlock>) => updateBlock<VideoBlock>(block.id, p)
  const [embedUrl, setEmbedUrl] = useState(block.source?.kind === 'embed' ? block.source.url : '')

  const commitEmbedUrl = () => {
    const raw = embedUrl.trim()
    if (!raw) {
      // Seeded empty whenever the current source isn't an embed (upload or
      // none) - only clear an existing embed, otherwise an empty blur would
      // wipe an uploaded video the MC never touched.
      if (block.source?.kind === 'embed') {
        patch({ source: null })
      }
      return
    }
    if (!parseEmbedUrl(raw)) {
      toast('Only YouTube and Vimeo links can be embedded', 'error')
      return
    }
    patch({ source: { kind: 'embed', url: raw } })
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <LabelledControl label="Embed URL">
        <div className="w-48">
          <Input
            aria-label="Embed URL"
            value={embedUrl}
            placeholder="youtube.com/watch?v=…"
            onChange={(e) => setEmbedUrl(e.target.value)}
            onBlur={commitEmbedUrl}
          />
        </div>
      </LabelledControl>
      {block.source && (
        <Button
          variant="ghost"
          onClick={() => {
            setEmbedUrl('')
            patch({ source: null })
          }}
        >
          Remove video
        </Button>
      )}
    </div>
  )
}

/**
 * Toolbar controls for the proposal {@link GalleryBlock}: layout only (there
 * is nothing else block-level to style; each tile's image is edited on the
 * canvas itself) plus a read-only count against the 12-photo cap.
 */
export function GalleryControls({ block, updateBlock }: { block: GalleryBlock; updateBlock: UpdateBlock }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <LabelledControl label="Layout">
        <div className="w-28">
          <Select
            ariaLabel="Layout"
            options={GALLERY_LAYOUT_OPTIONS}
            value={block.layout}
            onValueChange={(v) => updateBlock<GalleryBlock>(block.id, { layout: v as GalleryBlock['layout'] })}
          />
        </div>
      </LabelledControl>
      <span className="text-body text-text-muted pb-1.5">{block.images.length} of 12 photos</span>
    </div>
  )
}
