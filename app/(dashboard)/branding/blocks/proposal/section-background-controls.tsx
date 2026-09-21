'use client'

import { Image as ImageIcon, X } from 'lucide-react'
import { useRef } from 'react'

import { ColorPopover } from '@/components/ui/color-popover'
import { useToast } from '@/components/ui/toast'
import { Tooltip } from '@/components/ui/tooltip'
import { COLOR_PALETTE } from '@/lib/branding/themes'

import { Slider } from '../../components/slider'
import { uploadBlockImage } from '../../upload-brand-asset'
import type { UpdateBlock } from '../render-proposal'
import { ToolbarDivider } from '../toolbar-primitives'
import type { Block, SectionBackground } from '../types'

/**
 * Full-width section background shared by every proposal block bar the hero
 * (page frame only), as one compact toolbar group in the general-block
 * idiom: a colour swatch, an image button (icon when empty, thumbnail plus a
 * Remove button when set), and an Overlay slider chip that appears only
 * once there is an image to darken. Clearing every field drops
 * `sectionBackground` back to `undefined` rather than persisting an
 * all-defaults object, so an untouched block stays untouched.
 *
 * Uploads go straight through {@link uploadBlockImage} (R-T7a): it resolves
 * its own Supabase session, so there is no upload callback to thread through
 * `BlockFrame` / `BlockToolbar` for this one control.
 */
export function SectionBackgroundControls({ block, updateBlock }: { block: Block; updateBlock: UpdateBlock }) {
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const bg = block.sectionBackground

  // Each field is `| undefined` so a control can clear one without every
  // caller having to rebuild the whole object under exactOptionalPropertyTypes.
  const patch = (p: { [K in keyof SectionBackground]?: SectionBackground[K] | undefined }) => {
    const merged = { ...(bg ?? {}), ...p }
    const cleared = !merged.color && !merged.imageUrl && !merged.overlay
    updateBlock(block.id, { sectionBackground: cleared ? undefined : merged } as Partial<Block>)
  }

  const uploadImage = async (file: File | null | undefined) => {
    if (!file) return
    const url = await uploadBlockImage(file, `section-${block.id}`, { onError: (msg) => toast(msg, 'error') })
    patch({ imageUrl: url })
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <ToolbarDivider />
      <Tooltip label="Section colour">
        <ColorPopover
          value={bg?.color || '#FFFFFF'}
          onChange={(v) => patch({ color: v })}
          swatches={COLOR_PALETTE}
          trigger={
            <button
              type="button"
              aria-label="Section colour"
              className="inline-flex items-center h-8 px-2.5 rounded-control hover:bg-surface-emphasis cursor-pointer border border-border"
            >
              <span className="w-4 h-4 rounded-control ring-1 ring-black/10" style={{ background: bg?.color || '#FFFFFF' }} />
            </button>
          }
        />
      </Tooltip>
      <Tooltip label={bg?.imageUrl ? 'Replace section image' : 'Section image'}>
        <button
          type="button"
          aria-label="Section image"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 h-8 px-2 rounded-control hover:bg-surface-emphasis cursor-pointer border border-border text-text-muted hover:text-text"
        >
          {bg?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- editor thumbnail of an uploaded section background
            <img src={bg.imageUrl} alt="" className="w-8 h-5 rounded-control object-cover ring-1 ring-black/10" />
          ) : (
            <ImageIcon size={14} strokeWidth={1.5} />
          )}
        </button>
      </Tooltip>
      {bg?.imageUrl && (
        <>
          <Tooltip label="Remove section image">
            <button
              type="button"
              aria-label="Remove section image"
              // The overlay only ever darkened this image, so it goes with it.
              onClick={() => patch({ imageUrl: undefined, overlay: undefined })}
              className="inline-flex items-center justify-center w-8 h-8 rounded-control text-text-muted hover:text-danger hover:bg-surface-emphasis cursor-pointer"
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          </Tooltip>
          <div className="inline-flex items-center gap-2 h-8 px-2 rounded-control border border-border bg-surface shrink-0">
            <span className="text-body text-text-muted">Overlay</span>
            <div className="w-20">
              <Slider ariaLabel="Section overlay" value={bg.overlay ?? 0} min={0} max={100} onChange={(v) => patch({ overlay: v })} />
            </div>
            <span className="text-body font-mono text-gray-700 tabular-nums w-9 text-right">{bg.overlay ?? 0}%</span>
          </div>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        aria-label="Upload section background image"
        onChange={(e) => { uploadImage(e.target.files?.[0]); e.target.value = '' }}
      />
    </div>
  )
}
