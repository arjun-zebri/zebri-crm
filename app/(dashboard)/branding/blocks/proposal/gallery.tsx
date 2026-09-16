'use client'

import { publicBrandingFromEditorState } from '@/app/(dashboard)/branding/editor-branding'
import { RenderGallery, type GallerySlots } from '@/lib/branding/public-blocks/proposal/gallery'
import type { BrandPreviewState, SurfaceTab } from '@/types/branding-preview'

import { InlineAsset } from '../inline-asset'
import type { ProposalRenderExtras, UpdateBlock } from '../render-proposal'
import type { GalleryBlock, GalleryImage } from '../types'

import { RemoveItemButton } from './item-list'

/** The gallery's own cap; matches {@link GalleryBlock}'s doc comment. */
const MAX_IMAGES = 12

interface EditGalleryProps {
  block: GalleryBlock
  state: BrandPreviewState
  surface: SurfaceTab
  updateBlock: UpdateBlock
  extras: ProposalRenderExtras
}

/**
 * Editor renderer for the proposal gallery block: each tile gets a hover
 * remove control, and an empty "add photo" tile after the grid is the add
 * affordance (there is no separate `AddItemButton`: the tile itself is a
 * clickable `InlineAsset`). The tile disappears once the block reaches its
 * 12-image cap.
 */
export function EditGallery({ block, state, updateBlock, extras }: EditGalleryProps) {
  const branding = publicBrandingFromEditorState(state)

  const removeImage = (id: string) => {
    updateBlock<GalleryBlock>(block.id, { images: block.images.filter((img) => img.id !== id) })
  }

  const addImage = async (file: File) => {
    if (!extras.uploadBlockImage) return
    const key = `gallery-${block.id}-${Date.now().toString(36)}`
    const url = await extras.uploadBlockImage(file, key)
    const image: GalleryImage = { id: key, url }
    updateBlock<GalleryBlock>(block.id, { images: [...block.images, image] })
  }

  const slots: GallerySlots = {
    tile: (image, i) => (
      <div className="group/item relative h-full w-full">
        {/* eslint-disable-next-line @next/next/no-img-element -- editor preview of an uploaded gallery photo */}
        <img src={image.url} alt={image.alt ?? ''} className="block h-full w-full object-cover" />
        <RemoveItemButton onRemove={() => removeImage(image.id)} label={`Remove photo ${i + 1}`} />
      </div>
    ),
    ...(block.images.length < MAX_IMAGES
      ? {
          trailing: (
            <InlineAsset
              value={null}
              onUpload={addImage}
              label="Add photo"
              selectableWhenEmpty
              className="mt-3 aspect-[4/3] w-full max-w-40"
              emptyState={
                <div
                  className="h-full w-full border-2 border-dashed border-border bg-gray-50/40"
                  style={{ borderRadius: state.cornerRadius }}
                />
              }
            >
              {null}
            </InlineAsset>
          ),
        }
      : {}),
  }

  return <RenderGallery block={block} branding={branding} slots={slots} />
}
