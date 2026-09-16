'use client'

import { publicBrandingFromEditorState } from '@/app/(dashboard)/branding/editor-branding'
import { RenderAboutMe, type AboutMeSlots } from '@/lib/branding/public-blocks/proposal/about-me'
import type { BrandPreviewState, SurfaceTab } from '@/types/branding-preview'

import { InlineAsset } from '../inline-asset'
import type { ProposalRenderExtras, UpdateBlock } from '../render-proposal'
import { RichText } from '../rich-text/rich-text'
import type { AboutMeBlock } from '../types'

import { ProposalText } from './proposal-text'

interface EditAboutMeProps {
  block: AboutMeBlock
  state: BrandPreviewState
  surface: SurfaceTab
  updateBlock: UpdateBlock
  extras: ProposalRenderExtras
}

/**
 * Editor renderer for the proposal about-me block: an inline-editable
 * heading and rich-text body alongside an uploadable portrait. The portrait
 * side of the layout is decided by `block.imageSide`, unchanged from the
 * public renderer.
 */
export function EditAboutMe({ block, state, surface, updateBlock, extras }: EditAboutMeProps) {
  const branding = publicBrandingFromEditorState(state)

  const slots: AboutMeSlots = {
    heading: (
      <ProposalText subtarget="heading" value={block.heading} onChange={(v) => updateBlock<AboutMeBlock>(block.id, { heading: v })} placeholder="Heading" />
    ),
    body: (
      <RichText
        value={block.body}
        onChange={(v) => updateBlock<AboutMeBlock>(block.id, { body: v })}
        surface={surface}
        placeholder="Tell couples who you are and why you love this work."
      />
    ),
    portrait: (
      <InlineAsset
        value={block.portraitUrl}
        onUpload={async (file) => {
          if (!extras.uploadBlockImage) return
          const url = await extras.uploadBlockImage(file, `portrait-${block.id}`)
          updateBlock<AboutMeBlock>(block.id, { portraitUrl: url })
        }}
        label="Upload portrait"
        selectableWhenEmpty
        className="aspect-[4/5] w-full"
        emptyState={
          <div
            className="h-full w-full border-2 border-dashed border-border bg-gray-50/40"
            style={{ borderRadius: state.cornerRadius }}
          />
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- editor preview of an uploaded portrait */}
        <img
          src={block.portraitUrl}
          alt=""
          className="aspect-[4/5] w-full object-cover"
          style={{ borderRadius: state.cornerRadius }}
        />
      </InlineAsset>
    ),
  }

  return <RenderAboutMe block={block} branding={branding} slots={slots} />
}
