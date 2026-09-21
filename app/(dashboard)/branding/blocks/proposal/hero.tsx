'use client'

import { publicBrandingFromEditorState } from '@/app/(dashboard)/branding/editor-branding'
import { heroHeightVh, RenderHero, type HeroSlots } from '@/lib/branding/public-blocks/proposal/hero'
import type { BrandPreviewState, SurfaceTab } from '@/types/branding-preview'

import type { ProposalRenderExtras, UpdateBlock } from '../render-proposal'
import { RichText } from '../rich-text/rich-text'
import { SAMPLE_DOC_BY_SURFACE } from '../sample-doc'
import type { HeroBlock } from '../types'

import { HeroMediaSlot } from './hero-media'
import { HeroResizeGrip } from './hero-resize'

/**
 * The viewport height the canvas stands in for. 720 reads as a laptop screen
 * behind the 1200px desktop canvas and as a phone screen behind the 380px
 * mobile one, and leaves room under a "full" hero for the block toolbar at
 * the editor's usual fit zoom.
 */
const CANVAS_VIEWPORT_HEIGHT = 720

interface EditHeroProps {
  block: HeroBlock
  state: BrandPreviewState
  surface: SurfaceTab
  updateBlock: UpdateBlock
  extras: ProposalRenderExtras
}

/**
 * Editor renderer for the proposal hero block: composes the public
 * `RenderHero` with inline-editable heading/subheading and the media slot
 * (see {@link HeroMediaSlot}), and a bottom-edge grip that drags the height
 * (see {@link HeroResizeGrip}). The heading takes Enter as a line break (one
 * line of display type, broken where the MC wants), the subheading as a new
 * paragraph. Each carries a `data-subtarget` so clicking it points the
 * toolbar's style controls at that part.
 */
export function EditHero({ block, state, surface, updateBlock, extras }: EditHeroProps) {
  const branding = publicBrandingFromEditorState(state)
  const doc = SAMPLE_DOC_BY_SURFACE[surface]
  const patch = (p: Partial<HeroBlock>) => updateBlock<HeroBlock>(block.id, p)

  const slots: HeroSlots = {
    heading: (
      <div data-subtarget="heading">
        <RichText value={block.heading} onChange={(v) => patch({ heading: v })} surface={surface} enterKey="lineBreak" className="text-inherit" />
      </div>
    ),
    subheading: (
      <div data-subtarget="subheading">
        <RichText value={block.subheading} onChange={(v) => patch({ subheading: v })} surface={surface} enterKey="paragraph" className="text-inherit" />
      </div>
    ),
    media: <HeroMediaSlot block={block} brandColor={state.brandColor} patch={patch} extras={extras} />,
  }

  const grip = (
    <HeroResizeGrip heightVh={heroHeightVh(block)} canvasViewportHeight={CANVAS_VIEWPORT_HEIGHT} onChange={(heightVh) => patch({ heightVh })} />
  )

  return <RenderHero block={block} branding={branding} doc={doc} frame="page" slots={slots} chrome={grip} canvasViewportHeight={CANVAS_VIEWPORT_HEIGHT} />
}
